"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { PlayIcon, PlusIcon, XMarkIcon, PencilIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";

const REPLIT_URL = process.env.NEXT_PUBLIC_REPLIT_API_URL || "http://localhost:8080";

const codeTemplates: Record<string, Record<string, string>> = {
  python: {
    "main.py": `# Python Rock Paper Scissors
import random

print("=== Rock Paper Scissors ===")
while True:
    user = input("Choose (rock/paper/scissors/quit): ").lower()
    if user == "quit": break
    if user not in ["rock", "paper", "scissors"]:
        print("Invalid!")
        continue
    comp = random.choice(["rock", "paper", "scissors"])
    print(f"Computer: {comp}")
    if user == comp:
        print("Tie!")
    elif (user == "rock" and comp == "scissors") or \\
         (user == "scissors" and comp == "paper") or \\
         (user == "paper" and comp == "rock"):
        print("You win!")
    else:
        print("Computer wins!")
    print("-" * 30)`,
  },
  java: {
    "Main.java": `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Random rand = new Random();
        String[] choices = {"rock", "paper", "scissors"};
        System.out.println("=== Java Rock Paper Scissors ===");
        while (true) {
            System.out.print("Choose (rock/paper/scissors/quit): ");
            String user = sc.nextLine().toLowerCase();
            if (user.equals("quit")) break;
            if (!Arrays.asList("rock", "paper", "scissors").contains(user)) {
                System.out.println("Invalid!");
                continue;
            }
            String comp = choices[rand.nextInt(3)];
            System.out.println("Computer: " + comp);
            if (user.equals(comp)) System.out.println("Tie!");
            else if ((user.equals("rock") && comp.equals("scissors")) ||
                     (user.equals("scissors") && comp.equals("paper")) ||
                     (user.equals("paper") && comp.equals("rock")))
                System.out.println("You win!");
            else System.out.println("Computer wins!");
            System.out.println("-".repeat(30));
        }
    }
}`,
  },
  c: {
    "main.c": `#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>

int main() {
    char user[20];
    char *choices[] = {"rock", "paper", "scissors"};
    srand(time(0));
    printf("=== C Rock Paper Scissors ===\\n");
    fflush(stdout);
    while (1) {
        printf("Choose (rock/paper/scissors/quit): ");
        fflush(stdout);
        if (!fgets(user, 20, stdin)) break;
        user[strcspn(user, "\\n")] = 0;
        if (strcmp(user, "quit") == 0) break;
        if (strcmp(user, "rock") && strcmp(user, "paper") && strcmp(user, "scissors")) {
            printf("Invalid!\\n");
            fflush(stdout);
            continue;
        }
        int c = rand() % 3;
        printf("Computer: %s\\n", choices[c]);
        if (strcmp(user, choices[c]) == 0) printf("Tie!\\n");
        else if ((strcmp(user, "rock") == 0 && strcmp(choices[c], "scissors") == 0) ||
                 (strcmp(user, "scissors") == 0 && strcmp(choices[c], "paper") == 0) ||
                 (strcmp(user, "paper") == 0 && strcmp(choices[c], "rock") == 0))
            printf("You win!\\n");
        else printf("Computer wins!\\n");
        printf("------------------------------\\n");
        fflush(stdout);
    }
    return 0;
}`,
  },
  cpp: {
    "main.cpp": `#include <iostream>
#include <string>
#include <vector>
#include <random>
#include <algorithm>
using namespace std;

int main() {
    vector<string> choices = {"rock", "paper", "scissors"};
    random_device rd;
    mt19937 gen(rd());
    uniform_int_distribution<> dis(0, 2);
    cout << "=== C++ Rock Paper Scissors ===" << endl;
    while (true) {
        cout << "Choose (rock/paper/scissors/quit): ";
        string user;
        getline(cin, user);
        transform(user.begin(), user.end(), user.begin(), ::tolower);
        if (user == "quit") break;
        if (find(choices.begin(), choices.end(), user) == choices.end()) {
            cout << "Invalid!" << endl;
            continue;
        }
        string comp = choices[dis(gen)];
        cout << "Computer: " << comp << endl;
        if (user == comp) cout << "Tie!" << endl;
        else if ((user == "rock" && comp == "scissors") ||
                 (user == "scissors" && comp == "paper") ||
                 (user == "paper" && comp == "rock"))
            cout << "You win!" << endl;
        else cout << "Computer wins!" << endl;
        cout << string(30, '-') << endl;
    }
    return 0;
}`,
  },
};

const aceModes: Record<string, string> = {
  py: "python",
  java: "java",
  c: "c_cpp",
  cpp: "c_cpp",
};

const langToExt: Record<string, string> = {
  python: "py",
  java: "java",
  c: "c",
  cpp: "cpp",
};

