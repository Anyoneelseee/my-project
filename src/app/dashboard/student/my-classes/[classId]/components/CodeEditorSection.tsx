"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, Transition } from "@headlessui/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import {
  PlayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/solid";

interface Activity {
  id: string;
  title: string | null;
  description: string;
  image_url: string | null;
  start_time: string | null;
  deadline: string | null;
}

interface ExecutionStep {
  id: number;
  inputsSoFar: string[];
  output: string;
  error: string;
  status: string;
  needsInput: boolean;
}

const codeTemplates: { [key: string]: string } = {
  python: `print("Enter your name:")
name = input()
print("Enter your age:")
age = int(input())
print(f"Hello {name}, you are {age} years old!")`,
  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "Enter your name: ";
    getline(cin, name);
    int age;
    cout << "Enter your age: ";
    cin >> age;
    cout << "Hello " << name << ", you are " << age << " years old!" << endl;
    return 0;
}`,
  c: `#include <stdio.h>
#include <string.h>

int main() {
    char name[100];
    int age;
    printf("Enter your name: ");
    fgets(name, 100, stdin);
    name[strcspn(name, "\\n")] = 0;
    printf("Enter your age: ");
    scanf("%d", &age);
    printf("Hello %s, you are %d years old!\\n", name, age);
    return 0;
}`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.print("Enter your age: ");
        int age = scanner.nextInt();
        System.out.println("Hello " + name + ", you are " + age + " years old!");
    }
}`,
};

