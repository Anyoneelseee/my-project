// components/CodeEditorCore.tsx
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Button } from "@/components/ui/button";

interface ExecutionStep {
  output: string;
  inputsSoFar: string[];
  error: string;
  needsInput: boolean;
}

interface Props {
  code: string;
  language: string;
  steps: ExecutionStep[];
  isRunning: boolean;
  isWaitingForInput: boolean;
  userInput: string;
  currentStep: number;
  totalInputs: number;
  onCodeChange: (v: string) => void;
  onRun: () => void;
  onSave: () => void;
  onClear: () => void;
  onInputChange: (v: string) => void;
  onSubmitInput: () => void;
  onLanguageChange: (l: string) => void;
}

const templates: Record<string, string> = {
  python: `print("Enter your name:")
name = input()
print("Enter your age:")
age = int(input())
print(f"Hello {name}, you are {age} years old!")`,
  cpp: `#include <iostream>
#include <string>
using namespace std;
int main() {
    string name; cout << "Enter your name: "; getline(cin, name);
    int age; cout << "Enter your age: "; cin >> age;
    cout << "Hello " << name << ", you are " << age << " years old!" << endl;
    return 0;
}`,
  c: `#include <stdio.h>
#include <string.h>
int main() {
    char name[100]; printf("Enter your name: "); fgets(name,100,stdin); name[strcspn(name,"\\n")]=0;
    int age; printf("Enter your age: "); scanf("%d",&age);
    printf("Hello %s, you are %d years old!\\n",name,age);
    return 0;
}`,
  java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        System.out.print("Enter your name: "); String name = s.nextLine();
        System.out.print("Enter your age: "); int age = s.nextInt();
        System.out.println("Hello " + name + ", you are " + age + " years old!");
    }
}`,
};

export default function CodeEditorCore({
  code,
  language,
  steps,
  isRunning,
  isWaitingForInput,
  userInput,
  currentStep,
  totalInputs,
  onCodeChange,
  onRun,
  onSave,
  onClear,
  onInputChange,
  onSubmitInput,
  onLanguageChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Editor */}
      <div className="lg:col-span-2 space-y-4">
        <select
          value={language}
          onChange={(e) => {
            const lang = e.target.value;
            onLanguageChange(lang);
            onCodeChange(templates[lang]);
            onClear();
          }}
          disabled={isRunning}
          className="w-40 p-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200"
        >
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="java">Java</option>
        </select>

        <AceEditor
          mode={language === "cpp" || language === "c" ? "c_cpp" : language}
          theme="monokai"
          value={code}
          onChange={onCodeChange}
          name="ace"
          editorProps={{ $blockScrolling: true }}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            showLineNumbers: true,
            tabSize: 2,
            fontSize: 14,
            wrap: true,
          }}
          style={{ width: "100%", height: "500px", borderRadius: "8px" }}
          readOnly={isRunning}
        />

        <div className="flex gap-3">
          <Button onClick={onRun} disabled={isRunning || !code.trim()} className="flex-1 bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700">
            {isRunning ? "Running…" : "Run"}
          </Button>
          <Button onClick={onSave} disabled={isRunning || !code.trim()} className="flex-1 bg-gray-700/50 hover:bg-gray-600">Save</Button>
          <Button onClick={onClear} disabled={isRunning} className="flex-1 bg-gray-700/50 hover:bg-gray-600">Clear</Button>
        </div>
      </div>

      {/* Console */}
      <div className="flex flex-col h-full">
        <div className="flex-1 p-3 bg-gray-900/50 rounded-lg border border-gray-600 overflow-y-auto font-mono text-sm">
          {steps.length === 0 && <span className="text-gray-400">Run code to see output…</span>}
          {steps.map((s, i) => (
            <div key={i}>
              {s.output && <div className="text-green-400">{s.output}</div>}
              {s.inputsSoFar.map((inp, j) => (
                <div key={j} className="text-blue-400">&gt; {inp}</div>
              ))}
              {s.error && <div className="text-red-400">{s.error}</div>}
            </div>
          ))}
          {isRunning && <div className="text-yellow-400">[Executing…]</div>}
        </div>

        {isWaitingForInput && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && userInput.trim()) {
                  e.preventDefault();
                  onSubmitInput();
                }
              }}
              placeholder={`Input ${currentStep}/${totalInputs}`}
              className="flex-1 p-2 bg-gray-700/50 border border-gray-600 rounded text-gray-200 focus:ring-2 focus:ring-teal-500"
              disabled={isRunning}
            />
            <Button onClick={onSubmitInput} disabled={isRunning || !userInput.trim()} className="bg-teal-500 hover:bg-teal-600">
              Submit
            </Button>
          </div>
        )}

        {steps.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">Step {currentStep} / {totalInputs}</p>
        )}
      </div>
    </div>
  );
}