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
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Transition, Dialog } from "@headlessui/react";

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

interface ExecutionStep {
  id: number;
  inputsSoFar: string[];
  output: string;
  error: string;
  status: string;
  needsInput: boolean;
}

export default function SubmissionViewPage() {
  const { classId, submissionId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
const [currentStep, setCurrentStep] = useState(0);
const [userInput, setUserInput] = useState("");
const [totalInputsNeeded, setTotalInputsNeeded] = useState(0);
const [, setPrompts] = useState<string[]>([]);
  const [aiPercentage, setAiPercentage] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [similarSubmissions, setSimilarSubmissions] = useState<Submission[]>([]);
  const [showApiLimitDialog, setShowApiLimitDialog] = useState(false);
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);

const isWaitingForInput = executionSteps.length > 0 && executionSteps[executionSteps.length - 1].needsInput && !isRunning;
  const languageIdMap: { [key: string]: number } = {
  python: 71,
  cpp: 54,
  c: 50,
  java: 62,
};

const inputPatterns: { [key: string]: RegExp[] } = {
  python: [/input\s*\(\s*\)/g, /input\s*\(\s*("[^"]*"|'[^']*')\s*\)/g, /sys\.stdin\.readline\s*\(\s*\)/g],
  cpp: [/cin\s*>>/g, /getline\s*\(\s*cin\s*,/g],
  c: [/scanf\s*\(/g, /fgets\s*\(/g],
  java: [/scanner\.nextLine\s*\(\s*\)/g, /scanner\.nextInt\s*\(\s*\)/g, /bufferedReader\.readLine\s*\(\s*\)/g],
};

const analyzeInputsNeeded = (code: string, language: string): number => {
  if (!inputPatterns[language]) return 0;
  let inputCount = 0;
  inputPatterns[language].forEach((pattern) => {
    const matches = code.match(pattern) || [];
    inputCount += matches.length;
  });
  return inputCount || 1;
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

  const submitCodeToJudge0 = async (sourceCode: string, langId: number, stdin: string = "") => {
  try {
    const response = await fetch("/api/judge0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        source_code: sourceCode, 
        language_id: langId,
        stdin 
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

  const pollJudge0Result = async (token: string, currentStep: number, totalInputsNeeded: number) => {
  try {
    let attempts = 0;
    const maxAttempts = 20;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    while (attempts < maxAttempts) {
      const response = await fetch(`/api/judge0?token=${token}`);
      if (!response.ok) throw new Error(`Poll failed: ${response.status}`);
      const data = await response.json();

      if (data.status.id > 2) {
        let stdout = "", stderr = "";
        if (data.stdout) stdout = atob(data.stdout).replace(/\0/g, "");
        if (data.stderr) stderr = atob(data.stderr).replace(/\0/g, "");

        const needsInput =
          currentStep < totalInputsNeeded &&
          ((language === "python" && (stderr.includes("EOFError") || stderr.includes("ValueError"))) ||
           (language === "c" || language === "cpp") ||
           (language === "java" && stderr.includes("NoSuchElementException")));

        let displayError = stderr;
        if (needsInput) {
          displayError = stderr.includes("EOFError") || stderr.includes("NoSuchElementException") || (language === "c" || language === "cpp")
            ? "[Info] Waiting for input..."
            : "[Error] Invalid input, please try again";
        }

        const outputLines = (language === "cpp" || language === "c" || language === "java")
          ? stdout.split(/(?<=:\s)/)
          : stdout.split("\n");
        const filteredLines = outputLines.filter((line) => line.trim());
        if (currentStep === 0) setPrompts(filteredLines);

        let newOutput = "";
        if (currentStep < totalInputsNeeded) {
          newOutput = filteredLines[currentStep] || "";
        } else {
          newOutput = filteredLines[filteredLines.length - 1] || "";
        }

        return { stdout: newOutput.trim(), stderr: displayError.trim(), status: data.status.description, needsInput };
      }
      attempts++;
      await delay(1000);
    }
    throw new Error("Execution timed out");
  } catch (err) {
    setConnectionErrorMessage(err instanceof Error ? err.message : "Poll failed");
    setShowConnectionErrorDialog(true);
    return { stdout: "", stderr: err instanceof Error ? err.message : "Unknown error", status: "Error", needsInput: false };
  }
};

  // AFTER pollJudge0Result function, add this:
const executeStep = async (inputsSoFar: string[], step: number, totalInputsNeeded: number) => {
  const langId = languageIdMap[language];
  const stdin = inputsSoFar.join("\n") + (inputsSoFar.length ? "\n" : "");
  const token = await submitCodeToJudge0(code, langId, stdin);
  if (!token) return null;
  return await pollJudge0Result(token, step, totalInputsNeeded);
};

  const handleRunCode = async () => {
  if (!code.trim()) {
    setExecutionSteps((prev) => [...prev, { id: prev.length, inputsSoFar: [], output: "", error: "Code cannot be empty", status: "Error", needsInput: false }]);
    return;
  }
  if (!languageIdMap[language]) {
    setExecutionSteps((prev) => [...prev, { id: prev.length, inputsSoFar: [], output: "", error: `Unsupported language: ${language}`, status: "Error", needsInput: false }]);
    return;
  }

  const inputsNeeded = analyzeInputsNeeded(code, language);
  setTotalInputsNeeded(inputsNeeded);
  setExecutionSteps([]);
  setCurrentStep(0);
  setPrompts([]);
  setIsRunning(true);

  const result = await executeStep([], 0, inputsNeeded);
  if (result) {
    const step: ExecutionStep = { id: 0, inputsSoFar: [], output: result.stdout, error: result.stderr, status: result.status, needsInput: result.needsInput };
    setExecutionSteps([step]);
    setCurrentStep(1);
    setIsRunning(false);
  } else {
    setIsRunning(false);
  }
};

// Add after handleRunCode
const handleInputSubmit = async () => {
  if (!userInput.trim()) return;
  const currentInputs = executionSteps[executionSteps.length - 1]?.inputsSoFar || [];
  const newInputs = [...currentInputs, userInput];
  setIsRunning(true);

  const result = await executeStep(newInputs, currentStep, totalInputsNeeded);
  if (result) {
    const step: ExecutionStep = { id: currentStep, inputsSoFar: newInputs, output: result.stdout, error: result.stderr, status: result.status, needsInput: result.needsInput };
    setExecutionSteps((prev) => [...prev, step]);
    setCurrentStep(currentStep + 1);
    setUserInput("");
    setIsRunning(false);
  } else {
    setExecutionSteps((prev) => [...prev, { id: currentStep, inputsSoFar: newInputs, output: "", error: "[Error] Failed to process inputs", status: "Error", needsInput: false }]);
    setCurrentStep(currentStep + 1);
    setUserInput("");
    setIsRunning(false);
  }
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
            console.log("getUserRole - Profile fetched:", role);
            if (!role || role !== "professor") {
              console.warn("Invalid role or no role found:", role);
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

            const [studentId, requestedFileName] = decodeURIComponent(submissionId as string).split("/");
            setFileName(requestedFileName);
            const detectedLang = detectLanguageFromFileName(requestedFileName);
            if (!detectedLang || !supportedLanguages.includes(detectedLang)) {
              setError((prev) => [...prev, "Unsupported language detected"]);
            } else {
              setLanguage(detectedLang);
            }

            const { data: studentData, error: studentError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: classId })
              .eq("student_id", studentId);
            console.log("Student Data:", studentData);
            if (studentError || !studentData || studentData.length === 0) {
              console.warn("Failed to fetch student:", studentError?.message);
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
            if (submissionQueryError) {
              console.warn("Failed to fetch submission data:", submissionQueryError.message);
              setError((prev) => [...prev, "Submission not found"]);
              return;
            }

            const dbFileName = submissionData.file_name;
            const filePath = submissionData.file_path || `submissions/${classData.section}/${studentId}/${submissionData.activity_id}/${dbFileName}`;
            console.log("Attempting to download file from path:", filePath);
            const { data: fileData, error: fileError } = await supabase.storage
              .from("submissions")
              .download(filePath);
            if (fileError) {
              console.warn("Failed to fetch submission file:", fileError.message, "Path:", filePath);
              setError((prev) => [...prev, `Failed to load submission file: ${fileError.message}`]);
              return;
            }
            const text = await fileData.text();
            setCode(text);

            await Promise.all([
              (async () => {
                console.log("Attempting AI detection...");
                if (!process.env.NEXT_PUBLIC_AI_DETECTOR_URL) {
                  console.error("NEXT_PUBLIC_AI_DETECTOR_URL is not defined");
                  setAiError("AI detection service unavailable.");
                  return;
                }
                try {
                  const response = await fetch(process.env.NEXT_PUBLIC_AI_DETECTOR_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: text }),
                  });
                  console.log("AI API Response:", response.status);
                  if (!response.ok) throw new Error(`AI detection failed: ${response.statusText}`);
                  const result = await response.json();
                  console.log("AI detection result:", result);
                  const percentage = result.ai_percentage || 0;
                  setAiPercentage(percentage);
                  await supabase
                    .from("submissions")
                    .update({ ai_percentage: percentage })
                    .eq("id", submissionData.id);
                } catch (err) {
                  console.error("AI detection error:", err);
                  setAiError(err instanceof Error ? err.message : "AI detection failed.");
                }
              })(),
              (async () => {
                if (!submissionData.activity_id) {
                  console.warn("No activity_id found for submission");
                  setError((prev) => [...prev, "Cannot perform similarity detection: No activity associated"]);
                  return;
                }

                const { data: allSubmissions, error: fetchError } = await supabase
                  .from("submissions")
                  .select("*")
                  .eq("class_id", classId)
                  .eq("activity_id", submissionData.activity_id);
                if (fetchError) {
                  console.warn("Failed to fetch submissions for similarity:", fetchError.message);
                  setError((prev) => [...prev, "Failed to fetch submissions for similarity detection"]);
                  return;
                }

                if (allSubmissions.length < 3) {
                  console.warn("Not enough submissions for similarity detection:", allSubmissions.length);
                  setError((prev) => [
                    ...prev,
                    `Not enough submissions for similarity detection (minimum 3 required). Found: ${allSubmissions.length}`,
                  ]);
                  return;
                }

                const submissionsWithCodePromises = allSubmissions.map(async (sub) => {
                  const expectedFilePath =
                    sub.file_path || `submissions/${classData.section}/${sub.student_id}/${sub.activity_id}/${sub.file_name}`;
                  const { data: fileData, error: downloadError } = await supabase.storage
                    .from("submissions")
                    .download(expectedFilePath);
                  if (downloadError) {
                    console.warn("Failed to download submission file:", downloadError.message);
                    return null;
                  }
                  const codeText = await fileData.text();
                  const { data: studentData } = await supabase
                    .rpc("get_class_student_profiles", { class_id_input: classId })
                    .eq("student_id", sub.student_id);
                  const student = studentData?.[0] as StudentProfile;
                  return codeText && typeof codeText === "string" && codeText.trim()
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
                console.log(
                  "Submissions with code for activity:",
                  submissionsWithCode.map((s) => `${s.student_name} - ${s.file_name}`)
                );

                if (submissionsWithCode.length < 3) {
                  console.warn("Not enough valid submissions for similarity detection:", submissionsWithCode.length);
                  setError((prev) => [
                    ...prev,
                    `Not enough valid submissions for similarity detection (minimum 3 required). Found: ${submissionsWithCode.length}`,
                  ]);
                  return;
                }

                const codes = submissionsWithCode.map((sub) => sub.code);
                if (!process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL) {
                  console.error("NEXT_PUBLIC_SIMILARITY_DETECTOR_URL is not defined");
                  setError((prev) => [...prev, "Similarity detection service unavailable."]);
                  return;
                }

                const response = await fetch(process.env.NEXT_PUBLIC_SIMILARITY_DETECTOR_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ codes }),
                });
                console.log("Similarity API Response:", response.status);
                if (!response.ok) throw new Error(`Similarity detection failed: ${response.statusText}`);
                const result = await response.json();
                console.log("Similarity detection result:", result);
                const similarities = result.similarities || {};
                const currentCodeIndex = submissionsWithCode.findIndex(
                  (sub) => sub.student_id === studentId && sub.file_name === dbFileName
                );
                console.log("Current code index:", currentCodeIndex, "for", `${studentId}/${dbFileName}`);
                const similar = submissionsWithCode
                  .filter((sub, idx) => idx !== currentCodeIndex) // Exclude self
                  .map((sub) => {
                    const originalIdx = submissionsWithCode.findIndex((s) => s.id === sub.id);
                    const key =
                      currentCodeIndex < originalIdx
                        ? `${currentCodeIndex}-${originalIdx}`
                        : `${originalIdx}-${currentCodeIndex}`;
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
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        Loading...
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        Class not found.
      </div>
    );
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
                <CardTitle className="text-2xl font-semibold text-teal-400">Submission: {fileName}</CardTitle>
                <p className="text-sm text-teal-300">Submitted by {studentName}</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                      <h3 className="text-lg font-semibold text-teal-400 mb-2">Code Editor</h3>
                      <Label className="text-sm font-medium text-teal-300">
                        Submitted Code ({language || "unknown"})
                      </Label>
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
  {isRunning ? "Running..." : "Run"}
</Button>
                    </div>
                    <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
  <h3 className="text-lg font-semibold text-teal-400 mb-2">Console Output</h3>
  <div className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto font-mono text-sm" style={{ width: "100%", height: "350px" }}>
    {executionSteps.length === 0 && <span className="text-gray-500">Run code to see output...</span>}
    {executionSteps.map((step) => (
      <div key={step.id} className="mb-3">
        {step.output && <div className="text-green-400">{step.output}</div>}
        {step.inputsSoFar.map((input, i) => (
          <div key={i} className="text-blue-400">&gt; {input}</div>
        ))}
        {step.error && <div className="text-red-400">{step.error}</div>}
      </div>
    ))}
    {isRunning && <div className="text-yellow-400">[Executing...]</div>}
  </div>
  {isWaitingForInput && (
    <div className="flex gap-2 mt-2">
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
        placeholder={`Input ${currentStep}/${totalInputsNeeded}`}
        className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 focus:ring-2 focus:ring-teal-500"
        disabled={isRunning}
      />
      <Button onClick={handleInputSubmit} disabled={isRunning || !userInput.trim()} size="sm">
        Submit
      </Button>
    </div>
  )}
</div>
                  </div>
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
                  <div className="border border-teal-500/20 rounded-lg p-4 bg-gray-700/50">
                    <h3 className="text-lg font-semibold text-teal-400 mb-2">Code Similarity</h3>
                    <div className="space-y-2">
                      {error.some((err) =>
                        err.includes("Not enough valid submissions for similarity detection")
                      ) ? (
                        <p className="text-red-400 text-center">
                          {error.find((err) =>
                            err.includes("Not enough valid submissions for similarity detection")
                          )}
                        </p>
                      ) : similarSubmissions.length === 0 ? (
                        <p className="text-teal-300 text-center">No similar submissions found.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="border border-teal-500/20 rounded-lg p-3 bg-gray-800/50">
                            <h4 className="text-md font-semibold text-teal-400 mb-2">Original Submission</h4>
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
                                {sub.student_name} - {sub.file_name} (Similarity:{" "}
                                {sub.similarity_percentage?.toFixed(2)}%)
                              </h4>
                              <AceEditor
                                mode={
                                  sub.language === "cpp" || sub.language === "c"
                                    ? "c_cpp"
                                    : sub.language === "java"
                                    ? "java"
                                    : sub.language === "python"
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
                        className="text-teal-400 hover:underline"
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
                        className="text-teal-400 hover:underline"
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