const inputPatterns: { [key: string]: RegExp[] } = {
  python: [/input\s*\(\s*\)/g, /input\s*\(\s*("[^"]*"|'[^']*')\s*\)/g, /sys\.stdin\.readline\s*\(\s*\)/g],
  cpp: [/cin\s*>>/g, /getline\s*\(\s*cin\s*,/g],
  c: [/scanf\s*\(/g, /fgets\s*\(/g],
  java: [/scanner\.nextLine\s*\(\s*\)/g, /scanner\.nextInt\s*\(\s*\)/g, /bufferedReader\.readLine\s*\(\s*\)/g],
};

interface CodeEditorSectionProps {
  classId: string;
  activityId?: string | null;
  onSubmitSuccess?: () => void;
}

export default function CodeEditorSection({
  classId,
  activityId: propActivityId,
  onSubmitSuccess,
}: CodeEditorSectionProps) {
  const params = useSearchParams();
  const activityId = params.get("activityId") ?? propActivityId;
    const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

   const [activity, setActivity] = useState<Activity | null>(null);
  const [signedImg, setSignedImg] = useState<string | null>(null);
  const [code, setCode] = useState(codeTemplates.python);
  const [language, setLanguage] = useState("python");
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [totalInputsNeeded, setTotalInputsNeeded] = useState(0);
  const [showApiLimitDialog, setShowApiLimitDialog] = useState(false);
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, setPrompts] = useState<string[]>([]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.warn("Fullscreen failed:", err);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const enter = async () => {
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } catch  {
          console.warn("Auto fullscreen blocked (user interaction needed)");
        }
      }
    };
    const timer = setTimeout(enter, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

   

  const init = useRef(false);
  const languageIdMap: { [key: string]: number } = { python: 71, cpp: 54, c: 50, java: 62 };

    useEffect(() => {
    if (!activityId || init.current) return;
    init.current = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: act } = await supabase
        .from("activities")
        .select("*")
        .eq("id", activityId)
        .single();
      if (act) {
        setActivity(act);
        if (act.image_url && !act.image_url.includes("null")) {
          const { data: signed } = await supabase.storage
            .from("activity-images")
            .createSignedUrl(act.image_url, 3600);
          setSignedImg(signed?.signedUrl ?? null);
        }
      }

      const { data: secData } = await supabase.rpc("get_student_class_section", {
        class_id_input: classId,
        student_id_input: session.user.id,
      });
      if (secData?.[0]?.section) {
        setSection(secData[0].section);
        setIsEnrolled(true);
      }
    };
    load();
  }, [activityId, classId]);

    const logActivity = async (action: string) => {
    if (!isEnrolled) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from("activity_logs").insert({
      class_id: classId,
      student_id: session.user.id,
      action,
      activity_id: activityId,
    });
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

  const submitCodeToJudge0 = async (sourceCode: string, langId: number, stdin: string) => {
    try {
      const response = await fetch("/api/judge0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_code: sourceCode, language_id: langId, stdin }),
      });
      if (!response.ok) {
        if (response.status === 429) {
          setShowApiLimitDialog(true);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      return data.token;
    } catch (err) {
      setConnectionErrorMessage(err instanceof Error ? err.message : "Submission failed");
      setShowConnectionErrorDialog(true);
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
          let stdout = "";
          let stderr = "";
          if (data.stdout) {
            try { stdout = atob(data.stdout).replace(/\0/g, ""); }
            catch { stdout = data.stdout.replace(/\0/g, ""); }
          }
          if (data.stderr) {
            try { stderr = atob(data.stderr).replace(/\0/g, ""); }
            catch { stderr = data.stderr.replace(/\0/g, ""); }
          }

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

  const executeStep = async (inputsSoFar: string[], step: number, totalInputsNeeded: number) => {
    const langId = languageIdMap[language];
    const stdin = inputsSoFar.join("\n") + (inputsSoFar.length ? "\n" : "");
    const token = await submitCodeToJudge0(code, langId, stdin);
    if (!token) return null;
    return await pollJudge0Result(token, step, totalInputsNeeded);
  };

    const handleRun = async () => {
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
      logActivity("Run Code");
    } else {
      setIsRunning(false);
    }
  };

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

  const handleClear = () => {
    setExecutionSteps([]);
    setCurrentStep(0);
    setUserInput("");
    setTotalInputsNeeded(0);
    setPrompts([]);
    setIsRunning(false);
  };

  const handleSave = () => {
    if (!code.trim()) {
      setExecutionSteps((prev) => [...prev, { id: prev.length, inputsSoFar: [], output: "", error: "Code cannot be empty to save", status: "Error", needsInput: false }]);
      return;
    }
    const ext = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setExecutionSteps((prev) => [...prev, { id: prev.length, inputsSoFar: [], output: `[Saved] Code saved as code-${Date.now()}.${ext}`, error: "", status: "Accepted", needsInput: false }]);
    logActivity("Saved Code");
  };

    const isWaitingForInput = executionSteps.length > 0 && executionSteps[executionSteps.length - 1].needsInput && !isRunning;

  const handleSubmitCode = async () => {
    if (!activityId || !code.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Please log in.");
      const ext = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
      const fileName = `submission_${Date.now()}.${ext}`;
      const res = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          files: [{ fileName, language, code }], 
          classId, 
          activityId, 
          section, 
          studentId: session.user.id, 
          refreshToken: session.refresh_token 
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setExecutionSteps((prev) => [...prev, {
        id: prev.length,
        inputsSoFar: [],
        output: "Submitted successfully!",
        error: "",
        status: "Success",
        needsInput: false
      }]);

      onSubmitSuccess?.();
      logActivity("Submitted Code");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200 overflow-hidden flex flex-col"
    >
      {/* Fullscreen Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          onClick={toggleFullscreen}
          size="sm"
          variant="ghost"
          className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white"
        >
          {isFullscreen ? (
            <ArrowsPointingInIcon className="h-5 w-5" />
          ) : (
            <ArrowsPointingOutIcon className="h-5 w-5" />
          )}
          <span className="ml-2">{isFullscreen ? "Exit" : "Fullscreen"}</span>
        </Button>
      </div>

      {/* Activity */}
{activity && (
  <Card className="mb-6 rounded-xl bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-teal-500/30 p-5 shadow-lg">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-teal-400">{activity.title ?? "Untitled"}</CardTitle>
      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold text-white ${activity.deadline && new Date(activity.deadline) < new Date() ? "bg-red-500" : "bg-teal-500"}`}>
        {activity.deadline && new Date(activity.deadline) < new Date() ? "Overdue" : "In Progress"}
      </span>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <p className="bg-gray-700/50 px-3 py-1 rounded-full w-fit text-teal-300">Start: {activity.start_time ? new Date(activity.start_time).toLocaleString() : "—"}</p>
        <p className="bg-gray-700/50 px-3 py-1 rounded-full w-fit text-teal-300">Deadline: {activity.deadline ? new Date(activity.deadline).toLocaleString() : "—"}</p>
      </div>
      {signedImg && <Image src={signedImg} alt="Activity" width={600} height={400} className="rounded-lg max-h-64 w-full object-contain border border-teal-500/30" unoptimized />}
      <p className="text-sm text-gray-200 bg-gray-800/50 p-4 rounded-lg">{activity.description || "No description."}</p>
    </CardContent>
  </Card>
)}

      {/* Editor + Console */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 bg-gray-800/50 border-b border-gray-700">
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setCode(codeTemplates[e.target.value]);
                handleClear();
              }}
              disabled={isRunning}
              className="p-2 text-sm rounded bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-teal-500"
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="java">Java</option>
            </select>
          </div>

          <div className="flex-1 p-3 pb-0">
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
                showLineNumbers: true,
                tabSize: 2,
                fontSize: 16,
                wrap: true,
              }}
              style={{ width: "100%", height: "100%" }}
              readOnly={isRunning}
            />
          </div>

          <div className="p-3 bg-gray-800/50 border-t border-gray-700 flex gap-2">
            <Button onClick={handleRun} disabled={isRunning || !code.trim()} className="flex-1 bg-teal-600 hover:bg-teal-700">
              <PlayIcon className="h-5 w-5 mr-2" />
              {isRunning ? "Running..." : "Run"}
            </Button>
            <Button onClick={handleSave} disabled={isRunning || !code.trim()} variant="outline" className="flex-1 bg-teal-600 hover:bg-teal-700">
              Save
            </Button>
            <Button onClick={handleClear} disabled={isRunning} variant="outline" className="flex-1 bg-teal-600 hover:bg-teal-700">
              Clear
            </Button>
          </div>
        </div>

        <div className="lg:w-96 flex flex-col border-l border-gray-700">
          <div className="p-3 bg-gray-800/50 border-b border-gray-700">
            <h3 className="font-semibold text-teal-400">Console Output</h3>
          </div>
          <div className="flex-1 p-3 bg-gray-900 overflow-y-auto font-mono text-sm">
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
            <div className="p-3 bg-gray-800/50 border-t border-gray-700 flex gap-2">
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
placeholder={`Input ${currentStep}/${totalInputsNeeded}`}                className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 focus:ring-2 focus:ring-teal-500"
                disabled={isRunning}
              />
              <Button onClick={handleInputSubmit} disabled={isRunning || !userInput.trim()} size="sm">
                Submit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      {activityId && (
        <div className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-teal-500/30">
          <div className="max-w-md">
            {isSubmitting ? (
              <div className="bg-gray-700 h-12 rounded-lg animate-pulse flex items-center justify-center">
                <span className="text-teal-400">Submitting...</span>
              </div>
            ) : (
              <Button
                onClick={handleSubmitCode}
                disabled={isSubmitting || !code.trim()}
               className="bg-green-600 hover:bg-green-700 text-lg font-bold py-3 px-6"
              >
                Submit Activity
              </Button>
            )}
            {submitError && <p className="mt-2 text-red-400 text-center">{submitError}</p>}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Transition appear show={showApiLimitDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowApiLimitDialog(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-teal-400">API Limit Reached</Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">You’ve reached the maximum number of code execution requests (50 per day). Please wait 24 hours.</p>
                  </div>
                  <div className="mt-4">
                    <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600" onClick={() => setShowApiLimitDialog(false)}>
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
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-teal-400">Connection Error</Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">{connectionErrorMessage}</p>
                  </div>
                  <div className="mt-4">
                    <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" onClick={() => setShowConnectionErrorDialog(false)}>
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

