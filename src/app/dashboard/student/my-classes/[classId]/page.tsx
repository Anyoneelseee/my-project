// src/app/dashboard/student/my-classes/[classId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-monokai";
import Image from "next/image";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function JoinedClassPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [code, setCode] = useState<string>("// Write your code here\nconsole.log('Hello, World!');");
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<string>("javascript");

  useEffect(() => {
    const initialize = async () => {
      // Check user role
      const role = await getUserRole();
      if (!role) {
        router.push("/login");
        return;
      }
      if (role !== "student") {
        router.push("/dashboard/professor");
        return;
      }

      // Verify that the student is a member of this class
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("student_id", user.id)
        .single();

      if (membershipError || !membershipData) {
        console.error("Error verifying class membership:", membershipError);
        router.push("/dashboard/student");
        return;
      }

      // Fetch class details
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (classError || !classData) {
        console.error("Error fetching class:", classError);
        router.push("/dashboard/student");
        return;
      }

      setClassData(classData);

      // Fetch activities for this class
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("class_id", classId);

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        setActivities([]);
      } else {
        console.log("Fetched activities:", activitiesData);
        setActivities(activitiesData || []);
      }

      setIsLoading(false);
    };

    initialize();
  }, [classId, router]);

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
      if (error instanceof Error) {
        setOutput(`Error: ${error.message}`);
      } else {
        setOutput("An unknown error occurred.");
      }
    }
  };

  const handleSubmitCode = () => {
    console.log("Submitted Code:", code);
    console.log("Output:", output);
    console.log("Language:", language);
    alert("Code submitted successfully!");
    // TODO: Add logic to store the submission in Supabase
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!classData) {
    return <div>Class not found.</div>;
  }

  return (
    <div className="p-4">
      {/* Class Details Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{classData.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Section: {classData.section} | Course: {classData.course}
          </p>
          <p className="text-sm font-bold">Class Code: {classData.code}</p>
        </CardContent>
      </Card>

      {/* Activities Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-gray-500">No activities created yet.</p>
          ) : (
            <ul className="space-y-4">
              {activities.map((activity) => (
                <li key={activity.id} className="border-b pb-2">
                  <p>{activity.description}</p>
                  {activity.image_url && (
                    <div className="mt-2">
                      <Image
                        src={activity.image_url}
                        alt="Activity"
                        width={300}
                        height={200}
                        className="rounded-md"
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Created at: {new Date(activity.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Compiler and Output Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Code Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compiler Section */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Editor</h4>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mb-2 p-2 border rounded"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="c_cpp">C/C++</option>
              </select>
              <AceEditor
                mode={language}
                theme="monokai"
                value={code}
                onChange={(newValue: string) => setCode(newValue)}
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
              <Button onClick={handleRunCode} className="mt-2">
                Run Code
              </Button>
            </div>

            {/* Output Section */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Output</h4>
              <div className="border rounded-md p-4 bg-gray-100 h-[400px] overflow-auto">
                <pre>{output || "Run the code to see the output."}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submission Button */}
      <Card>
        <CardContent className="pt-6">
          <Button onClick={handleSubmitCode} className="w-full">
            Submit Code
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}