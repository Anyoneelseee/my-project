"use client";

import { useState, useEffect, useRef, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { useRouter } from "next/navigation";

import {
  PlayIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/solid";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

const REPLIT_URL =
  process.env.NEXT_PUBLIC_REPLIT_API_URL || "http://localhost:8080";

const codeTemplates: Record<string, Record<string, string>> = {
  python: {
    "main.py": `print("Enter your name:")
name = input()
print("Enter your age:")
age = int(input())
print(f"Hello {name}, you are {age} years old!")`,
  },
  cpp: {
    "main.cpp": `#include <iostream>
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
  },
  c: {
    "main.c": `#include <stdio.h>
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
  },
  java: {
    "Main.java": `import java.util.Scanner;

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
  },
};

const aceModes: Record<string, string> = {
  py: "python",
  java: "java",
  c: "c_cpp",
  cpp: "c_cpp",
};

interface File {
  name: string;
  code: string;
  language: string;
  ext: string;
}

interface CodeEditorOnlyProps {
  classId: string;
  activityId: string;
  section: string;
  onSubmitSuccess?: () => void;
}

export default function CodeEditorOnly({
  classId,
  activityId,
  section,
  onSubmitSuccess,
}: CodeEditorOnlyProps) {
  /* ------------------------------------------------------------------ */
  /*                               STATE                                */
  /* ------------------------------------------------------------------ */
  const containerRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [activeFile, setActiveFile] = useState<string>("main.py");
  const [output, setOutput] = useState("");
  const [pendingInputs, setPendingInputs] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /*                           INITIAL LOAD                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const initialLang = "python";
    const initialFileName = "main.py";
    setFiles({
      [initialFileName]: {
        name: initialFileName,
        code: codeTemplates[initialLang][initialFileName],
        language: initialLang,
        ext: "py",
      },
    });
    setActiveFile(initialFileName);
  }, []);

  /* ------------------------------------------------------------------ */
  /*                         FULLSCREEN (FORCED)                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const enterFullscreen = async () => {
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
        } catch {
          // user may block fullscreen – we ignore
        }
      }
    };
    const timer = setTimeout(enterFullscreen, 100);
    return () => clearTimeout(timer);
  }, []);

  // Allow ESC to exit fullscreen (optional)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------------ */
  /*                         HELPERS                                    */
  /* ------------------------------------------------------------------ */
  const getExtFromName = (name: string): string =>
    name.split(".").pop() || "py";

  const getLanguageFromExt = (ext: string): string => {
    const map: Record<string, string> = {
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
    };
    return map[ext] || "python";
  };

  const currentFile = files[activeFile];
  const currentCode = currentFile?.code || "";
  const currentLang = currentFile?.language || "python";

  /* ------------------------------------------------------------------ */
  /*                         POLLING                                    */
  /* ------------------------------------------------------------------ */
  const startPolling = (sid: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${REPLIT_URL}/output/${sid}`);
        if (!res.ok) return;
        const { output: newOut, waiting, done } = await res.json();
        setOutput((p) => (newOut !== p ? newOut : p));
        setIsWaitingForInput(waiting);
        setIsRunning(!done && !waiting);
        if (done) {
          stopPolling();
          setSessionId(null);
        }
      } catch {}
    }, 200);
  };
  const stopPolling = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = null;
  };

  /* ------------------------------------------------------------------ */
  /*                         RUN CODE                                   */
  /* ------------------------------------------------------------------ */
  const handleRun = async () => {
    if (!currentCode.trim()) return;
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
        body: JSON.stringify({ code: currentCode, lang: currentLang }),
      });
      if (!res.ok) throw new Error();
      const { session_id } = await res.json();
      setSessionId(session_id);
      startPolling(session_id);
    } catch {
      setOutput("Failed to connect to execution engine.");
      setIsRunning(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         INPUT                                      */
  /* ------------------------------------------------------------------ */
  const handleInputSubmit = async () => {
    if (!sessionId || !userInput.trim()) return;
    const input = userInput.trim();
    setUserInput("");
    const echo = currentLang === "python" ? `> ${input}\n` : "";
    setOutput((p) => p + echo);
    setPendingInputs((p) => [...p, input]);

    try {
      await fetch(`${REPLIT_URL}/input/${sessionId}`, {
        method: "POST",
        body: input,
      });
    } catch {
      setOutput((p) => p + "\n[Input failed]\n");
    }
    setIsWaitingForInput(false);
    setIsRunning(true);
  };

  /* ------------------------------------------------------------------ */
  /*                         CLEAR / SAVE                               */
  /* ------------------------------------------------------------------ */
  const handleClear = () => {
    stopPolling();
    setOutput("");
    setPendingInputs([]);
    setUserInput("");
    setIsRunning(false);
    setIsWaitingForInput(false);
    setSessionId(null);
  };

  const handleSave = () => {
    if (!currentCode.trim()) return;
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
    setOutput((p) => p + `\n[Saved] ${currentFile.name}\n`);
  };

  /* ------------------------------------------------------------------ */
  /*                         SUBMIT                                     */
  /* ------------------------------------------------------------------ */
  const handleSubmitCode = async () => {
    if (!currentCode.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { user, access_token, refresh_token } = session;
      const filesToSubmit = Object.entries(files).map(([name, file]) => ({
        fileName: name,
        language: file.language,
        code: file.code,
      }));

      const res = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          files: filesToSubmit,
          classId,
          activityId,
          section,
          studentId: user.id,
          refreshToken: refresh_token,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Submission failed");

      setOutput((p) => p + "\nSubmitted successfully!\n");
      setShowSuccess(true);
      onSubmitSuccess?.();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         FILE MANAGEMENT                            */
  /* ------------------------------------------------------------------ */
  const handleAddFile = () => setShowNewFileModal(true);

  const createNewFile = () => {
    if (!newFileName.trim()) return;
    const ext = getExtFromName(newFileName);
    const lang = getLanguageFromExt(ext);
    const safeName = newFileName.includes(".")
      ? newFileName
      : `${newFileName}.${ext}`;
    if (files[safeName]) {
      alert("File already exists!");
      return;
    }
    setFiles((prev) => ({
      ...prev,
      [safeName]: {
        name: safeName,
        code: codeTemplates[lang]?.[safeName] || "// New file",
        language: lang,
        ext,
      },
    }));
    setActiveFile(safeName);
    setNewFileName("");
    setShowNewFileModal(false);
  };

  const handleRenameFile = (fileName: string) => {
    setRenamingFile(fileName);
    setRenameValue(fileName.split(".")[0]);
  };

  const confirmRename = () => {
    if (!renamingFile || !renameValue.trim()) return;
    const oldFile = files[renamingFile];
    const safeNewName = `${renameValue.trim()}.${oldFile.ext}`;
    if (files[safeNewName]) {
      alert("File name already exists!");
      return;
    }
    const newFile = { ...oldFile, name: safeNewName };
    setFiles((prev) => {
      const updated = { ...prev };
      delete updated[renamingFile];
      updated[safeNewName] = newFile;
      return updated;
    });
    if (activeFile === renamingFile) setActiveFile(safeNewName);
    setRenamingFile(null);
    setRenameValue("");
  };

  const deleteFile = (fileName: string) => {
    if (Object.keys(files).length <= 1) return;
    setFiles((prev) => {
      const updated = { ...prev };
      delete updated[fileName];
      if (activeFile === fileName) {
        setActiveFile(Object.keys(updated)[0]);
      }
      return updated;
    });
  };

  const handleCodeChange = (newCode: string) => {
    setFiles((prev) => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], code: newCode },
    }));
  };

  /* ------------------------------------------------------------------ */
  /*                         AUTO-SCROLL                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    consoleRef.current?.scrollTo?.({
      top: consoleRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [output, pendingInputs, isWaitingForInput]);

  useEffect(() => () => stopPolling(), []);

  const aceMode = aceModes[getExtFromName(activeFile)] || "python";
const router = useRouter();
  /* ------------------------------------------------------------------ */
  /*                         EXIT EDITOR                                */
  /* ------------------------------------------------------------------ */
