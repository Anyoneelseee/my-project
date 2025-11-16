// src/app/dashboard/student/bulk-ai-checker/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, Upload, Trash2, AlertTriangle, CheckCircle2, FileCode, Sparkles, Clock, AlertCircle } from "lucide-react";
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
  [fileName: string]: number;
}

interface FileWithResult {
  file: File;
  code: string;
  aiPercentage: number | null;
  error: string | null;
  similarity: SimilarityResult | { error: string } | null;
  cached?: boolean;
  language: string;
}

const SUPPORTED_EXT: Record<string, string> = {
  py: "python",
  cpp: "cpp",
  c: "c",
  java: "java",
};

export default function BulkAICheckerPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [files, setFiles] = useState<FileWithResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [languageWarning, setLanguageWarning] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const detectedLanguages = useMemo(() => {
    const valid = files.filter(f => !f.error && f.code.trim());
    return Array.from(new Set(valid.map(f => f.language)));
  }, [files]);

  useEffect(() => {
    if (detectedLanguages.length > 1) {
      setLanguageWarning(`Mixed languages detected: ${detectedLanguages.join(", ")}. Only one language allowed.`);
    } else {
      setLanguageWarning(null);
    }
  }, [detectedLanguages]);

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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) redirect("/login");

            const role = await getUserRole();
            if (role !== "student") redirect("/dashboard/student");

            const { data, error } = await supabase.rpc("get_student_classes");
            if (!error && Array.isArray(data)) {
              setClasses(data.filter((c): c is Class => c && typeof c.id === "string" && typeof c.name === "string"));
            }
          } catch {
            redirect("/dashboard/student");
          } finally {
            setIsLoading(false);
          }
        };
      } catch {
        redirect("/dashboard/student");
      }
    };

    initialize();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 10) {
      setUserError("Maximum 10 files allowed.");
      return;
    }

    const newFiles: FileWithResult[] = [];
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const language = ext ? SUPPORTED_EXT[ext] : undefined;

      if (!language) {
        newFiles.push({
          file, code: "", aiPercentage: null, error: `Unsupported file: ${file.name}`, similarity: null, language: "unknown"
        });
        continue;
      }

      try {
        const code = await file.text();
        newFiles.push({
          file,
          code,
          aiPercentage: null,
          error: code.trim() ? null : "File is empty",
          similarity: null,
          language,
        });
      } catch {
        newFiles.push({ file, code: "", aiPercentage: null, error: "Failed to read file", similarity: null, language });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setUserError(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckAIAndSimilarity = async () => {
    if (languageWarning || !process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
      setUserError(languageWarning || "AI service not ready.");
      return;
    }

    setIsProcessing(true);
    setUserError(null);
    const updatedFiles = [...files];
    const validFiles = updatedFiles.filter(f => !f.error && f.code.trim());

    if (validFiles.length === 0) {
      setUserError("No valid files to check.");
      setIsProcessing(false);
      return;
    }

    // AI CHECK
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);

      const res = await fetch("/api/bulk-ai-detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: validFiles.map(f => f.code) }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) throw new Error(await res.text());

      const results = await res.json();
      let idx = 0;
      for (let i = 0; i < updatedFiles.length; i++) {
        if (!updatedFiles[i].error && updatedFiles[i].code.trim()) {
          const r = results[idx++] || {};
          updatedFiles[i].aiPercentage = r.ai_percentage ?? null;
          updatedFiles[i].error = r.error ?? null;
          updatedFiles[i].cached = r.cached;
        }
      }
    }catch (err: unknown) {
  const e = err as Error;
  const isTimeout = e.name === "AbortError";
  
  for (let i = 0; i < updatedFiles.length; i++) {
    if (!updatedFiles[i].error && updatedFiles[i].code.trim()) {
      updatedFiles[i].error = isTimeout
        ? "AI check timed out. Try fewer files."
        : "AI check failed.";
      updatedFiles[i].aiPercentage = null;
    }
  }
}


    // SIMILARITY
    const validAfterAI = updatedFiles.filter(f => !f.error && f.code.trim());
    if (validAfterAI.length > 1) {
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes: validAfterAI.map(f => f.code) }),
        });
        if (!res.ok) throw new Error();
        const { similarities = {} } = await res.json();
        updatedFiles.forEach((f, i) => {
          if (!f.error && f.code.trim()) {
            const sim: SimilarityResult = {};
            updatedFiles.forEach((o, j) => {
              if (i !== j && !o.error && o.code.trim()) {
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                sim[o.file.name] = similarities[key] ?? 0;
              }
            });
            updatedFiles[i].similarity = sim;
          }
        });
      } catch {
        updatedFiles.forEach((f, i) => {
          if (!f.error && f.code.trim()) updatedFiles[i].similarity = { error: "Similarity check failed." };
        });
      }
    } else if (validAfterAI.length === 1) {
      validAfterAI[0].similarity = { error: "Need 2+ files for similarity." };
    }

    setFiles(updatedFiles);
    setIsProcessing(false);
  };

  const getEditorMode = (lang: string) => lang === "c" || lang === "cpp" ? "c_cpp" : lang;

  // RESTORED: Line-by-line AI annotations
  const getLineAnnotations = (code: string, ai: number | null): IAnnotation[] => {
    if (ai === null || !code) return [];
    const lines = code.split("\n");
    return lines.map((_, i) => ({
      row: i,
      column: 0,
      type: ai > 50 ? "error" : "info",
      text: ai > 50 ? "Likely AI-generated" : "Likely human-written",
    }));
  };

  const getLineMarkers = (ai: number | null): IMarker[] => {
    if (ai === null) return [];
    return [{
      startRow: 0,
      endRow: 1000,
      startCol: 0,
      endCol: 0,
      className: ai > 50 ? "ai-line" : "human-line",
      type: "fullLine",
    }];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-14 w-14 text-teal-400 animate-pulse" />
          <p className="text-teal-300 text-xl font-medium">Initializing AI Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <StudentSidebar classes={classes} />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 items-center gap-3 px-4 border-b border-teal-500/20 bg-gray-900/95 backdrop-blur-xl">
          <SidebarTrigger className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-400 transition-all" />
          <Separator orientation="vertical" className="h-6 bg-teal-500/30" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/student" className="text-teal-300 hover:text-teal-400">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 font-semibold">Bulk AI Checker</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex-1 p-4 md:p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* PREMIUM DISCLAIMER CARD */}
            <Card className="border-amber-500/40 bg-gradient-to-r from-amber-900/20 to-orange-900/20 backdrop-blur-md shadow-2xl">
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                <Info className="h-6 w-6 text-amber-400 mt-0.5" />
                <div>
                  <CardTitle className="text-lg font-bold text-amber-300">AI Detection Disclaimer</CardTitle>
                  <p className="text-sm text-amber-200 leading-relaxed mt-1">
                    This tool <strong>estimates</strong> if code was generated by AI. 
                    Results are <strong>not 100% accurate</strong> and should <strong>never be used alone</strong> to judge student work. 
                    Always perform manual code review for fairness and integrity.
                  </p>
                </div>
              </CardHeader>
            </Card>

            {/* User Error */}
            {userError && (
              <Alert className="border-red-500/50 bg-red-900/20 text-red-300">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{userError}</AlertDescription>
              </Alert>
            )}

            {/* Language Warning */}
            {languageWarning && (
              <Alert className="border-orange-500/50 bg-orange-900/20 text-orange-300">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Language Mismatch</AlertTitle>
                <AlertDescription>{languageWarning}</AlertDescription>
              </Alert>
            )}

            {/* Upload Zone */}
            <Card className="border-teal-500/30 bg-gray-800/60 backdrop-blur-md shadow-xl">
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-teal-500/40 rounded-xl p-10 text-center hover:border-teal-400/60 transition-all group">
                    <Input
                      type="file"
                      multiple
                      accept=".py,.c,.cpp,.java"
                      onChange={handleFileChange}
                      className="hidden"
                      id="upload"
                      disabled={isProcessing || files.length >= 10}
                    />
                    <Label htmlFor="upload" className="cursor-pointer space-y-4">
                      <div className="mx-auto w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                        <Upload className="h-10 w-10 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-teal-300">Drop files here or click</p>
                        <p className="text-sm text-teal-400 mt-1">Max 10 files • .py, .c, .cpp, .java</p>
                      </div>
                    </Label>
                  </div>

                  <Button
                    onClick={handleCheckAIAndSimilarity}
                    disabled={isProcessing || files.length === 0 || !!languageWarning || !!userError}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-3">
                        <Clock className="h-6 w-6 animate-spin" />
                        Processing Files...
                      </span>
                    ) : (
                      "Run AI & Similarity Check"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {files.length === 0 ? (
                <Card className="border-teal-500/20 bg-gray-800/50 p-16 text-center">
                  <FileCode className="mx-auto h-20 w-20 text-teal-400/40 mb-4" />
                  <p className="text-teal-300 text-lg">Upload your code files to begin</p>
                </Card>
              ) : (
                files.map((f, i) => (
                  <Card key={i} className="border-teal-500/30 bg-gray-800/60 backdrop-blur-md shadow-2xl overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/50 font-mono">
                            {f.language.toUpperCase()}
                          </Badge>
                          <p className="font-semibold text-teal-300 truncate max-w-[220px] md:max-w-xl">{f.file.name}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveFile(i)}
                          disabled={isProcessing}
                          className="text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">

                      {/* AI Result */}
                      {f.aiPercentage !== null ? (
                        <div className="flex items-center gap-4 text-xl font-bold">
                          <span className={f.aiPercentage > 50 ? "text-red-400" : "text-green-400"}>
                            AI: {f.aiPercentage.toFixed(1)}%
                          </span>
                          {f.cached && (
                            <Badge className="bg-green-900/50 text-green-300 text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" /> CACHED
                            </Badge>
                          )}
                          {f.aiPercentage > 50 ? (
                            <AlertCircle className="h-6 w-6 text-red-400 animate-pulse" />
                          ) : (
                            <CheckCircle2 className="h-6 w-6 text-green-400" />
                          )}
                        </div>
                      ) : f.error ? (
                        <p className="text-red-400 text-sm flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          {f.error}
                        </p>
                      ) : null}

                      {/* Similarity */}
                      {f.similarity && "error" in f.similarity ? (
                        <p className="text-orange-400 text-sm">{f.similarity.error}</p>
                      ) : f.similarity && Object.keys(f.similarity).length > 0 ? (
                        <div className="text-sm space-y-1 p-3 bg-gray-700/30 rounded-lg">
                          <p className="text-teal-300 font-medium">Similarity Matches:</p>
                          {Object.entries(f.similarity).map(([name, pct]) => (
                            <div key={name} className="flex justify-between text-teal-400">
                              <span className="truncate max-w-[200px]">{name}</span>
                              <span className="font-mono">{pct.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Code Editor with Line Annotations */}
                      <div className="rounded-lg overflow-hidden border border-teal-500/30 shadow-inner">
                        <AceEditor
                          mode={getEditorMode(f.language)}
                          theme="monokai"
                          value={f.code}
                          readOnly
                          name={`editor-${i}`}
                          width="100%"
                          height="260px"
                          fontSize={13.5}
                          showPrintMargin={false}
                          annotations={getLineAnnotations(f.code, f.aiPercentage)}
                          markers={getLineMarkers(f.aiPercentage)}
                          setOptions={{
                            showLineNumbers: true,
                            tabSize: 2,
                            wrap: true,
                            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                            highlightActiveLine: false,
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </SidebarInset>

      <style jsx global>{`
        .ace_annotation { font-size: 11px !important; }
        .ai-line { background: rgba(239, 68, 68, 0.22) !important; }
        .human-line { background: rgba(34, 197, 94, 0.18) !important; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #14b8a6; border-radius: 4px; }
      `}</style>
    </SidebarProvider>
  );
}