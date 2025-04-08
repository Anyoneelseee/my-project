'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/theme-monokai';

const Playground: React.FC = () => {
  const [code, setCode] = useState('#include <iostream>\n#include <string>\n\nint main() {\n    std::string name;\n\n    std::cout << "Please enter your name: ";\n    std::getline(std::cin, name);\n\n    std::cout << "Your name is: " << name;\n    return 0;\n}');
  const [language, setLanguage] = useState('cpp');
  const [output, setOutput] = useState<string[]>([]); // Store output as an array of lines
  const [error, setError] = useState<string[]>([]); // Store errors as an array of lines
  const [isRunning, setIsRunning] = useState(false); // Track if the program is running
  const [waitingForInput, setWaitingForInput] = useState(false); // Track if the program is waiting for input
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_COMPILER_SERVER_URL?.replace('http', 'ws') || 'ws://172.207.80.45:3001';
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        setOutput((prev) => [...prev, msg.data]);
        setWaitingForInput(true); // Assume the program might be waiting for input after output
      } else if (msg.type === 'error') {
        setError((prev) => [...prev, msg.data]);
        setWaitingForInput(false);
      } else if (msg.type === 'exit') {
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsRunning(false);
      setWaitingForInput(false);
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const handleCompile = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError((prev) => [...prev, 'WebSocket connection is not open']);
      return;
    }

    setOutput([]);
    setError([]);
    setIsRunning(true);
    setWaitingForInput(false);

    wsRef.current.send(JSON.stringify({
      type: 'compile',
      data: { code, language }
    }));
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsRef.current || !inputRef.current) return;

    const userInput = inputRef.current.value;
    if (userInput) {
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: userInput
      }));
      setOutput((prev) => [...prev, userInput]); // Display the user's input in the output
      inputRef.current.value = ''; // Clear the input field
      setWaitingForInput(false); // Wait for the next prompt
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Code Playground</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Label>Select Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-2 border rounded"
              disabled={isRunning}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>

            <Label>Code Editor</Label>
            <AceEditor
              mode={language === 'cpp' ? 'c_cpp' : language}
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
              style={{ width: '100%', height: '400px' }}
              readOnly={isRunning}
            />

            <Button onClick={handleCompile} disabled={isRunning}>
              {isRunning ? 'Running...' : 'Compile and Run'}
            </Button>

            <div>
              <Label>Output:</Label>
              <div
                className="p-4 bg-gray-800 text-white rounded-lg overflow-y-auto"
                style={{ height: '200px', whiteSpace: 'pre-wrap', position: 'relative' }}
              >
                {output.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
                {error.map((line, index) => (
                  <div key={`error-${index}`} className="text-red-400">{line}</div>
                ))}
                {waitingForInput && isRunning && (
                  <form onSubmit={handleInputSubmit} className="mt-2">
                    <input
                      ref={inputRef}
                      type="text"
                      className="p-1 bg-gray-700 text-white border-none outline-none w-full"
                      placeholder="Type your input here and press Enter..."
                      autoFocus
                    />
                  </form>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Playground;