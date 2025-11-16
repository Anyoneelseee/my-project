"use client";

import { useState, useEffect, useRef } from "react";
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

const REPLIT_URL = process.env.NEXT_PUBLIC_REPLIT_API_URL || "http://localhost:8080";

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

interface CodeEditorOnlyProps {
  onSubmitSuccess?: () => void;
}

export default function CodeEditorOnly({ onSubmitSuccess }: CodeEditorOnlyProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [code, setCode] = useState(codeTemplates.python);
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [pendingInputs, setPendingInputs] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Fullscreen
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  // Auto fullscreen on mount (optional, remove if not needed)
  useEffect(() => {
    const enter = async () => {
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } catch {
          console.warn("Auto fullscreen blocked");
        }
      }
    };
    const timer = setTimeout(enter, 300);
    return () => clearTimeout(timer);
  }, []);

  // Execution Polling
  const startPolling = (sid: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${REPLIT_URL}/output/${sid}`);
        if (!res.ok) return;
        const data = await res.json();
        setOutput(prev => data.output !== prev ? data.output : prev);
        setIsWaitingForInput(data.waiting);
        setIsRunning(!data.done && !data.waiting);
        if (data.done) {
          stopPolling();
          setSessionId(null);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 200);
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const handleRun = async () => {
    if (!code.trim()) return;

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
        body: JSON.stringify({ code, lang: language }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sid = data.session_id;
      if (!sid) throw new Error("No session ID");
      setSessionId(sid);
      startPolling(sid);
    } catch {
      setOutput("Failed to connect to backend.");
      setIsRunning(false);
    }
  };

  const handleInputSubmit = async () => {
    if (!sessionId || !userInput.trim()) return;
    const input = userInput.trim();
    setUserInput("");
    const echo = language === "python" ? `> ${input}\n` : "";
    setOutput(prev => prev + echo);
    setPendingInputs(prev => [...prev, input]);
    try {
      await fetch(`${REPLIT_URL}/input/${sessionId}`, {
        method: "POST",
        body: input,
      });
    } catch {
      setOutput(prev => prev + "\n[Input failed]\n");
    }
    setIsWaitingForInput(false);
    setIsRunning(true);
  };

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
    if (!code.trim()) return;
    const ext = language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : "java";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setOutput(prev => prev + `\n[Saved] code-${Date.now()}.${ext}\n`);
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Replace with your actual API call
      const res = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOutput(prev => prev + "\nSubmitted successfully!\n");
      onSubmitSuccess?.();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, pendingInputs, isWaitingForInput]);

  // Cleanup
  useEffect(() => {
    return () => stopPolling();
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200 flex flex-col overflow-hidden"
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

      {/* Editor + Console */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Language Selector */}
          <div className="p-3 bg-gray-800/50 border-b border-gray-700">
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setCode(codeTemplates[e.target.value]);
                handleClear();
              }}
              disabled={isRunning}
              className="p-2 text-sm rounded bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="java">Java</option>
            </select>
          </div>

          {/* Ace Editor */}
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

          {/* Action Buttons */}
          <div className="p-3 bg-gray-800/50 border-t border-gray-700 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleRun}
              disabled={isRunning || !code.trim()}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-sm"
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              {isRunning ? "Running..." : "Run"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isRunning || !code.trim()}
              variant="outline"
              className="flex-1 text-sm"
            >
              Save
            </Button>
            <Button
              onClick={handleClear}
              disabled={isRunning}
              variant="outline"
              className="flex-1 text-sm"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Console */}
        <div className="lg:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-700">
          <div className="p-3 bg-gray-800/50 border-b border-gray-700">
            <h3 className="font-semibold text-teal-400 text-sm">Console Output</h3>
          </div>
          <div
            ref={consoleRef}
            className="flex-1 p-3 bg-gray-900 overflow-y-auto text-sm whitespace-pre-wrap font-mono"
          >
            {output === "" && !isRunning && (
              <span className="text-gray-500">Run code to see output...</span>
            )}
            <span className="text-green-400">{output}</span>
            {language !== "python" &&
              pendingInputs.map((inp, i) => (
                <div key={i} className="text-blue-400">&gt; {inp}</div>
              ))}
            {isRunning && !isWaitingForInput && (
              <div className="text-yellow-400 animate-pulse">Running...</div>
            )}
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
                placeholder="Enter input..."
                className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 focus:ring-2 focus:ring-teal-500 text-sm"
                autoFocus
              />
              <Button
                onClick={handleInputSubmit}
                disabled={!userInput.trim()}
                size="sm"
                className="text-xs"
              >
                Send
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-teal-500/30">
        <div className="max-w-md mx-auto">
          {isSubmitting ? (
            <div className="bg-gray-700 h-12 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-teal-400">Submitting...</span>
            </div>
          ) : (
            <Button
              onClick={handleSubmitCode}
              disabled={isSubmitting || !code.trim()}
              className="w-full bg-green-600 hover:bg-green-700 text-lg font-bold py-3"
            >
              Submit Code
            </Button>
          )}
          {submitError && (
            <p className="mt-2 text-red-400 text-center text-sm">{submitError}</p>
          )}
        </div>
      </div>
    </div>
  );
}