const handleExit = () => {
  router.push("/dashboard/student");
};


  /* ------------------------------------------------------------------ */
  /*                              RENDER                                 */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col overflow-hidden"
      >
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          {/* ---------- EDITOR PANEL ---------- */}
          <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-gray-900/60 to-black/40 backdrop-blur-3xl border-r border-white/10">
            {/* File Tabs */}
            <div className="p-5 bg-black/40 backdrop-blur-3xl border-b border-white/10 flex items-center gap-3 overflow-x-auto">
              {Object.keys(files).map((fileName) => {
                const isActive = activeFile === fileName;
                const isRenaming = renamingFile === fileName;
                return (
                  <motion.div
                    key={fileName}
                    className={`flex items-center rounded-xl p-2 transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 shadow-md"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    {isRenaming ? (
                      <Input
                        value={renameValue}
                        onChange={(e: { target: { value: SetStateAction<string>; }; }) => setRenameValue(e.target.value)}
                        onBlur={confirmRename}
                        onKeyDown={(e: { key: string; }) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") {
                            setRenamingFile(null);
                            setRenameValue("");
                          }
                        }}
                        className="h-8 text-sm bg-transparent border-0 border-b border-emerald-400 focus:border-emerald-300 text-white"
                        autoFocus
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => setActiveFile(fileName)}
                        className={`h-8 px-3 py-1 text-sm font-medium ${
                          isActive ? "text-emerald-300" : "text-gray-300"
                        }`}
                      >
                        {fileName}
                      </Button>
                    )}
                    <motion.div whileHover={{ scale: 1.1 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRenameFile(fileName)}
                        className="h-8 w-7 p-0 text-gray-400 hover:text-white"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.1 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFile(fileName)}
                        className="h-8 w-7 p-0 text-gray-400 hover:text-red-400"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  </motion.div>
                );
              })}
              <motion.div whileHover={{ scale: 1.05 }}>
                <Button
                  onClick={handleAddFile}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>

            {/* Ace Editor */}
            <div className="flex-1 p-5 pb-0">
              <div className="h-full rounded-2xl overflow-hidden shadow-2xl bg-black/30 backdrop-blur-xl border border-white/10">
                <AceEditor
                  mode={aceMode}
                  theme="monokai"
                  value={currentCode}
                  onChange={handleCodeChange}
                  name="code-editor"
                  editorProps={{ $blockScrolling: true }}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    showLineNumbers: true,
                    tabSize: currentLang === "java" ? 4 : 2,
                    fontSize: 16,
                    wrap: true,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  readOnly={isRunning}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 bg-black/40 backdrop-blur-3xl border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleRun}
                  disabled={isRunning || !currentCode.trim()}
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <PlayIcon className="h-5 w-5 mr-2" />
                  {isRunning ? "Running…" : "Run Code"}
                </Button>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSave}
                  disabled={isRunning || !currentCode.trim()}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Save File
                </Button>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleClear}
                  disabled={isRunning}
                  className="w-full h-12 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Clear Console
                </Button>
              </motion.div>
            </div>
          </div>

          {/* ---------- CONSOLE PANEL ---------- */}
          <div className="lg:w-96 flex flex-col bg-gradient-to-b from-gray-900/60 to-black/40 backdrop-blur-3xl border-l border-white/10">
            <div className="p-5 bg-black/40 backdrop-blur-3xl border-b border-white/10">
              <h3 className="font-bold text-emerald-400 text-sm tracking-widest">
                CONSOLE OUTPUT
              </h3>
            </div>

            <div
              ref={consoleRef}
              className="flex-1 p-5 bg-black/30 overflow-y-auto font-mono text-sm text-green-300 whitespace-pre-wrap"
            >
              {output === "" && !isRunning && (
                <span className="text-gray-500 italic">
                  Run your code to see output…
                </span>
              )}
              <span>{output}</span>

              {currentLang !== "python" &&
                pendingInputs.map((inp, i) => (
                  <div key={i} className="text-cyan-400">
                    &gt; {inp}
                  </div>
                ))}

              {isRunning && !isWaitingForInput && (
                <div className="text-yellow-400 animate-pulse font-medium">
                  Running…
                </div>
              )}
            </div>

            {isWaitingForInput && (
              <div className="p-5 bg-black/40 backdrop-blur-3xl border-t border-white/10 flex gap-3">
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
                  placeholder="Enter input…"
                  className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 transition-all duration-300"
                  autoFocus
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handleInputSubmit}
                    disabled={!userInput.trim()}
                    size="sm"
                    className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-2xl shadow-lg"
                  >
                    Send
                  </Button>
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- SUBMIT BAR ---------- */}
        <div className="p-6 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-3xl border-t border-white/10">
          <div className="max-w-lg mx-auto">
            {isSubmitting ? (
              <div className="h-14 bg-gray-800/50 rounded-2xl flex items-center justify-center animate-pulse shadow-inner">
                <span className="text-emerald-400 font-semibold tracking-wide">
                  Submitting…
                </span>
              </div>
            ) : (
              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSubmitCode}
                  disabled={isSubmitting || !currentCode.trim()}
                  className="w-full h-16 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 text-white font-bold text-xl rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 tracking-wider"
                >
                  Submit Code
                </Button>
              </motion.div>
            )}
            {submitError && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center text-red-400 text-sm font-medium"
              >
                {submitError}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* ---------- NEW FILE MODAL ---------- */}
      <AnimatePresence>
        {showNewFileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800/95 backdrop-blur-2xl rounded-2xl p-8 w-full max-w-md border border-emerald-500/20 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-emerald-400 mb-6">
                Create New File
              </h3>
              <Input
                value={newFileName}
                onChange={(e: { target: { value: SetStateAction<string>; }; }) => setNewFileName(e.target.value)}
                placeholder="File name (e.g., utils.py)"
                className="mb-4 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <Select
                onValueChange={(ext) => {
                  if (!newFileName.includes(".")) {
                    setNewFileName(`${newFileName}.${ext}`);
                  }
                }}
              >
                <SelectTrigger className="mb-6 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-white border-emerald-500/20">
                  <SelectItem value="py">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowNewFileModal(false)}
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createNewFile}
                  disabled={!newFileName.trim()}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-6 rounded-xl shadow-md"
                >
                  Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- SUCCESS MODAL WITH EXIT ---------- */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSuccess(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-gradient-to-br from-emerald-900/95 to-teal-900/95 backdrop-blur-3xl rounded-3xl p-10 shadow-3xl border border-emerald-500/40"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: 0.1,
                }}
                className="flex flex-col items-center"
              >
                <CheckCircleIcon className="h-24 w-24 text-emerald-400 mb-5 drop-shadow-lg" />
                <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
                  Code Submitted!
                </h2>
                <p className="text-emerald-200 text-center max-w-xs leading-relaxed">
                  Your solution has been successfully uploaded and is now being
                  reviewed.
                </p>
                <div className="flex gap-4 mt-8">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={handleExit}
                      className="px-8 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-lg flex items-center gap-2"
                    >
                      <ArrowsPointingInIcon className="h-5 w-5" />
                      Exit Editor
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={() => setShowSuccess(false)}
                      className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl shadow-lg"
                    >
                      Stay
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}