"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { PlayIcon } from "@heroicons/react/24/solid";

const REPLIT_URL = process.env.NEXT_PUBLIC_REPLIT_API_URL || "http://localhost:8080";
const codeTemplates: Record<string, string> = {
  python: `import random

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

  java: `import java.util.*;

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

  c: `#include <stdio.h>
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

  cpp: `#include <iostream>
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
}`
};

const aceModes: Record<string, string> = {
  python: "python",
  java: "java",
  c: "c_cpp",
  cpp: "c_cpp"
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
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(codeTemplates.python);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);

  const handleRun = async () => {
    if (!code.trim()) return;

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
        body: JSON.stringify({ code, lang: language }),
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

          // Only update if output changed
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
        console.log(err)
        setTimeout(poll, 500);
      }
    };
    poll();
  };

  const handleInputSubmit = async () => {
    if (!sessionId || !userInput.trim()) return;

    const inputText = userInput.trim();

    // Only show > input for Python
    if (language === "python") {
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
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-${language}-${Date.now()}.${language === "cpp" ? "cpp" : language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReturn = () => router.back();

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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200 p-4">
      <div className="flex justify-start mb-6">
        <button
          onClick={handleReturn}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-br from-teal-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:from-teal-600 hover:to-blue-700"
        >
          Return
        </button>
      </div>

      <Card className="shadow-lg border-teal-500/20 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
        <CardHeader className="border-b border-gray-600/30">
          <CardTitle className="text-2xl font-semibold text-teal-400">
            Multi-Language Playground
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-6">
         <div className="flex items-center gap-4 flex-wrap">
  {/* Language Buttons */}
  <div className="flex gap-2 flex-wrap">
    {Object.keys(codeTemplates).map(l => (
      <Button
        key={l}
        onClick={() => {
          setLanguage(l);
          setCode(codeTemplates[l]);
          handleClear();
        }}
        variant={language === l ? "default" : "outline"}
        className="capitalize"
      >
        {l === "cpp" ? "C++" : l}
      </Button>
    ))}
  </div>

  {/* Run Button — Pushed to your desired position */}
  <div className="ml-102">
    <Button
      onClick={handleRun}
      disabled={isRunning || !code.trim()}
      className="bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white font-medium px-6"
    >
      <PlayIcon className="h-5 w-5 mr-2" />
      {isRunning ? "Running..." : "Run"}
    </Button>
  </div>
</div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Label className="text-sm font-medium text-gray-200">Code Editor</Label>
                <AceEditor
                  mode={aceModes[language]}
                  theme="monokai"
                  value={code}
                  onChange={setCode}
                  name="code-editor"
                  editorProps={{ $blockScrolling: true }}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    showLineNumbers: true,
                    tabSize: language === "java" ? 4 : 2,
                    fontSize: 14,
                  }}
                  style={{ width: "100%", height: "500px", borderRadius: "8px" }}
                  readOnly={isRunning}
                />

                <div className="flex gap-4 mt-4">
                  <Button onClick={handleSave} disabled={isRunning} className="w-1/3 bg-gray-700/50 hover:bg-gray-600 text-gray-200">
                    Save
                  </Button>
                  <Button onClick={handleClear} disabled={isRunning} className="w-1/3 bg-gray-700/50 hover:bg-gray-600 text-gray-200">
                    Clear
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-200">Console</Label>
                <div className="p-2 border border-gray-600 rounded-lg bg-gray-900">
                  <pre
                    className="text-gray-200 whitespace-pre-wrap text-sm font-mono"
                    style={{ minHeight: "400px", maxHeight: "400px", overflowY: "auto" }}
                  >
                    {executionSteps.length === 1 && executionSteps[0].status === "Ready" && (
                      <span className="text-gray-400">Click Run to execute...</span>
                    )}

                    {executionSteps.map((step, i) => (
                      <div key={i}>
                        {step.error && <div className="text-red-400">{step.error}</div>}
                        {step.output && <div className="text-green-400">{step.output}</div>}
                        
                        {/* Show > input ONLY for Python */}
                        {language === "python" && step.inputsSoFar.slice(
                          i === 0 ? 0 : executionSteps[i-1]?.inputsSoFar.length || 0
                        ).map((inp, j) => (
                          <div key={j} className="text-blue-400">&gt; {inp}</div>
                        ))}
                      </div>
                    ))}

                    {isRunning && !isWaitingForInput && <div className="text-yellow-400">[Running...]</div>}
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
                        className="flex-1 p-2 border border-gray-600 rounded-lg text-gray-200 bg-gray-700/50 focus:ring-2 focus:ring-teal-500"
                        placeholder="Enter input..."
                        autoFocus
                      />
                      <Button
                        onClick={handleInputSubmit}
                        disabled={!userInput.trim()}
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
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