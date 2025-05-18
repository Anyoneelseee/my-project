"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

export default function CodeEditorSection({ classId }: { classId: string }) {
  const [code, setCode] = useState<string>("// Write your code here\nconsole.log('Hello, World!');");
  const [output, setOutput] = useState<string>("");
  const [language, setLanguage] = useState<string>("javascript");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);

  const handleRunCode = () => {
    if (language !== "javascript") {
      setOutput("Execution is currently supported only for JavaScript. For Python and C/C++, a backend server is required.");
      return;
    }
    try {
      const originalConsoleLog = console.log;
      let outputLog = "";
      console.log = (message: string | number | boolean) => {
        outputLog += `${message}\n`;
      };
      eval(code);
      console.log = originalConsoleLog;
      setOutput(outputLog || "No output");
    } catch (error: unknown) {
      setOutput(error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.");
    }
  };

  const handleSaveCode = () => {
    const extension = language === "javascript" ? "js" : language === "python" ? "py" : "cpp";
    const defaultFileName = `code-${classId}-${Date.now()}.${extension}`;
    const userFileName = prompt("Enter a file name for your code:", defaultFileName);

    if (userFileName === null) return;

    const finalFileName = userFileName.endsWith(`.${extension}`) ? userFileName : `${userFileName}.${extension}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(`Code saved as ${finalFileName}`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCode(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  async function handleSubmitActivity() {
    try {
      setIsSubmitting(true);
      const code = editorRef.current?.editor.getValue() ?? "";
      const fileExtension = language === "python" ? "py" : language === "cpp" ? "cpp" : "js";
      const token = window.__supabaseSession?.access_token || "";
      console.log("Submitting with token:", token);

      const response = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          classId,
          language: fileExtension,
          fileName: selectedFile?.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to submit activity: ${response.statusText}`);
      }

      alert(data.message);
      setSelectedFile(null);
    } catch (error) {
      console.error("Submission error:", error);
      alert(error instanceof Error ? error.message : "Failed to submit activity");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Code Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h4 className="text-sm font-semibold">Language:</h4>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="c_cpp">C/C++</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Editor</h4>
              <AceEditor
                mode={language}
                theme="monokai"
                value={code}
                onChange={setCode}
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
                style={{ width: "100%", height: "400px" }}
                ref={editorRef}
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Output</h4>
              <div className="border rounded-md p-4 bg-gray-100 h-[400px] overflow-auto">
                <pre>{output || "Run the code to see the output."}</pre>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleRunCode} disabled={isSubmitting}>
                Run Code
              </Button>
              <Button onClick={handleSaveCode} disabled={isSubmitting}>
                Save Code
              </Button>
              <Button onClick={handleSubmitActivity} disabled={isSubmitting}>
                Submit Activity
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={handleFileChange}
                className="p-2 border rounded w-full"
                accept=".js,.py,.cpp"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}