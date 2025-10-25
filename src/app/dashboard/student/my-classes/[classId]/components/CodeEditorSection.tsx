"use client";

import { useState, useRef, useEffect, Fragment, SetStateAction } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AceEditor from "react-ace";
import { supabase } from "@/lib/supabase";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Dialog, Transition } from "@headlessui/react";

interface CodeEditorSectionProps {
  classId: string;
}

interface Judge0Response {
  token: string;
}

interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  status: { id: number; description: string };
}

export default function CodeEditorSection({ classId }: CodeEditorSectionProps) {
  const [code, setCode] = useState<string>("");
  const [output, setOutput] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>("python");
  const [isRunning, setIsRunning] = useState(false);
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [error, setError] = useState<string[]>([]);
  const [showApiLimitDialog, setShowApiLimitDialog] = useState(false);
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const [showUnsupportedLanguageDialog, setShowUnsupportedLanguageDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fileNameInput, setFileNameInput] = useState("");
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInitialized = useRef(false);

  const languageIdMap: { [key: string]: number } = {
    python: 71,
    cpp: 54,
    c: 50,
    java: 62,
  };

  const supportedLanguages = Object.keys(languageIdMap);

  const submitCodeToJudge0 = async (sourceCode: string, langId: number): Promise<string | null> => {
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

      const data: Judge0Response = await response.json();
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

        const data: Judge0Result = await response.json();
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
    if (!token) {
      setIsRunning(false);
      return;
    }

    const result = await pollJudge0Result(token);
    if (result.stdout) {
      setOutput(result.stdout.split("\n").filter((line) => line));
    }
    if (result.stderr) {
      setError((prev) => [...prev, result.stderr]);
    }
    setIsRunning(false);

    await logActivity("Run Code");
  };

  const logActivity = async (action: string, retries = 2) => {
    if (!isEnrolled) {
      console.log("Skipping log activity: User is not enrolled in the class.");
      return;
    }

    try {
      console.log("Attempting to log activity:", { classId, action });
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        console.warn("No authenticated session:", sessionError?.message);
        setError((prev) => [...prev, "Please log in to perform actions."]);
        return;
      }

      const userId = session.user.id;
      console.log("User ID:", userId, "Class ID:", classId);

      const { error: insertError } = await supabase
        .from("activity_logs")
        .insert({
          class_id: classId,
          student_id: userId,
          action,
          activity_id: null,
        });

      if (insertError) {
        console.warn("Failed to insert log:", insertError.message, insertError.details);
        if (retries > 0) {
          console.log("Retrying log insert:", { action, retries });
          setTimeout(() => logActivity(action, retries - 1), 1000);
        } else {
          setError((prev) => [...prev, "Failed to log activity. Ensure you are authorized for this class."]);
        }
      } else {
        console.log("Successfully logged activity:", { classId, userId, action });
      }
    } catch (err) {
      console.error("Unexpected error logging activity:", err);
      setError((prev) => [...prev, "An unexpected error occurred."]);
    }
  };

  useEffect(() => {
    if (fetchInitialized.current) return;

    async function fetchSectionAndSubmissions() {
      try {
        console.log("Fetching for classId:", classId);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session for submissions:", sessionError?.message);
          setError((prev) => [...prev, "Please log in to view submissions."]);
          return;
        }

        console.log("Current User ID:", session.user.id);

        type SectionResult = {
          section: string | null;
          error_message: string | null;
        };

        const { data: sectionData, error: sectionError } = await supabase
          .rpc("get_student_class_section", {
            class_id_input: classId,
            student_id_input: session.user.id,
          });

        console.log("RPC Data:", sectionData, "Error:", sectionError);

        if (sectionError) {
          console.error("Section fetch error:", sectionError.message);
          setError((prev) => [...prev, "Failed to fetch class information."]);
          return;
        }

        const result: SectionResult = Array.isArray(sectionData) && sectionData.length > 0
          ? sectionData[0]
          : { section: null, error_message: "No data returned" };

        console.log("Processed Result:", result);

        if (!result.section || result.error_message) {
          console.error("No section found for class:", classId, "Error:", result.error_message);
          setError((prev) => [...prev, "You are not enrolled in this class."]);
        } else {
          const sectionName = result.section;
          setSection(sectionName);
          setIsEnrolled(true);
          console.log("Section set to:", sectionName, "isEnrolled set to:", true);
        }

        if (section) {
          const folderPath = `submissions/${section}/${session.user.id}`;
          const { data, error } = await supabase.storage
            .from("submissions")
            .list(folderPath, {
              limit: 100,
              offset: 0,
              sortBy: { column: "created_at", order: "desc" },
            });

          if (error) {
            console.error("Failed to fetch submissions:", error.message);
            setError((prev) => [...prev, "Failed to load submissions."]);
            return;
          }

          setSubmissions(data.map((file) => file.name));
        }
      } catch (err) {
        console.error("Error listing submissions:", err);
        setError((prev) => [...prev, "An unexpected error occurred while loading submissions."]);
      } finally {
        fetchInitialized.current = true;
      }
    }

    fetchSectionAndSubmissions();
  }, [classId, section]);

  useEffect(() => {
    if (isEnrolled && section && !fetchInitialized.current) {
      logActivity("Component Mounted");
    }
  }, [isEnrolled, section]);

  const handleSaveCode = () => {
    if (!code.trim()) {
      setError((prev) => [...prev, "Code cannot be empty to save"]);
      return;
    }

    const extension = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
    const defaultFileName = `code-${classId}-${Date.now()}.${extension}`;
    setFileNameInput(defaultFileName);
    setShowSaveDialog(true);
  };

  const confirmSaveCode = () => {
    if (!fileNameInput.trim()) {
      setError((prev) => [...prev, "File name cannot be empty"]);
      return;
    }

    const extension = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
    const finalFileName = fileNameInput.endsWith(`.${extension}`) ? fileNameInput : `${fileNameInput}.${extension}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logActivity("Saved Code");
    setShowSaveDialog(false);
    setFileNameInput("");
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (newCode.trim()) {
        logActivity("Started Typing");
      }
    }, 5000);
  };

  return (
    <div className="p-6 w-full text-white">
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-extrabold text-teal-400">
                    API Limit Reached
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">
                      You’ve reached the maximum number of code execution requests (50 per day). Please wait 24
                      hours to run more code. For concerns or inquiries, contact the developer at:
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-teal-400 hover:text-teal-300 ml-1 transition-colors"
                      >
                        jbgallego3565qc@student.fatima.edu.ph
                      </a>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 px-4 py-2 text-sm font-medium text-white focus:outline-none transition-all duration-200"
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-extrabold text-teal-400">
                    Connection Error
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">
                      {connectionErrorMessage} Please check your internet connection and try again. If the issue
                      persists, contact support at:
                      <a
                        href="mailto:jbgallego3565qc@student.fatima.edu.ph"
                        className="text-teal-400 hover:text-teal-300 ml-1 transition-colors"
                      >
                        jbgallego3565qc@student.fatima.edu.ph
                      </a>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white focus:outline-none transition-all duration-200"
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-extrabold text-teal-400">
                    Unsupported Language
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">
                      The language &apos;{language}&apos; is not supported. Currently supported languages are:
                      <ul className="list-disc list-inside mt-2">
                        {supportedLanguages.map((lang) => (
                          <li key={lang} className="text-gray-200">{lang}</li>
                        ))}
                      </ul>
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-lg bg-yellow-600 hover:bg-yellow-700 px-4 py-2 text-sm font-medium text-white focus:outline-none transition-all duration-200"
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

      <Transition appear show={showSaveDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSaveDialog(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-extrabold text-teal-400">
                    Save Code
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-200">Enter a file name for your code:</p>
                    <Input
                      value={fileNameInput}
                      onChange={(e: { target: { value: SetStateAction<string>; }; }) => setFileNameInput(e.target.value)}
                      className="mt-2 bg-gray-700/50 border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="Enter file name"
                    />
                  </div>
                  <div className="mt-4 flex gap-4">
                    <button
                      type="button"
                      className="w-1/2 inline-flex justify-center rounded-lg bg-gray-700/50 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-white focus:outline-none transition-all duration-200"
                      onClick={() => {
                        setShowSaveDialog(false);
                        setFileNameInput("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="w-1/2 inline-flex justify-center rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 px-4 py-2 text-sm font-medium text-white focus:outline-none transition-all duration-200"
                      onClick={confirmSaveCode}
                    >
                      Save
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Card className="border-none rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold text-teal-400">Interactive Monitoring Code Editor</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-gray-200">Select Language</Label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setOutput([]);
                  setError([]);
                }}
                className="w-40 p-2 bg-gray-700/50 border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
                disabled={isRunning}
              >
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="w-full">
                <Label className="text-sm font-medium text-gray-200">Code Editor</Label>
                <AceEditor
                  mode={
                    language === "cpp" || language === "c"
                      ? "c_cpp"
                      : language === "java"
                      ? "java"
                      : "python"
                  }
                  theme="monokai"
                  value={code}
                  onChange={handleCodeChange}
                  name="code-editor"
                  editorProps={{ $blockScrolling: true }}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 2,
                    fontSize: 14,
                    wrap: true,
                  }}
                  style={{ width: "100%", height: "500px", borderRadius: "8px" }}
                  readOnly={isRunning}
                  ref={editorRef}
                />
                <div className="flex gap-4 mt-4">
                  <Button
                    onClick={handleCompile}
                    disabled={isRunning || !code.trim()}
                    className="w-1/2 bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200"
                  >
                    {isRunning ? "Running..." : "Compile and Run"}
                  </Button>
                  <Button
                    onClick={handleSaveCode}
                    disabled={isRunning || !code.trim()}
                    className="w-1/2 bg-gray-700/50 hover:bg-gray-600 text-white rounded-lg transition-all duration-200"
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="w-full">
                <Label className="text-sm font-medium text-gray-200">Output</Label>
                <div
                  className="p-4 bg-gray-900/50 rounded-lg overflow-y-auto border border-gray-600"
                  style={{ width: "100%", height: "500px", whiteSpace: "pre-wrap" }}
                >
                  {output.length === 0 && error.length === 0 && !isRunning && (
                    <pre className="text-gray-400">Run the code to see the output.</pre>
                  )}
                  {output.map((line, index) => (
                    <div key={index} className="flex items-center text-gray-200">
                      <span>{line}</span>
                    </div>
                  ))}
                  {error.map((line, index) => (
                    <div key={`error-${index}`} className="text-red-400">{line}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {submissions.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-200">Previous Submissions</Label>
                  <ul className="list-disc pl-5 mt-2">
                    {submissions.map((file) => (
                      <li key={file} className="text-gray-400">{file}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}