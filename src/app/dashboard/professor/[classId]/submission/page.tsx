// src/app/dashboard/professor/[classId]/submissions/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Submission {
  id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  language: string;
  submitted_at: string;
  users: { email: string };
}

export default function ClassSubmissions() {
  const { classId } = useParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, student_id, file_name, file_path, language, submitted_at, users(email)")
        .eq("class_id", classId);

      if (error) {
        console.error("Error fetching submissions:", error);
      } else {
        setSubmissions(data || []);
      }
      setIsLoading(false);
    };
    fetchSubmissions();
  }, [classId]);

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("submissions").download(filePath);
    if (error) {
      console.error("Download error:", error);
      alert(`Failed to download file: ${error.message}`);
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Student Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p>No submissions yet.</p>
          ) : (
            <ul className="space-y-4">
              {submissions.map((submission) => (
                <li key={submission.id} className="border-b py-2">
                  <p><strong>Student:</strong> {submission.users.email}</p>
                  <p><strong>File:</strong> {submission.file_name}</p>
                  <p><strong>Language:</strong> {submission.language}</p>
                  <p><strong>Submitted:</strong> {new Date(submission.submitted_at).toLocaleString()}</p>
                  <button
                    onClick={() => handleDownload(submission.file_path, submission.file_name)}
                    className="text-blue-500 hover:underline"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}