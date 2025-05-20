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

            const { data: studentData, error: studentError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: classId })
              .eq("student_id", studentId);

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
      eval(code);
      console.log = originalConsoleLog;
      setOutput(outputLog ? outputLog.split("\n").filter(line => line) : ["No output"]);
    } catch (err) {
      setError((prev) => [...prev, err instanceof Error ? err.message : "An unknown error occurred"]);
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
      <ProfessorSidebar classes={[{ id: classId as string, name: classData.name, section: classData.section, course: classData.course, code: classData.code }]} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-white shadow-sm">
          <SidebarTrigger className="-ml-1 text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/dashboard/professor/${classId}`} className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
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
                            <div key={`error-${index}`} className="text-red-400">{line}</div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Detector Placeholder */}
                  <Card className="border border-gray-200 rounded-lg shadow-sm w-full">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900">AI Detector</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-[200px] text-gray-500">
                        <p>AI Detection Results (Coming Soon)</p>
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
