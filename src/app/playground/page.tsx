'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/theme-monokai';

const Playground: React.FC = () => {
  const [code, setCode] = useState('console.log("Hello, World!");');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleCompile = async () => {
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await response.json();
      setOutput(data.output || '');
      setError(data.error || '');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compile code';
      setError(errorMessage);
      setOutput('');
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
            />

            <Button onClick={handleCompile}>Compile and Run</Button>

            {output && (
              <div>
                <Label>Output:</Label>
                <pre className="p-2 bg-gray-800 text-white rounded">{output}</pre>
              </div>
            )}

            {error && (
              <div>
                <Label>Error:</Label>
                <pre className="p-2 bg-red-800 text-white rounded">{error}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Playground;