// src/app/dashboard/student/bulk-ai-checker/page.tsx
"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { StudentSidebar } from "@/components/student-sidebar";
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
import AceEditor, { IMarker, IAnnotation } from "react-ace";
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
  cached?: boolean;
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
            if (!role || role !== "student") {
              console.warn("Invalid role or no role found");
              redirect("/dashboard/student");
              return;
            }

            const { data, error } = await supabase.rpc("get_student_classes");
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
            redirect("/dashboard/student");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        redirect("/dashboard/student");
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

    const supportedExtensions = new Set([".py", ".cpp", ".c", ".java"]);
    const newFiles: FileWithResult[] = await Promise.all(
      selectedFiles.map(async (file) => {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
        if (!supportedExtensions.has(extension)) {
          return {
            file,
            code: "",
            aiPercentage: null,
            error: `Unsupported file type. Only .py, .cpp, .c, and .java files are allowed.`,
            similarity: null,
          };
        }

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
    setFiles([...files, ...newFiles.filter((f) => !f.error || f.error.includes("empty"))]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleCheckAIAndSimilarity = async () => {
    if (!process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
      alert("Similarity detector URL is not configured.");
      return;
    }

    setIsProcessing(true);
    const updatedFiles = [...files];

    // ──────── 1. BULK AI CHECK (with 25s timeout) ────────
    const validFiles = updatedFiles.filter((f) => !f.error && f.code.trim());
    if (validFiles.length > 0) {
      try {
        const codes = validFiles.map((f) => f.code);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s

        const response = await fetch("/api/bulk-ai-detector", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Bulk AI check failed: ${err}`);
        }

        const results: {
          ai_percentage: number | null;
          error: string | null;
          cached?: boolean;
        }[] = await response.json();

        let resultIdx = 0;
        for (let i = 0; i < updatedFiles.length; i++) {
          const f = updatedFiles[i];
          if (f.error || !f.code.trim()) continue;

          const r = results[resultIdx++];
          updatedFiles[i] = {
            ...f,
            aiPercentage: r.ai_percentage ?? null,
            error: r.error ?? null,
            cached: r.cached,
          };
        }
      } catch (err: unknown) {
        console.error("Bulk AI check error:", err);
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
         const isTimeout =
    (err instanceof Error && err.name === "AbortError") ||
    errorMsg.toLowerCase().includes("timeout");

        for (let i = 0; i < updatedFiles.length; i++) {
          if (!updatedFiles[i].error && updatedFiles[i].code.trim()) {
            updatedFiles[i] = {
              ...updatedFiles[i],
              aiPercentage: null,
              error: isTimeout
                ? "AI check timed out. Try fewer files or later."
                : "AI check failed. Please try again.",
            };
          }
        }

        if (isTimeout) {
          alert("AI check timed out. Try fewer files or check back later.");
        }
      }
    }

    // ──────── 2. SIMILARITY CHECK (direct) ────────
    const validAfterAI = updatedFiles.filter((f) => !f.error && f.code.trim());
    if (validAfterAI.length > 1) {
      const codes = validAfterAI.map((f) => f.code);
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
        });

        if (!response.ok) throw new Error(`Similarity failed: ${response.statusText}`);

        const { similarities = {} } = await response.json();

        updatedFiles.forEach((fileEntry, idx) => {
          if (!fileEntry.error && fileEntry.code.trim()) {
            const fileSimilarities: { [key: string]: number } = {};
            updatedFiles.forEach((otherEntry, otherIdx) => {
              if (idx !== otherIdx && !otherEntry.error && otherEntry.code.trim()) {
                const key = idx < otherIdx ? `${idx}-${otherIdx}` : `${otherIdx}-${idx}`;
                fileSimilarities[otherEntry.file.name] = similarities[key] ?? 0;
              }
            });
            updatedFiles[idx] = { ...fileEntry, similarity: fileSimilarities };
          }
        });
      } catch {
        updatedFiles.forEach((fileEntry, idx) => {
          if (!fileEntry.error && fileEntry.code.trim()) {
            updatedFiles[idx] = {
              ...fileEntry,
              similarity: { error: "Similarity check failed" },
            };
          }
        });
      }
    } else if (validAfterAI.length > 0) {
      updatedFiles.forEach((fileEntry, idx) => {
        if (!fileEntry.error && fileEntry.code.trim()) {
          updatedFiles[idx] = {
            ...fileEntry,
            similarity: { error: "Need at least 2 valid files for similarity" },
          };
        }
      });
    }

    setFiles(updatedFiles);
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
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        Loading...
      </div>
    );
  }

  return (
    <SidebarProvider>
      <StudentSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="/dashboard/student"
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
              background-color: rgba(255, 99, 71, 0.2);
              position: absolute;
            }
            .human-written-line {
              background-color: rgba(50, 205, 50, 0.2);
              position: absolute;
            }
          `}</style>
          <div className="max-w-7xl mx-auto space-y-4">
            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-2xl font-semibold text-teal-400">
                  Bulk AI Checker
                </CardTitle>
                <p className="text-sm text-teal-300">
                  Upload up to 10 files to check AI-generated content and similarity.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                  {/* File Upload */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <Label className="text-sm font-medium text-teal-300">Upload Files (Max 10)</Label>
                    <Input
                      type="file"
                      multiple
                      accept=".py,.cpp,.c,.java"
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

                  {/* Results */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <h3 className="text-lg font-semibold text-teal-400 mb-2">Results</h3>

                    {/* Loading Skeleton */}
                    {isProcessing ? (
                      <div className="space-y-4">
                        {[...Array(Math.min(files.length, 3))].map((_, i) => (
                          <div
                            key={i}
                            className="bg-gray-800/50 rounded-lg p-4 border border-teal-500/20 animate-pulse"
                          >
                            <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div>
                            <div className="h-32 bg-gray-700 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : files.length === 0 ? (
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

                            {/* AI Percentage + CACHED Badge */}
                            {fileEntry.aiPercentage !== null && (
                              <p className="text-xs flex items-center gap-1">
                                <span className="text-teal-400">
                                  AI: {fileEntry.aiPercentage.toFixed(1)}%
                                </span>
                                {fileEntry.cached && (
                                  <span className="text-green-400 text-[10px] bg-green-900/30 px-1 rounded">
                                    CACHED
                                  </span>
                                )}
                              </p>
                            )}

                            {fileEntry.error && (
                              <p className="text-xs text-red-400">{fileEntry.error}</p>
                            )}

                            {/* Similarity */}
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

                            {/* Code Editor */}
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