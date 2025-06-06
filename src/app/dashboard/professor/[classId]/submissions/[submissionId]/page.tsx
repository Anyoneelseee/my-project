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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-javascript";
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
  const [aiPercentage, setAiPercentage] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [similarSubmissions, setSimilarSubmissions] = useState<Submission[]>([]);
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);

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

  const handleRunCode = () => {
    if (!code.trim()) {
      setError((prev) => [...prev, "Code cannot be empty"]);
      return;
    }

    setIsRunning(true);
    setOutput([]);
    setError([]);

    try {
      const originalConsoleLog = console.log;
      let outputLog = "";
      console.log = (message: string | number | boolean) => {
        outputLog += `${message}\n`;
      };
      // eslint-disable-next-line no-eval
      eval(code);
      console.log = originalConsoleLog;
      setOutput(outputLog ? outputLog.split("\n").filter((line) => line) : ["No output"]);
    } catch (err) {
      setError((prev) => [
        ...prev,
        err instanceof Error ? err.message : "An unknown error occurred",
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (!classData) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Class not found.</div>;
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
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-white shadow-sm">
          <SidebarTrigger className="-ml-1 text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="/dashboard/professor"
                  className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors"
                >
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/dashboard/professor/${classId}`}
                  className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors"
                >
                  {classData.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-gray-900 text-sm font-medium">Submission</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gray-100">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-2xl font-semibold text-gray-900">
                  Submission: {fileName}
                </CardTitle>
                <p className="text-sm text-gray-500">Submitted by {studentName}</p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-6">
                  {/* Code Editor and Output */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Code Editor */}
                    <Card className="border border-gray-200 rounded-lg shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900">Code Editor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Label className="text-sm font-medium text-gray-500">JavaScript Code</Label>
                        <AceEditor
                          mode="javascript"
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
                          style={{ width: "100%", height: "400px" }}
                          ref={editorRef}
                          readOnly={isRunning}
                        />
                        <Button
                          onClick={handleRunCode}
                          disabled={isRunning || !code.trim()}
                          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                          {isRunning ? "Running..." : "Run Code"}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Code Output */}
                    <Card className="border border-gray-200 rounded-lg shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900">Output</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto"
                          style={{ width: "100%", height: "400px", whiteSpace: "pre-wrap" }}
                        >
                          {output.length === 0 && error.length === 0 && (
                            <pre className="text-gray-400">Run the code to see the output.</pre>
                          )}
                          {output.map((line, index) => (
                            <div key={`output-${index}`} className="flex items-center">
                              <span>{line}</span>
                            </div>
                          ))}
                          {error.map((line, index) => (
                            <div key={`error-${index}`} className="text-red-400">
                              {line}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Detector */}
                  <Card className="border border-gray-200 rounded-lg shadow-sm w-full">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900">AI Detector</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-[200px] text-gray-500">
                        {aiError ? (
                          <p className="text-red-500">{aiError}</p>
                        ) : aiPercentage !== null ? (
                          <p className="text-lg font-semibold text-gray-900">
                            AI-Generated Percentage: {aiPercentage.toFixed(2)}%
                          </p>
                        ) : (
                          <p>Loading AI detection...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Code Similarity */}
                  <Card className="border border-gray-200 rounded-lg shadow-sm w-full">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900">Code Similarity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {similarSubmissions.length === 0 ? (
                          <p className="text-gray-500 text-center">No similar submissions found.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card className="border border-gray-200 rounded-lg shadow-sm">
                              <CardHeader>
                                <CardTitle className="text-md font-semibold text-gray-900">
                                  Original Submission
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <AceEditor
                                  mode="javascript"
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
                                  style={{ width: "100%", height: "300px" }}
                                />
                              </CardContent>
                            </Card>
                            {similarSubmissions.map((sub, index) => (
                              <Card key={index} className="border border-gray-200 rounded-lg shadow-sm">
                                <CardHeader>
                                  <CardTitle className="text-md font-semibold text-gray-900">
                                    {sub.student_name} - {sub.file_name} (Similarity: {sub.similarity_percentage?.toFixed(2)}%)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <AceEditor
                                    mode="javascript"
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
                                    style={{ width: "100%", height: "300px" }}
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}