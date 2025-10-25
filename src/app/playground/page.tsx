"use client";

import React, { useState, Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Dialog, Transition } from "@headlessui/react";
import { PlayIcon } from "@heroicons/react/24/solid";

// Default code templates
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
    name[strcspn(name, "\\n")] = 0; // Remove newline
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

// Input pattern detectors for each language
const inputPatterns: { [key: string]: RegExp[] } = {
  python: [/input\s*\(\s*\)/g, /input\s*\(\s*("[^"]*"|'[^']*')\s*\)/g, /sys\.stdin\.readline\s*\(\s*\)/g],
  cpp: [/cin\s*>>/g, /getline\s*\(\s*cin\s*,/g],
  c: [/scanf\s*\(/g, /fgets\s*\(/g],
  java: [/scanner\.nextLine\s*\(\s*\)/g, /scanner\.nextInt\s*\(\s*\)/g, /bufferedReader\.readLine\s*\(\s*\)/g],
};

interface ExecutionStep {
  id: number;
  inputsSoFar: string[];
  output: string;
  error: string;
  status: string;
  needsInput: boolean;
}

const Playground: React.FC = () => {
  const router = useRouter();
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
  const [, setPrompts] = useState<string[]>([]);

  const languageIdMap: { [key: string]: number } = {
    python: 71,
    cpp: 54,
    c: 50,
    java: 62,
  };

  // Analyze code to estimate number of inputs needed
  const analyzeInputsNeeded = (code: string, language: string): number => {
    if (!inputPatterns[language]) return 0;

    let inputCount = 0;
    inputPatterns[language].forEach((pattern) => {
      const matches = code.match(pattern) || [];
      inputCount += matches.length;
    });

    console.log("analyzeInputsNeeded: code =", JSON.stringify(code), "matches =", code.match(inputPatterns[language][0]), "inputCount =", inputCount);
    return inputCount || 1; // Fallback to 1 if no inputs detected
  };

  const submitCodeToJudge0 = async (sourceCode: string, langId: number, stdin: string) => {
    try {
      const response = await fetch("/api/judge0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: langId,
          stdin,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setShowApiLimitDialog(true);
          return null;
        }
        const errorMessage = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorMessage}`);
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
        console.log("Judge0 response:", JSON.stringify(data, null, 2));
        if (data.status.id > 2) {
          let stdout = "";
          let stderr = "";
          if (data.stdout) {
            try {
              stdout = atob(data.stdout).replace(/\0/g, "");
            } catch {
              stdout = data.stdout.replace(/\0/g, "");
            }
          }
          if (data.stderr) {
            try {
              stderr = atob(data.stderr).replace(/\0/g, "");
            } catch {
              stderr = data.stderr.replace(/\0/g, "");
            }
          }
          // Handle needsInput for Python, C/C++, and Java
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
          // Parse stdout for prompts and results
          const outputLines = (language === "cpp" || language === "c" || language === "java") ? stdout.split(/(?<=:\s)/) : stdout.split("\n");
          const filteredLines = outputLines.filter((line) => line.trim());
          if (currentStep === 0) {
            setPrompts(filteredLines); // Store all prompts for reference
          }
          // Select output based on currentStep
          let newOutput = "";
          if (currentStep < totalInputsNeeded) {
            newOutput = filteredLines[currentStep] || "";
          } else {
            newOutput = filteredLines[filteredLines.length - 1] || "";
          }
          console.log("pollJudge0Result: needsInput =", needsInput, "currentStep =", currentStep, "totalInputsNeeded =", totalInputsNeeded, "filteredLines =", filteredLines);
          return {
            stdout: newOutput.trim(),
            stderr: displayError.trim(),
            status: data.status.description,
            needsInput,
          };
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
    console.log("executeStep: Submitting with stdin:", JSON.stringify(stdin), "totalInputsNeeded =", totalInputsNeeded);
    const token = await submitCodeToJudge0(code, langId, stdin);
    if (!token) return null;

    const result = await pollJudge0Result(token, step, totalInputsNeeded);
    console.log("Execution step result:", JSON.stringify(result, null, 2));
    return result;
  };

  const handleRun = async () => {
    if (!code.trim()) {
      setExecutionSteps((prev) => [
        ...prev,
        {
          id: prev.length,
          inputsSoFar: [],
          output: "",
          error: "Code cannot be empty",
          status: "Error",
          needsInput: false,
        },
      ]);
      return;
    }

    if (!languageIdMap[language]) {
      setExecutionSteps((prev) => [
        ...prev,
        {
          id: prev.length,
          inputsSoFar: [],
          output: "",
          error: `Unsupported language: ${language}`,
          status: "Error",
          needsInput: false,
        },
      ]);
      return;
    }

    const inputsNeeded = analyzeInputsNeeded(code, language);
    console.log("Inputs needed:", inputsNeeded);
    setTotalInputsNeeded(inputsNeeded);
    setExecutionSteps([]);
    setCurrentStep(0);
    setPrompts([]);
    setIsRunning(true);

    const result = await executeStep([], 0, inputsNeeded);
    console.log("handleRun result:", JSON.stringify(result, null, 2));
    if (result) {
      const step: ExecutionStep = {
        id: 0,
        inputsSoFar: [],
        output: result.stdout,
        error: result.stderr,
        status: result.status,
        needsInput: result.needsInput,
      };
      setExecutionSteps([step]);
      setCurrentStep(1);
      setIsRunning(false);
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
    console.log("handleInputSubmit result:", JSON.stringify(result, null, 2));
    if (result) {
      const step: ExecutionStep = {
        id: currentStep,
        inputsSoFar: newInputs,
        output: result.stdout,
        error: result.stderr,
        status: result.status,
        needsInput: result.needsInput,
      };
      setExecutionSteps((prev) => [...prev, step]);
      setCurrentStep(currentStep + 1);
      setUserInput("");
      setIsRunning(false);
    } else {
      setExecutionSteps((prev) => [
        ...prev,
        {
          id: currentStep,
          inputsSoFar: newInputs,
          output: "",
          error: "[Error] Failed to process inputs",
          status: "Error",
          needsInput: false,
        },
      ]);
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
      setExecutionSteps((prev) => [
        ...prev,
        {
          id: prev.length,
          inputsSoFar: [],
          output: "",
          error: "Code cannot be empty to save",
          status: "Error",
          needsInput: false,
        },
      ]);
      return;
    }

    const extension = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
    const fileName = `code-${Date.now()}.${extension}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExecutionSteps((prev) => [
      ...prev,
      {
        id: prev.length,
        inputsSoFar: [],
        output: `[Saved] Code saved as ${fileName}`,
        error: "",
        status: "Accepted",
        needsInput: false,
      },
    ]);
  };

  const handleReturn = () => {
    router.back();
  };

  // Force re-render when needsInput changes to ensure input field appears
  useEffect(() => {
    if (executionSteps.length > 0 && executionSteps[executionSteps.length - 1].needsInput) {
      console.log("useEffect: Forcing re-render for input field, currentStep =", currentStep, "totalInputsNeeded =", totalInputsNeeded);
    }
  }, [executionSteps, currentStep, totalInputsNeeded]);

  // Show input field when needsInput is true
  const isWaitingForInput = executionSteps.length > 0 && executionSteps[executionSteps.length - 1].needsInput && !isRunning;

  // Global styles
  const styles = `
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
    #__next {
      height: 100%;
      min-height: 100vh;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200 p-4">
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
                        You’ve reached the maximum number of code execution requests (50 per day). Please wait 24 hours to run more code. For concerns, contact:
                        <a href="mailto:jbgallego3565qc@student.fatima.edu.ph" className="text-teal-400 hover:underline ml-1">
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
                        {connectionErrorMessage} Please check your internet connection and try again. Contact support at:
                        <a href="mailto:jbgallego3565qc@student.fatima.edu.ph" className="text-teal-400 hover:underline ml-1">
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

        <div className="flex justify-start mb-6">
          <button
            onClick={handleReturn}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-br from-teal-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:from-teal-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Return
          </button>
        </div>

        <Card className="shadow-lg border-teal-500/20 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
          <CardHeader className="border-b border-gray-600/30">
            <CardTitle className="text-2xl font-semibold text-teal-400">Code Editor</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-200">Select Language</Label>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setCode(codeTemplates[e.target.value]);
                    handleClear();
                  }}
                  className="w-40 p-2 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 bg-gray-700/50"
                  disabled={isRunning}
                >
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Label className="text-sm font-medium text-gray-200">Code Editor</Label>
                  <AceEditor
                    mode={language === "cpp" || language === "c" ? "c_cpp" : language === "java" ? "java" : "python"}
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
                    style={{ width: "100%", height: "500px", borderRadius: "8px" }}
                    readOnly={isRunning}
                  />
                  <div className="flex gap-4 mt-4">
                    <Button
                      onClick={handleRun}
                      disabled={isRunning || !code.trim()}
                      className="w-1/3 bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-lg shadow-md transition-all duration-200 flex items-center justify-center"
                    >
                      <PlayIcon className="h-5 w-5 mr-2" />
                      {isRunning ? "Running..." : "Run"}
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isRunning || !code.trim()}
                      className="w-1/3 bg-gray-700/50 hover:bg-gray-600 text-gray-200 rounded-lg shadow-md transition-all duration-200"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={handleClear}
                      disabled={isRunning}
                      className="w-1/3 bg-gray-700/50 hover:bg-gray-600 text-gray-200 rounded-lg shadow-md transition-all duration-200"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-200">Console</Label>
                  <div className="p-2 border border-gray-600 rounded-lg bg-gray-900">
                    <pre
                      className="text-gray-200 whitespace-pre-wrap"
                      style={{ minHeight: "400px", maxHeight: "400px", overflowY: "auto" }}
                    >
                      {executionSteps.length === 0 && (
                        <span className="text-gray-400">Run code to see output...</span>
                      )}
                      {executionSteps.map((step) => (
                        <div key={step.id}>
                          {step.output && (
                            <div key={`${step.id}-out`} className="text-green-400">
                              {step.output}
                            </div>
                          )}
                          {step.inputsSoFar.map((input, i) => (
                            <div key={`${step.id}-in-${i}`} className="text-blue-400">
                              &gt; {input}
                            </div>
                          ))}
                          {step.error && (
                            <div key={`${step.id}-err`} className="text-red-400">
                              {step.error}
                            </div>
                          )}
                        </div>
                      ))}
                      {isRunning && <div className="text-yellow-400">[Executing...]</div>}
                    </pre>
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
                          className="flex-1 p-2 border border-gray-600 rounded-lg text-gray-200 bg-gray-700/50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder={`Input ${Math.min(currentStep, totalInputsNeeded)}/${totalInputsNeeded}`}
                          disabled={isRunning}
                        />
                        <Button
                          onClick={handleInputSubmit}
                          disabled={isRunning || !userInput.trim()}
                          className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg shadow-md transition-all duration-200"
                        >
                          Submit
                        </Button>
                      </div>
                    )}
                    {executionSteps.length > 0 && (
                      <div className="text-sm text-gray-400 mt-2">
                        Step {Math.min(currentStep, totalInputsNeeded)}/{totalInputsNeeded} - Inputs needed: {totalInputsNeeded}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Playground;