"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import { supabase } from "@/lib/supabase";
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
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<React.ComponentRef<typeof AceEditor>>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log activity to Supabase with retry
  const logActivity = async (action: string, retries = 2) => {
    try {
      console.log("Attempting to log activity:", { classId, action });
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        console.warn("No authenticated session:", sessionError?.message);
        setError("Please log in to perform actions.");
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
        });

      if (insertError) {
        console.warn("Failed to insert log:", insertError.message, insertError.details);
        if (retries > 0) {
          console.log("Retrying log insert:", { action, retries });
          setTimeout(() => logActivity(action, retries - 1), 1000);
        } else {
          setError("Failed to log activity. Ensure you are authorized for this class.");
        }
      } else {
        console.log("Successfully logged activity:", { classId, userId, action });
      }
    } catch (err) {
      console.error("Unexpected error logging activity:", err);
      setError("An unexpected error occurred.");
    }
  };

  // Test logging on mount
  useEffect(() => {
    console.log("CodeEditorSection mounted with classId:", classId);
    logActivity("Component Mounted");
  }, [classId]);

  useEffect(() => {
    async function fetchSectionAndSubmissions() {
      try {
        console.log("Fetching for classId:", classId);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session for submissions:", sessionError?.message);
          setError("Please log in to view submissions.");
          return;
        }

        type SectionResult = {
          section: string | null;
          error_message: string | null;
        };

        const { data: sectionData, error: sectionError } = await supabase
          .rpc("get_student_class_section", {
            class_id_input: classId,
            student_id_input: session.user.id,
          });

        if (sectionError) {
          console.error("Section fetch error:", sectionError.message);
          setError("Failed to fetch class information.");
          return;
        }

        const result: SectionResult = Array.isArray(sectionData) && sectionData.length > 0
          ? sectionData[0]
          : { section: null, error_message: "No data returned" };

        if (!result.section || result.error_message) {
          console.error("No section found for class:", classId, "Error:", result.error_message);
          setError("You are not enrolled in this class.");
          return;
        }

        const sectionName = result.section;
        setSection(sectionName);
        console.log("Section set to:", sectionName);

        const folderPath = `submissions/${sectionName}/${session.user.id}`;
        const { data, error } = await supabase.storage
          .from("submissions")
          .list(folderPath, {
            limit: 100,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
          });

        if (error) {
          console.error("Failed to fetch submissions:", error.message);
          setError("Failed to load submissions.");
          return;
        }

        setSubmissions(data.map((file) => file.name));
      } catch (err) {
        console.error("Error listing submissions:", err);
        setError("An unexpected error occurred while loading submissions.");
      }
    }

    fetchSectionAndSubmissions();
  }, [classId]);

  const handleRunCode = () => {
    if (language !== "javascript") {
      setOutput("Execution is currently supported only for JavaScript.");
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
      logActivity("Ran Code");
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
    logActivity("Saved Code");
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
      logActivity("Uploaded File");
    }
  };

  async function handleSubmitActivity() {
    try {
      setIsSubmitting(true);
      const code = editorRef.current?.editor.getValue() ?? "";
      const fileExtension = language === "python" ? "py" : language === "cpp" ? "cpp" : "js";
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("No session available");
      }

      if (!section) {
        throw new Error("Section not loaded. Please ensure you are enrolled in this class.");
      }

      const response = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code,
          classId,
          language: fileExtension,
          fileName: selectedFile?.name || `submission-${Date.now()}.${fileExtension}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to submit activity: ${response.statusText}`);
      }

      alert(data.message);
      setSelectedFile(null);
      logActivity("Submitted Activity");

      const folderPath = `submissions/${section}/${session.user.id}`;
      const { data: updatedFiles, error: listError } = await supabase.storage
        .from("submissions")
        .list(folderPath);
      if (listError) {
        console.error("Failed to refresh submissions:", listError.message);
      } else {
        setSubmissions(updatedFiles.map((file) => file.name));
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert(error instanceof Error ? error.message : "Failed to submit activity");
    } finally {
      setIsSubmitting(false);
    }
  }

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
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Code Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
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
                onChange={handleCodeChange}
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
              <Button onClick={handleSubmitActivity} disabled={isSubmitting || !section}>
                Submit Activity
              </Button>
              <Button onClick={() => logActivity("Test Button")}>
                Test Log
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
            {submissions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Previous Submissions</h4>
                <ul className="list-disc pl-5">
                  {submissions.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}