interface File {
  name: string;
  code: string;
  language: string;
  ext: string;
}

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
  const [files, setFiles] = useState<Record<string, File>>({});
  const [activeFile, setActiveFile] = useState<string>("main.py");
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Initial load
  useEffect(() => {
    const initialLang = "python";
    const initialFileName = "main.py";
    const initialFile = codeTemplates[initialLang][initialFileName];
    setFiles({
      [initialFileName]: {
        name: initialFileName,
        code: initialFile,
        language: initialLang,
        ext: "py",
      },
    });
    setActiveFile(initialFileName);
  }, []);

  const getLanguageFromExt = (ext: string): string => {
    const extToLang: Record<string, string> = {
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
    };
    return extToLang[ext] || "python";
  };

  const getExtFromName = (name: string): string => {
    return name.split(".").pop() || "py";
  };

  const handleAddFile = () => {
    setShowNewFileModal(true);
  };

  const createNewFile = () => {
    if (!newFileName.trim()) return;
    const ext = getExtFromName(newFileName);
    const lang = getLanguageFromExt(ext);
    const safeName = newFileName.includes(".") ? newFileName : `${newFileName}.${ext}`;
    if (files[safeName]) {
      alert("File name already exists!");
      return;
    }
    setFiles(prev => ({
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
  setRenameValue(fileName.split('.')[0]); // Start with base name only (no ext)
};

  const confirmRename = () => {
  if (!renamingFile || !renameValue.trim()) return;
  const oldFile = files[renamingFile];
  const baseName = renameValue.trim().split('.')[0]; // Ignore any user-input ext, take base only
  const safeNewName = `${baseName}.${oldFile.ext}`; // Always preserve original ext
  if (files[safeNewName]) {
    alert("File name already exists!");
    return;
  }
  const newFile: File = { ...oldFile, name: safeNewName }; // ext unchanged

    setFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[renamingFile];
      newFiles[safeNewName] = newFile;
      return newFiles;
    });

    if (activeFile === renamingFile) {
      setActiveFile(safeNewName);
    }

    setRenamingFile(null);
    setRenameValue("");
  };

  const deleteFile = (fileName: string) => {
  if (Object.keys(files).length <= 1) return; // Keep at least one file
  setFiles(prev => {
    const newFiles = { ...prev };
    delete newFiles[fileName];
    if (activeFile === fileName) {
      const remainingFiles = Object.keys(newFiles); // Use updated newFiles here
      setActiveFile(remainingFiles[0] || "main.py");
    }
    return newFiles;
  });
};

  const handleLangChange = (lang: string) => {
    const ext = langToExt[lang];
    const fileName = `main.${ext}`;
    if (!files[fileName]) {
      const template = codeTemplates[lang]?.[fileName] || `// New ${lang} file`;
      setFiles(prev => ({
        ...prev,
        [fileName]: {
          name: fileName,
          code: template,
          language: lang,
          ext,
        },
      }));
    }
    setActiveFile(fileName);
    handleClear();
  };

  const currentFile = files[activeFile];
  const currentCode = currentFile?.code || "";
  const currentLang = currentFile?.language || "python";

  const handleRun = async () => {
    if (!currentCode.trim()) return;

    setIsRunning(true);
    setExecutionSteps([]);
    setIsWaitingForInput(false);
    setSessionId(null);

    setExecutionSteps([{
      id: 0,
      inputsSoFar: [],
      output: "",
      error: "",
      status: "Running",
      needsInput: false,
    }]);

    try {
      const res = await fetch(`${REPLIT_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, lang: currentLang }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data.session_id) throw new Error("No session ID");

      setSessionId(data.session_id);
      pollOutput(data.session_id);
    } catch (err) {
      console.error("Run failed:", err);
      setExecutionSteps([{
        id: 0,
        inputsSoFar: [],
        output: "",
        error: "Failed to connect. Check Replit URL & CORS.",
        status: "Error",
        needsInput: false,
      }]);
      setIsRunning(false);
    }
  };

  const pollOutput = async (sid: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${REPLIT_URL}/output/${sid}`);
        if (!res.ok) {
          setTimeout(poll, 500);
          return;
        }

        const data = await res.json();

        setExecutionSteps(prev => {
          const last = prev[prev.length - 1];
          if (!last) return prev;

          if (data.output === last.output && !data.waiting && !data.done) {
            return prev;
          }

          return [...prev.slice(0, -1), { ...last, output: data.output || "" }];
        });

        if (data.waiting) {
          setIsWaitingForInput(true);
          setIsRunning(false);
        } else if (data.done) {
          setIsRunning(false);
          setSessionId(null);
        } else {
          setTimeout(poll, 100);
        }
      } catch (err) {
        console.log(err);
        setTimeout(poll, 500);
      }
    };
    poll();
  };

  const handleInputSubmit = async () => {
    if (!sessionId || !userInput.trim()) return;

    const inputText = userInput.trim();

    if (currentLang === "python") {
      setExecutionSteps(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            inputsSoFar: [...last.inputsSoFar, inputText],
            output: last.output + `> ${inputText}\n`,
          },
        ];
      });
    }

    try {
      await fetch(`${REPLIT_URL}/input/${sessionId}`, {
        method: "POST",
        body: inputText,
      });
    } catch (err) {
      console.error("Input failed:", err);
    }

    setUserInput("");
    setIsWaitingForInput(false);
    setIsRunning(true);
    setTimeout(() => pollOutput(sessionId), 100);
  };

  const handleClear = () => {
    setExecutionSteps([]);
    setUserInput("");
    setIsRunning(false);
    setSessionId(null);
    setIsWaitingForInput(false);
  };

  const handleSave = () => {
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReturn = () => router.back();

  const handleCodeChange = (newCode: string) => {
    setFiles(prev => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], code: newCode },
    }));
  };

  useEffect(() => {
    if (executionSteps.length === 0 && !isRunning) {
      setExecutionSteps([{
        id: 0,
        inputsSoFar: [],
        output: "",
        error: "",
        status: "Ready",
        needsInput: false,
      }]);
    }
  }, [executionSteps, isRunning]);

  const aceMode = aceModes[getExtFromName(activeFile)] || "python";

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="flex justify-start mb-8"
      >
        <Button
          variant="outline"
          onClick={handleReturn}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 text-slate-200 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-300 rounded-2xl transition-all hover:scale-105 shadow-md hover:shadow-teal-500/20 font-semibold flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Dashboard
        </Button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Card className="shadow-2xl border border-teal-500/20 rounded-3xl bg-slate-800/60 backdrop-blur-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-b border-teal-500/20 p-6">
            <CardTitle className="text-3xl font-bold text-teal-400 tracking-tight flex items-center gap-3">
              <PlayIcon className="w-8 h-8" />
              Premium Code Playground
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 pt-0">
            <div className="space-y-8">
              {/* Language Buttons and Add File */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center gap-4 flex-wrap"
              >
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(codeTemplates).map((l) => (
                    <motion.div key={l}>
                      <Button
                        onClick={() => handleLangChange(l)}
                        variant={currentLang === l ? "default" : "outline"}
                        className={`capitalize rounded-xl px-4 py-2 font-semibold transition-all hover:scale-105 ${
                          currentLang === l
                            ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/25"
                            : "bg-slate-700/50 border-slate-600/50 text-slate-200 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-300"
                        }`}
                      >
                        {l === "cpp" ? "C++" : l.charAt(0).toUpperCase() + l.slice(1)}
                      </Button>
                    </motion.div>
                  ))}
                </div>
                <motion.div whileHover={{ scale: 1.05 }}>
                  <Button
                    onClick={handleAddFile}
                    variant="outline"
                    className="ml-auto bg-slate-700/50 border-slate-600/50 text-slate-200 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-300 rounded-xl transition-all font-semibold flex items-center gap-2"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add File
                  </Button>
                </motion.div>
              </motion.div>

              {/* File Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex border-b border-slate-600/30 pb-4 bg-slate-900/50 rounded-2xl p-4"
              >
                {Object.entries(files).map(([fileName]) => {
                  const isActive = activeFile === fileName;
                  const isRenaming = renamingFile === fileName;
                  return (
                    <motion.div
                      key={fileName}
                      className={`flex items-center mr-3 rounded-xl p-2 transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/30 shadow-md shadow-teal-500/10"
                          : "bg-slate-800/50 border border-slate-600/30 hover:bg-slate-700/50"
                      }`}
                      whileHover={{ scale: 1.02 }}
                    >
                      {isRenaming ? (
                        <Input
                          value={renameValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRenameValue(e.target.value)
                          }
                          onBlur={confirmRename}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') confirmRename();
                            if (e.key === 'Escape') {
                              setRenamingFile(null);
                              setRenameValue("");
                            }
                          }}
                          className="h-9 text-sm bg-transparent border-0 border-b border-slate-400/50 focus:border-teal-400 text-slate-100"
                          autoFocus
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => setActiveFile(fileName)}
                          className={`h-9 px-4 py-2 text-sm capitalize font-medium transition-all ${
                            isActive
                              ? "text-teal-300"
                              : "text-slate-300 hover:text-slate-100"
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
                          className="h-9 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFile(fileName)}
                          className="h-9 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Run Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex justify-end"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleRun}
                    disabled={isRunning || !currentCode.trim()}
                    className={`bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                      isRunning ? "animate-pulse" : ""
                    }`}
                  >
                    <PlayIcon className="h-5 w-5" />
                    {isRunning ? "Running..." : "Execute Code"}
                  </Button>
                </motion.div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="lg:col-span-2"
                >
                  <Label className="text-base font-semibold text-slate-200 mb-3 block">
                    Code Editor - {currentFile?.name}
                  </Label>
                  <div className="bg-slate-900/80 border border-slate-600/30 rounded-2xl overflow-hidden shadow-lg shadow-slate-900/50">
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
                        fontSize: 14,
                      }}
                      style={{ width: "100%", height: "500px", borderRadius: "0" }}
                      readOnly={isRunning}
                    />
                  </div>

                  <div className="flex gap-4 mt-6">
                    <motion.div whileHover={{ scale: 1.05 }}>
                      <Button
                        onClick={handleSave}
                        disabled={isRunning}
                        className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 rounded-xl transition-all font-medium shadow-md hover:shadow-slate-500/20 disabled:opacity-50"
                      >
                        Save File
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }}>
                      <Button
                        onClick={handleClear}
                        disabled={isRunning}
                        className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 rounded-xl transition-all font-medium shadow-md hover:shadow-slate-500/20 disabled:opacity-50"
                      >
                        Clear Console
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <Label className="text-base font-semibold text-slate-200 mb-3 block">
                    Execution Console
                  </Label>
                  <div className="bg-slate-900/80 border border-slate-600/30 rounded-2xl overflow-hidden shadow-lg shadow-slate-900/50">
                    <div className="p-4 bg-slate-950/50 border-b border-slate-600/30">
                      <pre
                        className="text-slate-200 whitespace-pre-wrap text-sm font-mono"
                        style={{ minHeight: "350px", maxHeight: "350px", overflowY: "auto" }}
                      >
                        {executionSteps.length === 1 && executionSteps[0].status === "Ready" && (
                          <span className="text-slate-400 italic">Ready to execute {currentFile?.name}...</span>
                        )}

                        {executionSteps.map((step, i) => (
                          <div key={i} className="mb-2">
                            {step.error && <div className="text-red-400 font-semibold">{step.error}</div>}
                            {step.output && <div className="text-emerald-400">{step.output}</div>}
                            
                            {currentLang === "python" && step.inputsSoFar.slice(
                              i === 0 ? 0 : executionSteps[i-1]?.inputsSoFar.length || 0
                            ).map((inp, j) => (
                              <div key={j} className="text-cyan-400">&gt; {inp}</div>
                            ))}
                          </div>
                        ))}

                        {isRunning && !isWaitingForInput && <div className="text-amber-400 font-semibold">[Executing...]</div>}
                      </pre>
                    </div>

                    {isWaitingForInput && (
                      <div className="p-4 bg-slate-950/50">
                        <div className="flex gap-3">
                          <Input
                            type="text"
                            value={userInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === "Enter" && userInput.trim()) {
                                e.preventDefault();
                                handleInputSubmit();
                              }
                            }}
                            className="flex-1 bg-slate-800/50 border-slate-600/50 text-slate-100 placeholder-slate-400 focus:ring-teal-500 focus:border-teal-500 transition-all"
                            placeholder="Enter input..."
                            autoFocus
                          />
                          <Button
                            onClick={handleInputSubmit}
                            disabled={!userInput.trim()}
                            className="bg-teal-500 hover:bg-teal-600 text-white font-medium px-6 rounded-xl transition-all disabled:opacity-50"
                          >
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* New File Modal */}
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
              className="bg-slate-800/95 backdrop-blur-2xl rounded-2xl p-8 w-full max-w-md border border-teal-500/20 shadow-2xl shadow-teal-500/10"
            >
              <h3 className="text-xl font-bold text-teal-400 mb-6">Create New File</h3>
              <Input
                value={newFileName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewFileName(e.target.value)
                }
                placeholder="File name (e.g., utils.py)"
                className="mb-4 bg-slate-700/50 border-slate-600/50 text-slate-100 placeholder-slate-400 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
              <Select onValueChange={(ext) => {
                if (!newFileName.includes('.')) {
                  setNewFileName(`${newFileName}.${ext}`);
                }
              }}>
                <SelectTrigger className="mb-6 bg-slate-700/50 border-slate-600/50 text-slate-100">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800/95 text-slate-100 border-teal-500/20">
                  <SelectItem value="py" className="hover:bg-teal-500/10">Python</SelectItem>
                  <SelectItem value="java" className="hover:bg-teal-500/10">Java</SelectItem>
                  <SelectItem value="c" className="hover:bg-teal-500/10">C</SelectItem>
                  <SelectItem value="cpp" className="hover:bg-teal-500/10">C++</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowNewFileModal(false)}
                  className="bg-slate-700/50 border-slate-600/50 text-slate-200 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-300 transition-all"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createNewFile}
                  disabled={!newFileName.trim()}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-6 rounded-xl shadow-md shadow-teal-500/25 hover:shadow-teal-500/40 transition-all disabled:opacity-50"
                >
                  Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Playground;