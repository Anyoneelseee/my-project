// src/app/dashboard/professor/bulk-ai-checker/page.tsx
"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import AceEditor, { IMarker, IAnnotation } from "react-ace"; // Import Annotation
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface SimilarityResult {
  [key: string]: number;
}

interface SimilarityError {
  error: string;
}

interface FileWithResult {
  file: File;
  code: string;
  aiPercentage: number | null;
  error: string | null;
  similarity: SimilarityResult | SimilarityError | null;
}

export default function BulkAICheckerPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [files, setFiles] = useState<FileWithResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
            subscription.unsubscribe();
            proceedWithSession();
          }
        });

        const proceedWithSession = async () => {
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
              console.warn("No session found:", sessionError?.message);
              redirect("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              console.warn("Auth error:", authError?.message);
              redirect("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              console.warn("Invalid role or no role found");
              redirect("/dashboard/student");
              return;
            }

            const { data, error } = await supabase.rpc("get_professor_classes");
            if (error) {
              console.warn("Failed to fetch classes:", error.message);
              setClasses([]);
            } else {
              const validatedClasses = (data as Class[]).filter(
                (cls): cls is Class =>
                  cls &&
                  typeof cls.id === "string" &&
                  typeof cls.name === "string" &&
                  typeof cls.section === "string" &&
                  typeof cls.course === "string" &&
                  typeof cls.code === "string"
              );
              setClasses(validatedClasses);
            }
          } catch (err) {
            console.error("Unexpected error:", err);
            redirect("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        redirect("/dashboard/professor");
      }
    };

    initialize();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 10) {
      alert("You can upload a maximum of 10 files.");
      return;
    }

    const newFiles: FileWithResult[] = await Promise.all(
      selectedFiles.map(async (file) => {
        try {
          const text = await file.text();
          return {
            file,
            code: text,
            aiPercentage: null,
            error: text.trim() ? null : "File is empty",
            similarity: null,
          };
        } catch {
          return {
            file,
            code: "",
            aiPercentage: null,
            error: "Failed to read file",
            similarity: null,
          };
        }
      })
    );
    setFiles([...files, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleCheckAIAndSimilarity = async () => {
    if (!process.env.NEXT_PUBLIC_AI_DETECTOR_URL || !process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
      alert("AI or similarity detector URL is not configured.");
      return;
    }

    setIsProcessing(true);
    const updatedFiles = [...files];

    // Step 1: Check AI percentage for each file
    for (let i = 0; i < updatedFiles.length; i++) {
      const fileEntry = updatedFiles[i];
      if (fileEntry.error) continue; // Skip files with errors

      try {
        const response = await fetch(process.env.NEXT_PUBLIC_AI_DETECTOR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: fileEntry.code }),
        });

        if (!response.ok) {
          throw new Error(`AI detection failed for ${fileEntry.file.name}: ${response.statusText}`);
        }

        const result = await response.json();
        updatedFiles[i] = {
          ...fileEntry,
          aiPercentage: result.ai_percentage || 0,
          error: null,
        };
      } catch {
        updatedFiles[i] = {
          ...fileEntry,
          aiPercentage: null,
          error: "Failed to check AI percentage.",
        };
      }
      setFiles([...updatedFiles]); // Update state incrementally
    }

    // Step 2: Calculate similarity if enough valid files
    const validFiles = updatedFiles.filter((f) => !f.error && f.code.trim());
    if (validFiles.length > 1) {
      const codes = validFiles.map((f) => f.code);
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
        });

        if (!response.ok) {
          throw new Error(`Similarity detection failed: ${response.statusText}`);
        }

        const result = await response.json();
        const similarities = result.similarities || {};

        updatedFiles.forEach((fileEntry, idx) => {
          if (!fileEntry.error && fileEntry.code.trim()) {
            const fileSimilarities: { [key: string]: number } = {};
            updatedFiles.forEach((otherEntry, otherIdx) => {
              if (idx !== otherIdx && !otherEntry.error && otherEntry.code.trim()) {
                const key = idx < otherIdx ? `${idx}-${otherIdx}` : `${otherIdx}-${idx}`;
                fileSimilarities[otherEntry.file.name] = similarities[key] || 0;
              }
            });
            updatedFiles[idx] = { ...fileEntry, similarity: fileSimilarities };
          }
        });
      } catch {
        updatedFiles.forEach((fileEntry, idx) => {
          if (!fileEntry.error && fileEntry.code.trim()) {
            updatedFiles[idx] = { ...fileEntry, similarity: { error: "Similarity check failed" } };
          }
        });
      }
    } else {
      updatedFiles.forEach((fileEntry, idx) => {
        if (!fileEntry.error && fileEntry.code.trim()) {
          updatedFiles[idx] = {
            ...fileEntry,
            similarity: { error: "Not enough valid files for similarity detection (minimum 2 required)" },
          };
        }
      });
    }

    setFiles([...updatedFiles]);
    setIsProcessing(false);
  };

  const detectLanguageFromFileName = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "py": return "python";
      case "cpp": return "cpp";
      case "c": return "c";
      case "java": return "java";
      default: return "text";
    }
  };

  const getLineAnnotations = (code: string, aiPercentage: number | null): IAnnotation[] => {
    if (!aiPercentage || !code) return [];
    const lines = code.split("\n");
    return lines.map((line, index) => ({
      row: index,
      column: 0,
      type: aiPercentage > 50 ? "error" : "info",
      text: aiPercentage > 50 ? "Likely AI-generated" : "Likely human-written",
    }));
  };

  const getLineMarkers = (code: string, aiPercentage: number | null): IMarker[] => {
    if (!aiPercentage || !code) return [];
    const lines = code.split("\n");
    return lines.map((line, index) => ({
      startRow: index,
      startCol: 0,
      endRow: index,
      endCol: line.length,
      className: aiPercentage > 50 ? "ai-generated-line" : "human-written-line",
      type: "fullLine",
    }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">Loading...</div>;
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="/dashboard/professor"
                  className="text-teal-300 hover:text-teal-400 text-sm font-medium transition-colors"
                >
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">Bulk AI Checker</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <style jsx global>{`
            .ai-generated-line {
              background-color: rgba(255, 99, 71, 0.2); /* Light red for AI-generated */
              position: absolute;
            }
            .human-written-line {
              background-color: rgba(50, 205, 50, 0.2); /* Light green for human-written */
              position: absolute;
            }
          `}</style>
          <div className="max-w-7xl mx-auto space-y-4">
            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-2xl font-semibold text-teal-400">
                  Bulk AI Checker
                </CardTitle>
                <p className="text-sm text-teal-300">Upload up to 10 files to check AI-generated content and similarity.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                  {/* File Upload Section */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <Label className="text-sm font-medium text-teal-300">Upload Files (Max 10)</Label>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="mt-2 text-teal-300 bg-gray-800 border-teal-500/20"
                      disabled={isProcessing || files.length >= 10}
                    />
                    <Button
                      onClick={handleCheckAIAndSimilarity}
                      disabled={isProcessing || files.length === 0}
                      className="mt-4 w-full bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                    >
                      {isProcessing ? "Processing..." : "Check AI & Similarity"}
                    </Button>
                  </div>

                  {/* Results Section */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <h3 className="text-lg font-semibold text-teal-400 mb-2">Results</h3>
                    {files.length === 0 ? (
                      <p className="text-teal-300 text-center">No files uploaded yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {files.map((fileEntry, index) => (
                          <div
                            key={index}
                            className="bg-gray-800/50 rounded-lg p-4 border border-teal-500/20"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm text-teal-300 font-medium">{fileEntry.file.name}</p>
                              <Button
                                onClick={() => handleRemoveFile(index)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                                disabled={isProcessing}
                              >
                                Remove
                              </Button>
                            </div>
                            {fileEntry.aiPercentage !== null && (
                              <p className="text-xs text-teal-400">
                                AI Percentage: {fileEntry.aiPercentage.toFixed(2)}%
                              </p>
                            )}
                            {fileEntry.error && (
                              <p className="text-xs text-red-400">{fileEntry.error}</p>
                            )}
                            {fileEntry.similarity && "error" in fileEntry.similarity ? (
                              <p className="text-xs text-red-400">{fileEntry.similarity.error}</p>
                            ) : fileEntry.similarity && Object.keys(fileEntry.similarity).length > 0 ? (
                              <div className="mt-2">
                                <p className="text-xs text-teal-300">Similarity with other files:</p>
                                {Object.entries(fileEntry.similarity).map(([fileName, percentage]) => (
                                  <p key={fileName} className="text-xs text-teal-400 ml-2">
                                    {fileName}: {percentage.toFixed(2)}%
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-2">
                              <Label className="text-xs text-teal-300">Code</Label>
                              {fileEntry.error ? (
                                <p className="text-xs text-red-400">Cannot display code due to error.</p>
                              ) : (
                                <AceEditor
                                  mode={detectLanguageFromFileName(fileEntry.file.name)}
                                  theme="monokai"
                                  value={fileEntry.code}
                                  name={`code-editor-${index}`}
                                  editorProps={{ $blockScrolling: true }}
                                  setOptions={{
                                    readOnly: true,
                                    showLineNumbers: true,
                                    tabSize: 2,
                                    fontSize: 12,
                                    wrap: true,
                                  }}
                                  style={{ width: "100%", height: "200px" }}
                                  annotations={getLineAnnotations(fileEntry.code, fileEntry.aiPercentage)}
                                  markers={getLineMarkers(fileEntry.code, fileEntry.aiPercentage)}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}