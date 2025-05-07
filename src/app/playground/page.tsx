"use client";

   import React, { useState, useRef, useEffect } from "react";
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
   import { Label } from "@/components/ui/label";
   import { Button } from "@/components/ui/button";
   import AceEditor from "react-ace";
   import "ace-builds/src-noconflict/mode-python";
   import "ace-builds/src-noconflict/mode-c_cpp";
   import "ace-builds/src-noconflict/theme-monokai";

   const Playground: React.FC = () => {
     const [code, setCode] = useState("");
     const [language, setLanguage] = useState("python");
     const [output, setOutput] = useState<string[]>([]);
     const [error, setError] = useState<string[]>([]);
     const [isRunning, setIsRunning] = useState(false);
     const [currentInput, setCurrentInput] = useState("");
     const [currentPrompt, setCurrentPrompt] = useState("");
     const wsRef = useRef<WebSocket | null>(null);
     const inputRef = useRef<HTMLInputElement | null>(null);

     useEffect(() => {
       wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "wss://130.33.40.240:8080");
       wsRef.current.onopen = () => {
         console.log("WebSocket connected");
       };
       wsRef.current.onmessage = (event) => {
         const message = JSON.parse(event.data);
         if (message.type === "output") {
           const newOutput = message.output.trim();
           if (newOutput) {
             setCurrentPrompt(newOutput);
             setOutput((prev) => {
               if (prev[prev.length - 1] === currentPrompt) {
                 return [...prev.slice(0, -1), newOutput].filter(line => line);
               }
               return [...prev, newOutput].filter(line => line);
             });
             setIsRunning(true);
           }
         } else if (message.type === "error") {
           setError((prev) => [...prev, message.error.trim()]);
           setIsRunning(false);
           setCurrentPrompt("");
         } else if (message.type === "status" && message.status === "finished") {
           setIsRunning(false);
           setCurrentPrompt("");
         }
       };
       wsRef.current.onclose = () => {
         console.log("WebSocket closed");
         setIsRunning(false);
         setCurrentPrompt("");
       };
       return () => {
         if (wsRef.current) wsRef.current.close();
       };
     }, []);

     const handleCompile = () => {
       if (!code.trim()) {
         setError((prev) => [...prev, "Code cannot be empty"]);
         return;
       }

       setIsRunning(true);
       setOutput([]);
       setError([]);
       setCurrentInput("");
       setCurrentPrompt("");

       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
         wsRef.current.send(
           JSON.stringify({
             type: "start",
             code,
             language,
           })
         );
       } else {
         setError((prev) => [...prev, "WebSocket connection not established"]);
         setIsRunning(false);
       }
     };

     const handleSave = () => {
       if (!code.trim()) {
         setError((prev) => [...prev, "Code cannot be empty to save"]);
         return;
       }

       const extension = language === "python" ? "py" : "cpp";
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

     const handleInputSubmit = () => {
       const userInput = currentInput.trim();
       if (userInput) {
         setOutput((prev) => [
           ...prev.filter(line => !line.startsWith(currentPrompt)),
           `${currentPrompt} ${userInput}`
         ]);
         setCurrentInput("");
         if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
           wsRef.current.send(
             JSON.stringify({
               type: "input",
               input: userInput,
             })
           );
         }
         setCurrentPrompt("");
       } else {
         setError((prev) => [...prev, "Input cannot be empty"]);
       }
     };

     useEffect(() => {
       if (isRunning && inputRef.current) {
         const timer = setTimeout(() => {
           inputRef.current?.focus();
         }, 0);
         return () => clearTimeout(timer);
       }
     }, [isRunning, currentPrompt]);

     return (
       <div className="p-6 max-w-7xl mx-auto">
         <Card className="shadow-lg">
           <CardHeader>
             <CardTitle>Interactive Code Playground</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-4">
               <div>
                 <Label>Select Language</Label>
                 <select
                   value={language}
                   onChange={(e) => {
                     setLanguage(e.target.value);
                     setOutput([]);
                     setError([]);
                   }}
                   className="p-2 border rounded w-full"
                   disabled={isRunning}
                 >
                   <option value="python">Python</option>
                   <option value="cpp">C++</option>
                 </select>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label>Code Editor</Label>
                   <AceEditor
                     mode={language === "cpp" ? "c_cpp" : "python"}
                     theme="monokai"
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
                     }}
                     style={{ width: "100%", height: "500px" }}
                     readOnly={isRunning}
                   />
                   <div className="flex gap-4 mt-4">
                     <Button
                       onClick={handleCompile}
                       disabled={isRunning || !code.trim()}
                       className="w-1/2"
                     >
                       {isRunning ? "Running..." : "Compile and Run"}
                     </Button>
                     <Button
                       onClick={handleSave}
                       disabled={isRunning || !code.trim()}
                       className="w-1/2"
                     >
                       Save
                     </Button>
                   </div>
                 </div>
                 <div>
                   <Label>Output</Label>
                   <div
                     className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto"
                     style={{ width: "100%", height: "500px", whiteSpace: "pre-wrap" }}
                   >
                     {output.map((line, index) => (
                       <div key={index} className="flex items-center">
                         <span>{line}</span>
                       </div>
                     ))}
                     {isRunning && currentPrompt && (
                       <div className="flex items-center">
                         <span>{currentPrompt} </span>
                         <input
                           ref={inputRef}
                           type="text"
                           className="p-1 bg-gray-800 text-white border-none outline-none flex-grow"
                           value={currentInput}
                           onChange={(e) => setCurrentInput(e.target.value)}
                           autoFocus
                           onKeyDown={(e) => {
                             if (e.key === "Enter") {
                               handleInputSubmit();
                             }
                           }}
                         />
                       </div>
                     )}
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