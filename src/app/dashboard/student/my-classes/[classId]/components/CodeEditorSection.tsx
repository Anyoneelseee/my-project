import { useState } from "react";
 import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import AceEditor from "react-ace";
 import "ace-builds/src-noconflict/mode-javascript";
 import "ace-builds/src-noconflict/mode-python";
 import "ace-builds/src-noconflict/mode-c_cpp";
 import "ace-builds/src-noconflict/theme-monokai";
 import "ace-builds/src-noconflict/worker-javascript";
 
 export default function CodeEditorSection({ classId }: { classId: string }) {
   const [code, setCode] = useState<string>("// Write your code here\nconsole.log('Hello, World!');");
   const [output, setOutput] = useState<string>("");
   const [language, setLanguage] = useState<string>("javascript");
   const [selectedFile, setSelectedFile] 
    
  = useState<File | null>(null); // State for the file to submit
 
   // Run the code (JavaScript only for now)
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
       eval(code); // Execute the JavaScript code
       console.log = originalConsoleLog;
       setOutput(outputLog || "No output");
     } catch (error: unknown) {
       setOutput(error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.");
     }
   };
 
   // Save code locally as a file with user-specified name
   const handleSaveCode = () => {
     const extension = language === "javascript" ? "js" : language === "python" ? "py" : "cpp";
     const defaultFileName = `code-${classId}-${Date.now()}.${extension}`;
     const userFileName = prompt("Enter a file name for your code:", defaultFileName); // Prompt for custom name
 
     if (userFileName === null) {
       // User clicked "Cancel" in the prompt
       return;
     }
 
     const finalFileName = userFileName.endsWith(`.${extension}`) ? userFileName : `${userFileName}.${extension}`; // Ensure extension
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
 
   // Handle file selection for submission
   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (file) {
       setSelectedFile(file);
     }
   };
 
   // Submit selected file to Azure Blob Storage via API
   const handleSubmitActivity = async () => {
     if (!selectedFile) {
       alert("Please select a file to submit.");
       return;
     }
     try {
       const fileContent = await selectedFile.text(); // Read file content as text
       const fileLanguage = selectedFile.name.split(".").pop()?.toLowerCase() === "js"
         ? "javascript"
         : selectedFile.name.split(".").pop()?.toLowerCase() === "py"
         ? "python"
         : "c_cpp"; // Infer language from extension
 
       const response = await fetch("/api/submit-code", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           code: fileContent,
           classId,
           language: fileLanguage,
         }),
       });
       if (!response.ok) throw new Error("Failed to submit activity");
       const data = await response.json();
       alert(data.message);
       console.log("Submitted fileName:", data.fileName); // Log the fileName for reference
       setSelectedFile(null); // Clear the file input after submission
     } catch (error) {
       alert(error instanceof Error ? `Failed to submit activity: ${error.message}` : "An unknown error occurred.");
     }
   };
 
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
               <Button onClick={handleRunCode}>Run Code</Button>
               <Button onClick={handleSaveCode}>Save Code</Button>
               <Button onClick={handleSubmitActivity}>Submit Activity</Button>
             </div>
             <div className="flex items-center gap-2">
               <input
                 type="file"
                 onChange={handleFileChange}
                 className="p-2 border rounded w-full"
                 accept=".js,.py,.cpp" // Restrict to common code file types
               />
             </div>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 }