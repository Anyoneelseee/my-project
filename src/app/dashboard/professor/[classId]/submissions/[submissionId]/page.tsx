"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Fragment } from "react";
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
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Transition, Dialog } from "@headlessui/react"; // Import Headless UI components

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface Submission {
  student_id: string;
  file_name: string;
  code: string;
  student_name: string;
  similarity_percentage?: number;
}

interface StudentProfile {
  student_id: string;
  first_name: string;
  last_name: string;
}

interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export default function SubmissionViewPage() {
  const { classId, submissionId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [code, setCode] = useState<string>("");
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [aiPercentage, setAiPercentage] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [similarSubmissions, setSimilarSubmissions] = useState<Submission[]>([]);
  const [showApiLimitDialog, setShowApiLimitDialog] = useState(false); // Used now
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false); // Used now
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);

  const languageIdMap: { [key: string]: number } = {
    python: 71, // Python 3
    cpp: 54,    // C++
    c: 50,      // C
    java: 62,   // Java
  };

  const supportedLanguages = Object.keys(languageIdMap);

  const detectLanguageFromFileName = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "py":
        return "python";
      case "cpp":
        return "cpp";
      case "c":
        return "c";
      case "java":
        return "java";
      default:
        return "";
    }
  };

  const submitCodeToJudge0 = async (sourceCode: string, langId: number) => {
    try {
      const response = await fetch("/api/judge0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: langId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setShowApiLimitDialog(true);
          setIsRunning(false);
          return null;
        }
        const errorMessage = await response.text();
        throw new Error(`Judge0 submission failed: ${response.statusText} - ${errorMessage}`);
      }

      const data = await response.json();
      return data.token;
    } catch (err) {
      setConnectionErrorMessage(
        err instanceof Error ? err.message : "Failed to connect to the code execution server."
      );
      setShowConnectionErrorDialog(true);
      setIsRunning(false);
      return null;
    }
  };

  const pollJudge0Result = async (token: string): Promise<{ stdout: string; stderr: string; status: string }> => {
    try {
      let attempts = 0;
      const maxAttempts = 20;
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        const response = await fetch(`/api/judge0?token=${token}`);
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(`Judge0 polling failed: ${response.statusText} - ${errorMessage}`);
        }

        const data = await response.json();
        if (data.status.id > 2) {
          return {
            stdout: data.stdout || "",
            stderr: data.stderr || "",
            status: data.status.description,
          };
        }

        attempts++;
        await delay(1000);
      }

      throw new Error("Code execution timed out");
    } catch (err) {
      setConnectionErrorMessage(
        err instanceof Error ? err.message : "Failed to retrieve code execution results."
      );
      setShowConnectionErrorDialog(true);
      setIsRunning(false);
      return { stdout: "", stderr: "Execution timed out or failed", status: "Error" };
    }
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      setError((prev) => [...prev, "Code cannot be empty"]);
      return;
    }

    if (!languageIdMap[language]) {
      setError((prev) => [...prev, "Unsupported language"]);
      return;
    }

    setIsRunning(true);
    setOutput([]);
    setError([]);

    const langId = languageIdMap[language];
    const token = await submitCodeToJudge0(code, langId);
    if (!token) return;

    const result = await pollJudge0Result(token);
    if (result.stdout) {
      setOutput(result.stdout.split("\n").filter((line) => line));
    }
    if (result.stderr) {
      setError((prev) => [...prev, result.stderr]);
    }
    setIsRunning(false);
  };

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
              router.push("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              console.warn("Auth error:", authError?.message);
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              console.warn("Invalid role or no role found");
              router.push("/dashboard/student");
              return;
            }

            const { data: classDataArray, error: classError } = await supabase
              .rpc("get_professor_classes")
              .eq("id", classId);

            if (classError || !classDataArray || classDataArray.length === 0) {
              console.warn("Failed to fetch class:", classError?.message);
              router.push("/dashboard/professor");
              return;
            }

            const classData = classDataArray[0] as Class;
            setClassData(classData);

            const [studentId, fileName] = decodeURIComponent(submissionId as string).split("/");
            setFileName(fileName);
            const detectedLang = detectLanguageFromFileName(fileName);
            if (!detectedLang || !supportedLanguages.includes(detectedLang)) {
              setError((prev) => [...prev, "Unsupported language detected"]);
            } else {
              setLanguage(detectedLang);
            }

            const { data: studentData, error: studentError } = (await supabase
              .rpc("get_class_student_profiles", { class_id_input: classId })
              .eq("student_id", studentId)) as { data: StudentProfile[]; error: SupabaseError | null };

            if (studentError || !studentData || studentData.length === 0) {
              console.warn("Failed to fetch student:", studentError?.message);
              setError((prev) => [...prev, "Student not found"]);
              return;
            }

            const student = studentData[0];
            setStudentName(`${student.first_name} ${student.last_name}`.trim());

            const filePath = `submissions/${classData.section}/${studentId}/${fileName}`;
            const { data: fileData, error: fileError } = await supabase.storage
              .from("submissions")
              .download(filePath);

            if (fileError) {
              console.warn("Failed to fetch submission file:", fileError.message);
              setError((prev) => [...prev, "Failed to load submission file"]);
              return;
            }

            const text = await fileData.text();
            setCode(text);

            // Check if AI percentage already exists
            const { data: submissionData, error: submissionError } = await supabase
              .from("submissions")
              .select("ai_percentage")
              .eq("class_id", classId)
              .eq("student_id", studentId)
              .eq("file_name", fileName)
              .single();

            if (submissionError) {
              console.warn("Failed to fetch submission data:", submissionError.message);
            }

            if (submissionData && submissionData.ai_percentage !== null) {
              setAiPercentage(submissionData.ai_percentage);
            } else {
              try {
                if (!process.env.NEXT_PUBLIC_AI_DETECTOR_URL) {
                  throw new Error("NEXT_PUBLIC_AI_DETECTOR_URL is not defined");
                }
                const response = await fetch(process.env.NEXT_PUBLIC_AI_DETECTOR_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: text }),
                });

                if (!response.ok) {
                  throw new Error(`AI detection failed: ${response.statusText}`);
                }

                const result = await response.json();
                const percentage = result.ai_percentage || 0;
                setAiPercentage(percentage);

                const { error: updateError } = await supabase
                  .from("submissions")
                  .update({ ai_percentage: percentage })
                  .eq("class_id", classId)
                  .eq("student_id", studentId)
                  .eq("file_name", fileName);

                if (updateError) {
                  console.warn("Failed to save AI percentage:", updateError.message);
                }
              } catch (err) {
                console.warn("AI detection error:", err);
                setAiError("Failed to run AI detection.");
              }
            }

            // Fetch all submissions for similarity detection
            const { data: allSubmissions, error: fetchError } = await supabase
              .from("submissions")
              .select("student_id, file_name, file_path")
              .eq("class_id", classId);

            if (fetchError) {
              console.warn("Failed to fetch submissions for similarity:", fetchError.message);
              return;
            }

            const submissionsWithCodePromises = allSubmissions.map(async (sub) => {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from("submissions")
                .download(sub.file_path);
              if (downloadError) {
                console.warn("Failed to download submission file:", downloadError.message);
                return null;
              }
              const codeText = await fileData.text();
              const { data: studentData, error: studentError } = (await supabase
                .rpc("get_class_student_profiles", { class_id_input: classId })
                .eq("student_id", sub.student_id)) as { data: StudentProfile[]; error: SupabaseError | null };
              if (studentError || !studentData || studentData.length === 0) {
                console.warn("Failed to fetch student for submission:", studentError?.message);
                return null;
              }
              const student = studentData[0];
              if (!codeText || typeof codeText !== "string" || !codeText.trim()) {
                console.warn(`Skipping submission for ${sub.student_id}/${sub.file_name}: invalid code content`);
                return null;
              }
              return {
                student_id: sub.student_id,
                file_name: sub.file_name,
                code: codeText,
                student_name: `${student.first_name} ${student.last_name}`.trim(),
              } as Submission;
            });

            const submissionsWithCode = (await Promise.all(submissionsWithCodePromises)).filter(
              (sub): sub is Submission => sub !== null
            );

            if (submissionsWithCode.length < 2) {
              console.warn("Not enough valid submissions for similarity detection:", submissionsWithCode.length);
              setError((prev) => [...prev, "Not enough valid submissions for similarity detection (minimum 2 required)."]);
              return;
            }

            const codes = submissionsWithCode.map((sub) => sub.code);
            console.log("Sending codes to /similarity:", codes);

            try {
              if (!process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
                throw new Error("NEXT_PUBLIC_SIMILARITY_DETECTOR_URL is not defined");
              }
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
              const currentCodeIndex = submissionsWithCode.findIndex(
                (sub) => sub.student_id === studentId && sub.file_name === fileName
              );
              const similar = submissionsWithCode
                .filter((sub, idx) => idx !== currentCodeIndex) // Exclude self
                .map((sub, idx) => {
                  const similarityKey =
                    currentCodeIndex < idx ? `${currentCodeIndex}-${idx}` : `${idx}-${currentCodeIndex}`;
                  const similarityPercentage = similarities[similarityKey] || 0;
                  return {
                    ...sub,
                    similarity_percentage: similarityPercentage,
                  };
                });
              setSimilarSubmissions(similar);
            } catch (err) {
              console.warn("Similarity detection error:", err);
              setError((prev) => [...prev, "Failed to run similarity detection."]);
            }
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
    return <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">Loading...</div>;
  }

  if (!classData) {
    return <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">Class not found.</div>;
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar
        classes={[
          {
            id: classId as string,
            name: classData.name,
            section: classData.section,
            course: classData.course,
            code: classData.code,
          },
        ]}
      />
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
                <BreadcrumbLink
                  href={`/dashboard/professor/${classId}`}
                  className="text-teal-300 hover:text-teal-400 text-sm font-medium transition-colors"
                >
                  {classData.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">Submission</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-4">
            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-2xl font-semibold text-teal-400">
                  Submission: {fileName}
                </CardTitle>
                <p className="text-sm text-teal-300">Submitted by {studentName}</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                  {/* Code Editor and Output */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Code Editor */}
                    <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                      <h3 className="text-lg font-semibold text-teal-400 mb-2">Code Editor</h3>
                      <Label className="text-sm font-medium text-teal-300">Submitted Code ({language || "unknown"})</Label>
                      <AceEditor
                        mode={
                          language === "cpp" || language === "c"
                            ? "c_cpp"
                            : language === "java"
                            ? "java"
                            : language === "python"
                            ? "python"
                            : "text"
                        }
                        theme="monokai"
                        value={code}
                        onChange={(newCode) => setCode(newCode)}
                        name="code-editor"
                        editorProps={{ $blockScrolling: true }}
                        setOptions={{
                          enableBasicAutocompletion: true,
                          enableLiveAutocompletion: true,
                          enableSnippets: true,
                          showLineNumbers: true,
                          tabSize: 2,
                          fontSize: 14,
                          wrap: true,
                        }}
                        style={{ width: "100%", height: "350px" }}
                        ref={editorRef}
                        readOnly={isRunning}
                      />
                      <Button
                        onClick={handleRunCode}
                        disabled={isRunning || !code.trim() || !languageIdMap[language]}
                        className="mt-4 w-full bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                      >
                        {isRunning ? "Running..." : "Run Code"}
                      </Button>
                    </div>

                    {/* Code Output */}
                    <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                      <h3 className="text-lg font-semibold text-teal-400 mb-2">Output</h3>
                      <div
                        className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto"
                        style={{ width: "100%", height: "350px", whiteSpace: "pre-wrap" }}
                      >
                        {output.length === 0 && error.length === 0 && (
                          <pre className="text-teal-300">Run the code to see the output.</pre>
                        )}
                        {output.map((line, index) => (
                          <div key={`output-${index}`} className="flex items-center text-teal-300">
                            <span>{line}</span>
                          </div>
                        ))}
                        {error.map((line, index) => (
                          <div key={`error-${index}`} className="text-red-400">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Detector */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <h3 className="text-lg font-semibold text-teal-400 mb-2">AI Detector</h3>
                    <div className="flex items-center justify-center h-[100px] text-teal-300">
                      {aiError ? (
                        <p className="text-red-400">{aiError}</p>
                      ) : aiPercentage !== null ? (
                        <p className="text-md font-semibold text-teal-400">
                          AI-Generated Percentage: {aiPercentage.toFixed(2)}%
                        </p>
                      ) : (
                        <p>Loading AI detection...</p>
                      )}
                    </div>
                  </div>

                  {/* Code Similarity */}
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <h3 className="text-lg font-semibold text-teal-400 mb-2">Code Similarity</h3>
                    <div className="space-y-2">
                      {similarSubmissions.length === 0 ? (
                        <p className="text-teal-300 text-center">No similar submissions found.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="border border-teal-500/20 rounded-lg p-3 bg-gray-800/50">
                            <h4 className="text-md font-semibold text-teal-400 mb-2">
                              Original Submission
                            </h4>
                            <AceEditor
                              mode={
                                language === "cpp" || language === "c"
                                  ? "c_cpp"
                                  : language === "java"
                                  ? "java"
                                  : language === "python"
                                  ? "python"
                                  : "text"
                              }
                              theme="monokai"
                              value={code}
                              name="original-editor"
                              editorProps={{ $blockScrolling: true }}
                              setOptions={{
                                readOnly: true,
                                showLineNumbers: true,
                                tabSize: 2,
                                fontSize: 12,
                                wrap: true,
                              }}
                              style={{ width: "100%", height: "250px" }}
                            />
                          </div>
                          {similarSubmissions.map((sub, index) => (
                            <div key={index} className="border border-teal-500/20 rounded-lg p-3 bg-gray-800/50">
                              <h4 className="text-md font-semibold text-teal-400 mb-2">
                                {sub.student_name} - {sub.file_name} (Similarity: {sub.similarity_percentage?.toFixed(2)}%)
                              </h4>
                              <AceEditor
                                mode={
                                  detectLanguageFromFileName(sub.file_name) === "cpp" || detectLanguageFromFileName(sub.file_name) === "c"
                                    ? "c_cpp"
                                    : detectLanguageFromFileName(sub.file_name) === "java"
                                    ? "java"
                                    : detectLanguageFromFileName(sub.file_name) === "python"
                                    ? "python"
                                    : "text"
                                }
                                theme="monokai"
                                value={sub.code}
                                name={`similar-editor-${index}`}
                                editorProps={{ $blockScrolling: true }}
                                setOptions={{
                                  readOnly: true,
                                  showLineNumbers: true,
                                  tabSize: 2,
                                  fontSize: 12,
                                  wrap: true,
                                }}
                                style={{ width: "100%", height: "250px" }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>

      {/* API Limit Dialog */}
      <Transition appear show={showApiLimitDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowApiLimitDialog(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-teal-400">
                    API Limit Reached
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">
                      You’ve reached the maximum number of code execution requests (50 per day). Please wait 24 hours to
                      run more code. For concerns or inquiries, contact the developer at:{" "}
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-teal-400 hover:underline ml-1"
                      >
                        jbgallego3565qc@student.fatima.edu.ph
                      </a>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                      onClick={() => setShowApiLimitDialog(false)}
                    >
                      Understood
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Connection Error Dialog */}
      <Transition appear show={showConnectionErrorDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConnectionErrorDialog(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-teal-400">
                    Connection Error
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">
                      {connectionErrorMessage} Please check your internet connection and try again. If the issue
                      persists, contact support at:{" "}
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-teal-400 hover:underline ml-1"
                      >
                        jbgallego3565qc@student.fatima.edu.ph
                      </a>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={() => setShowConnectionErrorDialog(false)}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </SidebarProvider>
  );
}