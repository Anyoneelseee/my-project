"use client";

import React, { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp"; // Supports both C and C++
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Dialog, Transition } from "@headlessui/react";

const Playground: React.FC = () => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showApiLimitDialog, setShowApiLimitDialog] = useState(false);
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const [showUnsupportedLanguageDialog, setShowUnsupportedLanguageDialog] = useState(false);

  const languageIdMap: { [key: string]: number } = {
    python: 71, // Python 3
    cpp: 54,    // C++
    c: 50,      // C
    java: 62,   // Java
  };

  const supportedLanguages = Object.keys(languageIdMap);

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

  const handleCompile = async () => {
    if (!code.trim()) {
      setError((prev) => [...prev, "Code cannot be empty"]);
      return;
    }

    if (!languageIdMap[language]) {
      setShowUnsupportedLanguageDialog(true);
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

  const handleSave = () => {
    if (!code.trim()) {
      setError((prev) => [...prev, "Code cannot be empty to save"]);
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
    setOutput((prev) => [...prev, `Code saved locally as ${fileName}`]);
  };

  const handleReturn = () => {
    router.back();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 text-gray-900">
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    API Limit Reached
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      You’ve reached the maximum number of code execution requests (50 per day). Please wait 24
                      hours to run more code. For concerns or inquiries, contact the developer at:
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-blue-600 hover:underline ml-1"
                      >
                        jbgallego3565qc@student.fatima.edu.ph
                      </a>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    Connection Error
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      {connectionErrorMessage} Please check your internet connection and try again. If the issue
                      persists, contact support at:
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-blue-600 hover:underline ml-1"
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

      <Transition appear show={showUnsupportedLanguageDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowUnsupportedLanguageDialog(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    Unsupported Language
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      The language &apos;{language}&apos; is not supported. Currently supported languages are:
                      <ul className="list-disc list-inside mt-2">
                        {supportedLanguages.map((lang) => (
                          <li key={lang} className="text-gray-600">{lang}</li>
                        ))}
                      </ul>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                      onClick={() => setShowUnsupportedLanguageDialog(false)}
                    >
                      OK
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <div className="flex justify-end items-center mb-6">
        <button
          onClick={handleReturn}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
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

      <Card className="shadow-lg border-none rounded-xl bg-white">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-2xl font-semibold text-gray-900">Interactive Code Editing</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-gray-900">Select Language</Label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setOutput([]);
                  setError([]);
                }}
                className="w-40 p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                disabled={isRunning}
              >
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-900">Code Editor</Label>
                <AceEditor
                  mode={
                    language === "cpp" || language === "c"
                      ? "c_cpp"
                      : language === "java"
                      ? "java"
                      : "python"
                  }
                  theme="vertical"
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
                    onClick={handleCompile}
                    disabled={isRunning || !code.trim()}
                    className="w-1/2 bg-[#5d659b] hover:bg-[#4f57a5] text-white rounded-lg shadow-md transition-all duration-200"
                  >
                    {isRunning ? "Running..." : "Compile and Run"}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isRunning || !code.trim()}
                    className="w-1/2 bg-[#e4e5e8] hover:bg-[#d1d3d6] text-gray-900 rounded-lg shadow-md transition-all duration-200"
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-900">Output</Label>
                <div
                  className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto"
                  style={{ width: "100%", height: "500px", whiteSpace: "pre-wrap" }}
                >
                  {output.length === 0 && error.length === 0 && !isRunning && (
                    <pre className="text-gray-400">Run the code to see the output.</pre>
                  )}
                  {output.map((line, index) => (
                    <div key={index} className="flex items-center">
                      <span>{line}</span>
                    </div>
                  ))}
                  {error.map((line, index) => (
                    <div key={`error-${index}`} className="text-red-400">{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Playground;