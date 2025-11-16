"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import AceEditor from "react-ace";
import { Info } from "lucide-react";

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

interface Submission {
  id: string;
  class_id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  language: string;
  submitted_at: string;
  ai_percentage?: number;
  activity_id?: string;
  similarity_percentage?: number;
  status: string;
  code?: string;
  student_name?: string;
}

interface StudentProfile {
  student_id: string;
  first_name: string;
  last_name: string;
}

const REPLIT_URL = process.env.NEXT_PUBLIC_REPLIT_API_URL || "http://localhost:8080";

export default function SubmissionViewPage() {
  const { classId, submissionId } = useParams();
  const router = useRouter();
  const [allClasses, setAllClasses] = useState<Class[]>([]); // ALL CLASSES
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [output, setOutput] = useState("");
  const [pendingInputs, setPendingInputs] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiPercentage, setAiPercentage] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [similarSubmissions, setSimilarSubmissions] = useState<Submission[]>([]);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  const detectLanguageFromFileName = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "py": return "python";
      case "cpp": return "cpp";
      case "c": return "c";
      case "java": return "java";
      default: return "";
    }
  };

  const startPolling = (sid: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${REPLIT_URL}/output/${sid}`);
        if (!res.ok) return;
        const data = await res.json();
        setOutput(prev => data.output !== prev ? data.output : prev);
        setIsWaitingForInput(data.waiting);
        setIsRunning(!data.done && !data.waiting);
        if (data.done) {
          stopPolling();
          setSessionId(null);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 200);
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const handleRunCode = async () => {
    if (!code.trim() || !language) return;

    stopPolling();
    setOutput("");
    setPendingInputs([]);
    setIsWaitingForInput(false);
    setIsRunning(true);
    setSessionId(null);

    try {
      const res = await fetch(`${REPLIT_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, lang: language }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sid = data.session_id;
      if (!sid) throw new Error("No session ID");
      setSessionId(sid);
      startPolling(sid);
    } catch {
      setOutput("Failed to connect to backend.");
      setIsRunning(false);
    }
  };

  const handleInputSubmit = async () => {
    if (!sessionId || !userInput.trim()) return;
    const input = userInput.trim();
    setUserInput("");
    const echo = language === "python" ? `> ${input}\n` : "";
    setOutput(prev => prev + echo);
    setPendingInputs(prev => [...prev, input]);
    try {
      await fetch(`${REPLIT_URL}/input/${sessionId}`, {
        method: "POST",
        body: input,
      });
    } catch {
      setOutput(prev => prev + "\n[Input failed]\n");
    }
    setIsWaitingForInput(false);
    setIsRunning(true);
  };

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, pendingInputs, isWaitingForInput]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

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
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              router.push("/dashboard/student");
              return;
            }

            // FETCH ALL CLASSES
            const { data: allClassesData, error: allClassesError } = await supabase
              .rpc("get_professor_classes");
            if (allClassesError || !allClassesData || allClassesData.length === 0) {
              router.push("/dashboard/professor");
              return;
            }
            setAllClasses(allClassesData as Class[]);

            // FIND CURRENT CLASS
            const current = allClassesData.find((c: Class) => c.id === classId);
            if (!current) {
              router.push("/dashboard/professor");
              return;
            }
            setCurrentClass(current);

            const [studentId, requestedFileName] = decodeURIComponent(submissionId as string).split("/");
            setFileName(requestedFileName);
            const detectedLang = detectLanguageFromFileName(requestedFileName);
            if (!detectedLang) {
              setError((prev) => [...prev, "Unsupported language detected"]);
            } else {
              setLanguage(detectedLang);
            }

            const { data: studentData, error: studentError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: classId })
              .eq("student_id", studentId);
            if (studentError || !studentData || studentData.length === 0) {
              setError((prev) => [...prev, "Student not found"]);
              setStudentName("Unknown");
            } else {
              const student = studentData[0] as StudentProfile;
              setStudentName(`${student.first_name} ${student.last_name}`.trim());
            }

            const { data: submissionData, error: submissionQueryError } = await supabase
              .from("submissions")
              .select("*")
              .eq("class_id", classId)
              .eq("student_id", studentId)
              .eq("file_name", requestedFileName)
              .maybeSingle();
            if (submissionQueryError || !submissionData) {
              setError((prev) => [...prev, "Submission not found"]);
              return;
            }

            const filePath = submissionData.file_path || `submissions/${current.section}/${studentId}/${submissionData.activity_id}/${submissionData.file_name}`;
            const { data: fileData, error: fileError } = await supabase.storage
              .from("submissions")
              .download(filePath);
            if (fileError) {
              setError((prev) => [...prev, `Failed to load file: ${fileError.message}`]);
              return;
            }
            const text = await fileData.text();
            setCode(text);

            await Promise.all([
              (async () => {
                if (!process.env.NEXT_PUBLIC_AI_DETECTOR_URL) {
                  setAiError("AI detection service unavailable.");
                  return;
                }
                try {
                  const response = await fetch(process.env.NEXT_PUBLIC_AI_DETECTOR_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: text }),
                  });
                  if (!response.ok) throw new Error(`AI detection failed: ${response.statusText}`);
                  const result = await response.json();
                  const percentage = result.ai_percentage || 0;
                  setAiPercentage(percentage);
                  await supabase
                    .from("submissions")
                    .update({ ai_percentage: percentage })
                    .eq("id", submissionData.id);
                } catch (err) {
                  setAiError(err instanceof Error ? err.message : "AI detection failed.");
                }
              })(),
              (async () => {
                if (!submissionData.activity_id) {
                  setError((prev) => [...prev, "Cannot perform similarity detection: No activity associated"]);
                  return;
                }

                const { data: allSubmissions, error: fetchError } = await supabase
                  .from("submissions")
                  .select("*")
                  .eq("class_id", classId)
                  .eq("activity_id", submissionData.activity_id);
                if (fetchError || !Array.isArray(allSubmissions) || allSubmissions.length < 3) {
                  setError((prev) => [
                    ...prev,
                    `Not enough submissions for similarity detection. Found: ${Array.isArray(allSubmissions) ? allSubmissions.length : 0}`,
                  ]);
                  return;
                }

                const submissionsWithCodePromises = allSubmissions.map(async (sub) => {
                  const expectedFilePath = sub.file_path || `submissions/${current.section}/${sub.student_id}/${sub.activity_id}/${sub.file_name}`;
                  const { data: fileData, error: downloadError } = await supabase.storage
                    .from("submissions")
                    .download(expectedFilePath);
                  if (downloadError || !fileData) return null;
                  const codeText = await fileData.text();
                  const { data: studentData } = await supabase
                    .rpc("get_class_student_profiles", { class_id_input: classId })
                    .eq("student_id", sub.student_id);
                  const student = studentData?.[0] as StudentProfile;
                  return codeText && codeText.trim()
                    ? {
                        ...sub,
                        code: codeText,
                        student_name: student ? `${student.first_name} ${student.last_name}`.trim() : "Unknown",
                      }
                    : null;
                });
                const submissionsWithCode = (await Promise.all(submissionsWithCodePromises)).filter(
                  (sub): sub is Submission => sub !== null
                );

                if (submissionsWithCode.length < 3) {
                  setError((prev) => [...prev, `Not enough valid submissions... Found: ${submissionsWithCode.length}`]);
                  return;
                }

                const codes = submissionsWithCode.map((sub) => sub.code);
                if (!process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
                  setError((prev) => [...prev, "Similarity detection service unavailable."]);
                  return;
                }

                const response = await fetch(process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ codes }),
                });
                if (!response.ok) throw new Error(`Similarity detection failed: ${response.statusText}`);
                const result = await response.json();
                const similarities = result.similarities || {};
                const currentCodeIndex = submissionsWithCode.findIndex(
                  (sub) => sub.student_id === studentId && sub.file_name === submissionData.file_name
                );
                const similar = submissionsWithCode
                  .filter((sub, idx) => idx !== currentCodeIndex)
                  .map((sub) => {
                    const originalIdx = submissionsWithCode.findIndex((s) => s.id === sub.id);
                    const key = currentCodeIndex < originalIdx ? `${currentCodeIndex}-${originalIdx}` : `${originalIdx}-${currentCodeIndex}`;
                    return { ...sub, similarity_percentage: similarities[key] || 0 };
                  });
                setSimilarSubmissions(similar);
              })(),
            ]);
          } catch (err) {
            console.error("Unexpected error:", err);
            router.push("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        router.push("/dashboard/professor");
      }
    };

    initialize();
  }, [classId, submissionId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="text-2xl font-bold text-teal-300 animate-pulse">Loading Submission...</div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-teal-300">
        Class not found.
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* ALL CLASSES IN SIDEBAR */}
      <ProfessorSidebar classes={allClasses} />

      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-teal-300 hover:text-teal-400 text-sm font-medium">
                  Professor Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/dashboard/professor/${classId}`} className="text-teal-300 hover:text-teal-400 text-sm font-medium">
                  {currentClass.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">Submission</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-8xl mx-auto space-y-8">

            {/* ULTRA PREMIUM CARD */}
            <Card className="border border-teal-500/30 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-teal-500/20 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 p-6 md:p-8">
                <CardTitle className="text-2xl md:text-3xl font-bold text-teal-400">
                  Submission: <span className="font-mono text-xl">{fileName}</span>
                </CardTitle>
                <p className="text-base md:text-lg text-teal-300">Submitted by <span className="font-semibold">{studentName}</span></p>
              </CardHeader>

              <CardContent className="p-6 md:p-8 space-y-10">

               {/* CODE + CONSOLE — RESPONSIVE HEIGHT */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* CODE EDITOR */}
  <div className="flex flex-col">
    <h3 className="text-xl font-semibold text-teal-400 mb-4">Code Editor</h3>
    <div className="flex-1 border border-teal-500/30 rounded-2xl overflow-hidden bg-gray-800/50 shadow-inner flex flex-col">
      <Label className="px-5 pt-4 block text-sm font-medium text-teal-300">
        Submitted Code ({language || "unknown"})
      </Label>
      <div className="flex-1 p-2">
        <AceEditor
          mode={language === "cpp" || language === "c" ? "c_cpp" : language}
          theme="monokai"
          value={code}
          onChange={setCode}
          name="code-editor"
          editorProps={{ $blockScrolling: true }}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
            fontSize: 15,
            wrap: true,
          }}
          style={{ 
            width: "100%", 
            height: "100%", 
            minHeight: "400px", 
            maxHeight: "70vh"  // ← NEVER TOO BIG
          }}
          readOnly={isRunning}
        />
      </div>
      <div className="p-4 bg-gradient-to-t from-gray-800 to-gray-700">
        <Button
          onClick={handleRunCode}
          disabled={isRunning || !code.trim() || !language}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-xl rounded-xl"
        >
          {isRunning ? "Running..." : "Run Code"}
        </Button>
      </div>
    </div>
  </div>

  {/* CONSOLE — SAME HEIGHT */}
  <div className="flex flex-col">
    <h3 className="text-xl font-semibold text-teal-400 mb-4">Console Output</h3>
    <div className="flex-1 border border-teal-500/30 rounded-2xl bg-gray-800/50 shadow-inner flex flex-col min-h-[400px] max-h-[70vh]">
      <div
        ref={consoleRef}
        className="flex-1 overflow-y-auto font-mono text-sm md:text-base text-green-400 whitespace-pre-wrap p-5"
      >
        {output === "" && !isRunning && <span className="text-gray-500">Run code to see output...</span>}
        <span>{output}</span>
        {language !== "python" && pendingInputs.map((inp, i) => (
          <div key={i} className="text-blue-400">&gt; {inp}</div>
        ))}
        {isRunning && !isWaitingForInput && <div className="text-yellow-400 animate-pulse">Running...</div>}
      </div>
      {isWaitingForInput && (
        <div className="p-4 bg-gradient-to-t from-gray-800 to-gray-700 flex gap-3">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && userInput.trim()) {
                e.preventDefault();
                handleInputSubmit();
              }
            }}
            placeholder="Enter input..."
            className="flex-1 p-4 bg-gray-700 text-white rounded-xl border border-teal-500/30 focus:ring-2 focus:ring-teal-500 focus:outline-none text-base"
            autoFocus
          />
          <Button onClick={handleInputSubmit} disabled={!userInput.trim()} className="px-8 h-14 rounded-xl">
            Submit
          </Button>
        </div>
      )}
    </div>
  </div>
</div>

                {/* DISCLAIMER */}
                <Card className="border-amber-500/40 bg-gradient-to-r from-amber-900/20 to-orange-900/20 backdrop-blur-md shadow-2xl">
                  <CardHeader className="flex flex-row items-start gap-3 pb-3 p-6">
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

                {/* AI RESULT */}
                <div className="border border-teal-500/30 rounded-2xl p-8 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm text-center">
                  <h3 className="text-xl font-semibold text-teal-400 mb-4">AI Code Detection</h3>
                  {aiError ? (
                    <p className="text-red-400 text-lg">{aiError}</p>
                  ) : aiPercentage !== null ? (
                    <div className="space-y-4">
                      <p className="text-5xl font-bold">
                        <span className="text-teal-400">{aiPercentage.toFixed(2)}%</span> AI
                      </p>
                      <p className={`text-2xl font-medium ${aiPercentage > 50 ? "text-red-400" : "text-green-400"}`}>
                        → {aiPercentage > 50 ? "Likely AI-generated" : "Likely human-written"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-teal-300 text-lg animate-pulse">Analyzing code...</p>
                  )}
                </div>

                {/* SIMILARITY */}
                <div className="border border-teal-500/30 rounded-2xl p-8 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm">
                  <h3 className="text-xl font-semibold text-teal-400 mb-6">Code Similarity</h3>
                  {error.some((err) => err.includes("Not enough")) ? (
                    <p className="text-red-400 text-center text-lg">{error.find((err) => err.includes("Not enough"))}</p>
                  ) : similarSubmissions.length === 0 ? (
                    <p className="text-teal-300 text-center text-lg">No similar submissions found.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="border border-teal-500/30 rounded-xl p-4 bg-gray-800/50">
                        <h4 className="text-sm font-semibold text-teal-400 mb-3">Original</h4>
                        <AceEditor
                          mode={language === "cpp" || language === "c" ? "c_cpp" : language}
                          theme="monokai"
                          value={code}
                          name="original"
                          editorProps={{ $blockScrolling: true }}
                          setOptions={{
                            readOnly: true,
                            showLineNumbers: true,
                            tabSize: 2,
                            fontSize: 12,
                            wrap: true,
                          }}
                          style={{ width: "100%", height: "280px", borderRadius: "0.75rem" }}
                        />
                      </div>
                      {similarSubmissions.map((sub, i) => (
                        <div key={i} className="border border-teal-500/30 rounded-xl p-4 bg-gray-800/50">
                          <h4 className="text-sm font-semibold text-teal-400 mb-3 truncate">
                            {sub.student_name} ({sub.similarity_percentage?.toFixed(1)}%)
                          </h4>
                          <AceEditor
                            mode={sub.language === "cpp" || sub.language === "c" ? "c_cpp" : sub.language}
                            theme="monokai"
                            value={sub.code}
                            name={`similar-${i}`}
                            editorProps={{ $blockScrolling: true }}
                            setOptions={{
                              readOnly: true,
                              showLineNumbers: true,
                              tabSize: 2,
                              fontSize: 12,
                              wrap: true,
                            }}
                            style={{ width: "100%", height: "280px", borderRadius: "0.75rem" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}