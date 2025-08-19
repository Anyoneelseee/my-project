"use client";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileText, Image as ImageIcon, File, CheckCircle } from "lucide-react";

interface Activity {
  id: string;
  description: string;
  title: string | null;
  image_url: string | null;
  start_time: string | null;
  deadline: string | null;
  created_at: string | null;
}

interface Submission {
  id: string;
  file_name: string;
  file_path: string;
  is_viewed: boolean;
  ai_percentage: number | null;
}

interface ActivitiesListProps {
  activities: Activity[];
  classId: string;
}

export default function ActivitiesList({ activities, classId }: ActivitiesListProps) {
  const [signedImageUrls, setSignedImageUrls] = useState<{ [key: string]: string | null }>({});
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isImageDialogOpen, setIsImageDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [submissionFileName, setSubmissionFileName] = useState<{ [key: string]: string[] }>({});
  const [submissionIsViewed, setSubmissionIsViewed] = useState<{ [key: string]: boolean[] }>({});
  const [submissionAiPercentage, setSubmissionAiPercentage] = useState<{ [key: string]: (number | null)[] }>({});
  const [submissionError, setSubmissionError] = useState<{ [key: string]: string | null }>({});
  const [hasSubmission, setHasSubmission] = useState<{ [key: string]: boolean }>({});
  const [uploadError, setUploadError] = useState<{ [key: string]: string | null }>({});
  const [uploadSuccess, setUploadSuccess] = useState<{ [key: string]: boolean }>({});
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    console.log("ActivitiesList received activities:", activities);

    // Fetch section
    const fetchSection = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session || !session.user) {
          console.error("No session:", sessionError?.message);
          setUploadError((prev) => ({ ...prev, [classId]: "Please log in to upload files." }));
          return;
        }

        const { data: sectionData, error: sectionError } = await supabase
          .rpc("get_student_class_section", {
            class_id_input: classId,
            student_id_input: session.user.id,
          });

        if (sectionError) {
          console.error("Section fetch error:", sectionError.message);
          setUploadError((prev) => ({ ...prev, [classId]: "Failed to fetch class information." }));
          return;
        }

        const result = Array.isArray(sectionData) && sectionData.length > 0
          ? sectionData[0] as { section: string | null; error_message: string | null }
          : { section: null, error_message: "No data returned" };

        if (!result.section || result.error_message) {
          console.error("No section found:", result.error_message);
          setUploadError((prev) => ({ ...prev, [classId]: "You are not enrolled in this class." }));
        } else {
          setSection(result.section);
          console.log("Section set to:", result.section);
        }
      } catch (err) {
        console.error("Unexpected error fetching section:", err);
        setUploadError((prev) => ({ ...prev, [classId]: "An unexpected error occurred." }));
      }
    };

    // Fetch submissions to determine if "View File Submission" button should be shown
    const fetchSubmissions = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session || !session.user) {
          console.error("No session for submissions:", sessionError?.message);
          return;
        }

        const submissionStatus: { [key: string]: boolean } = {};
        const fileNames: { [key: string]: string[] } = {};
        const isViewed: { [key: string]: boolean[] } = {};
        const aiPercentages: { [key: string]: (number | null)[] } = {};

        for (const activity of activities) {
          const { data: submissionData, error: submissionError } = await supabase
            .from("submissions")
            .select("id, file_name, file_path, is_viewed, ai_percentage")
            .eq("class_id", classId)
            .eq("activity_id", activity.id)
            .eq("student_id", session.user.id)
            .order("submitted_at", { ascending: false });
          console.log(`Submission data for activity ${activity.id}:`, submissionData);
          if (submissionError) {
            console.error(`Failed to fetch submission for activity ${activity.id}:`, submissionError.message);
            submissionStatus[activity.id] = false;
            fileNames[activity.id] = [];
            isViewed[activity.id] = [];
            aiPercentages[activity.id] = [];
          } else {
            submissionStatus[activity.id] = submissionData && submissionData.length > 0;
            fileNames[activity.id] = submissionData ? submissionData.map((sub: Submission) => sub.file_name) : [];
            isViewed[activity.id] = submissionData ? submissionData.map((sub: Submission) => sub.is_viewed || false) : [];
            aiPercentages[activity.id] = submissionData ? submissionData.map((sub: Submission) => sub.ai_percentage || null) : [];
          }
        }
        setHasSubmission(submissionStatus);
        setSubmissionFileName(fileNames);
        setSubmissionIsViewed(isViewed);
        setSubmissionAiPercentage(aiPercentages);
      } catch (err) {
        console.error("Unexpected error fetching submissions:", err);
      }
    };

    fetchSection();
    fetchSubmissions();

    // Fetch signed URLs for images
    const fetchSignedUrls = async () => {
      const urls: { [key: string]: string | null } = {};
      for (const activity of activities) {
        if (activity.image_url && !activity.image_url.includes("null")) {
          try {
            const { data, error } = await supabase.storage
              .from("activity-images")
              .createSignedUrl(activity.image_url, 3600);
            if (error) {
              console.error(`Failed to generate signed URL for ${activity.id}:`, error.message);
              urls[activity.id] = null;
            } else {
              urls[activity.id] = data.signedUrl;
            }
          } catch (err) {
            console.error(`Error fetching signed URL for ${activity.id}:`, err);
            urls[activity.id] = null;
          }
        } else {
          urls[activity.id] = null;
        }
      }
      setSignedImageUrls(urls);
    };

    fetchSignedUrls();
    const interval = setInterval(fetchSignedUrls, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [activities, classId]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, activityId: string) => {
    console.error(`Image load failed for activity ${activityId}:`, e);
    const img = e.target as HTMLImageElement;
    if (!img.src.includes("/images/placeholder-image.jpg")) {
      img.src = "/images/placeholder-image.jpg";
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toString() === "Invalid Date" ? "Invalid Date" : date.toLocaleString();
  };

  const getStatus = (start_time: string | null, deadline: string | null, activityId: string): { text: string; color: string } => {
  const now = new Date();
  const startDate = start_time ? new Date(start_time) : null;
  const deadlineDate = deadline ? new Date(deadline) : null;

  if (hasSubmission[activityId]) {
    return { text: "Submitted", color: "bg-green-500" };
  }

  if (!start_time && !deadline) {
    return { text: "No Dates Set", color: "bg-gray-600" };
  }
  if (startDate && startDate.getTime() > now.getTime()) {
    return { text: "Not Started", color: "bg-blue-500" };
  }
  if (deadlineDate && deadlineDate.getTime() < now.getTime()) {
    return { text: "Overdue", color: "bg-red-500" };
  }
  if (deadlineDate && deadlineDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
    return { text: "Due Soon", color: "bg-yellow-500" };
  }
  if (startDate && startDate.getTime() <= now.getTime()) {
    return { text: "In Progress", color: "bg-teal-500" };
  }
  return { text: "Upcoming", color: "bg-teal-500" };
};

  const handleUploadClick = (activityId: string) => {
    setIsUploadDialogOpen((prev) => ({ ...prev, [activityId]: true }));
    setUploadError((prev) => ({ ...prev, [activityId]: null }));
    setUploadSuccess((prev) => ({ ...prev, [activityId]: false }));
  };

  const handleViewSubmission = async (activityId: string) => {
    try {
      setSubmissionError((prev) => ({ ...prev, [activityId]: null }));
      setSubmissionFileName((prev) => ({ ...prev, [activityId]: [] }));
      setSubmissionIsViewed((prev) => ({ ...prev, [activityId]: [] }));
      setSubmissionAiPercentage((prev) => ({ ...prev, [activityId]: [] }));
      setIsSubmissionDialogOpen((prev) => ({ ...prev, [activityId]: true }));

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        throw new Error("No valid session available. Please log in again.");
      }

      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .select("id, file_name, file_path, is_viewed, ai_percentage")
        .eq("class_id", classId)
        .eq("activity_id", activityId)
        .eq("student_id", session.user.id)
        .order("submitted_at", { ascending: false });
      console.log(`Submission data for activity ${activityId}:`, submissionData);
      if (submissionError) {
        console.error(`Failed to fetch submission for activity ${activityId}:`, submissionError.message);
        throw new Error("Failed to load submissions.");
      }

      setSubmissionFileName((prev) => ({
        ...prev,
        [activityId]: submissionData ? submissionData.map((sub: Submission) => sub.file_name) : [],
      }));
      setSubmissionIsViewed((prev) => ({
        ...prev,
        [activityId]: submissionData ? submissionData.map((sub: Submission) => sub.is_viewed || false) : [],
      }));
      setSubmissionAiPercentage((prev) => ({
        ...prev,
        [activityId]: submissionData ? submissionData.map((sub: Submission) => sub.ai_percentage || null) : [],
      }));
      if (!submissionData || submissionData.length === 0) {
        throw new Error("No submissions found for this activity.");
      }
    } catch (error) {
      console.error("View submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load submissions";
      setSubmissionError((prev) => ({ ...prev, [activityId]: errorMessage }));
    }
  };

  const handleSubmitActivity = async (activityId: string, file: File) => {
    try {
      // Refresh session to ensure a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      console.log("Refreshed session:", session ? "Valid" : "Invalid", "Session Error:", sessionError?.message);
      if (sessionError || !session || !session.user) {
        throw new Error("No valid session available. Please log in again.");
      }

      if (!section) {
        throw new Error("Section not loaded. Please ensure you are enrolled in this class.");
      }

      if (!classId) {
        throw new Error("Class ID is missing");
      }

      if (!activityId) {
        throw new Error("Activity ID is missing");
      }

      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['py', 'c', 'cpp', 'java'].includes(fileExtension)) {
        throw new Error("Unsupported file type. Please upload .py, .c, .cpp, or .java files.");
      }

      const fileContent = await file.text();
      if (!fileContent.trim()) {
        throw new Error("File is empty.");
      }

      // Check for duplicate file_name
      const { data: existingSubmission, error: existingError } = await supabase
        .from("submissions")
        .select("id")
        .eq("class_id", classId)
        .eq("activity_id", activityId)
        .eq("student_id", session.user.id)
        .eq("file_name", file.name);
      if (existingError) {
        console.error("Error checking existing file name:", existingError.message);
        throw new Error("Failed to check for duplicate file names.");
      }
      if (existingSubmission && existingSubmission.length > 0) {
        throw new Error("A file with this name has already been submitted for this activity.");
      }

      const timestamp = Date.now();
      const safeFileName = `${file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".")}-${timestamp}.${fileExtension}`;
      const requestBody = {
        code: fileContent,
        classId,
        activityId,
        language: fileExtension,
        fileName: safeFileName,
        section,
        studentId: session.user.id,
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
      };

      console.log("Submitting to /api/studentsubmit_code with body:", requestBody);
      console.log("Authorization header:", `Bearer ${session.access_token}`);

      const response = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("API Response:", { status: response.status, statusText: response.statusText, data });
      if (!response.ok) {
        throw new Error(data.error || `Failed to submit activity: ${response.statusText}`);
      }

      setUploadSuccess((prev) => ({ ...prev, [activityId]: true }));
      setHasSubmission((prev) => ({ ...prev, [activityId]: true }));
      // Refresh submissions after upload
      const { data: submissionData } = await supabase
        .from("submissions")
        .select("id, file_name, file_path, is_viewed, ai_percentage")
        .eq("class_id", classId)
        .eq("activity_id", activityId)
        .eq("student_id", session.user.id)
        .order("submitted_at", { ascending: false });
      if (submissionData) {
        setSubmissionFileName((prev) => ({
          ...prev,
          [activityId]: submissionData.map((sub: Submission) => sub.file_name),
        }));
        setSubmissionIsViewed((prev) => ({
          ...prev,
          [activityId]: submissionData.map((sub: Submission) => sub.is_viewed || false),
        }));
        setSubmissionAiPercentage((prev) => ({
          ...prev,
          [activityId]: submissionData.map((sub: Submission) => sub.ai_percentage || null),
        }));
      }
      setTimeout(() => {
        setIsUploadDialogOpen((prev) => ({ ...prev, [activityId]: false }));
        setUploadSuccess((prev) => ({ ...prev, [activityId]: false }));
      }, 2000);
    } catch (error) {
      console.error("Submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit activity";
      setUploadError((prev) => ({ ...prev, [activityId]: errorMessage }));
    }
  };

// Sort activities by created_at in descending order (newest first)
const sortedActivities = [...activities].sort((a, b) => {
  const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return dateB - dateA;
});

  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {sortedActivities.length === 0 ? (
        <Card className="rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/30 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-gray-300 text-center py-8 text-lg font-medium">No activities created yet.</p>
          </CardContent>
        </Card>
      ) : (
        sortedActivities.map((activity) => (
          <article key={activity.id}>
            <Card
              className="relative rounded-lg border-teal-500/30 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out h-[360px] flex flex-col overflow-hidden"
              aria-label={`Activity card: ${activity.title || "Untitled Activity"}`}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-xl font-extrabold text-teal-400 truncate">
                  {activity.title || "Untitled Activity"}
                </CardTitle>
<p className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${getStatus(activity.start_time, activity.deadline, activity.id).color} w-fit mt-1`}>
  {getStatus(activity.start_time, activity.deadline, activity.id).text}
</p>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDescriptionDialogOpen((prev) => ({ ...prev, [activity.id]: true }));
                    }}
                    aria-label={`View description for ${activity.title || "Untitled Activity"}`}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Description
                  </Button>
                  {signedImageUrls[activity.id] && !activity.image_url?.includes("null") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageDialogOpen((prev) => ({ ...prev, [activity.id]: true }));
                      }}
                      aria-label={`View image for ${activity.title || "Untitled Activity"}`}
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      Image
                    </Button>
                  )}
                  {hasSubmission[activity.id] && (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewSubmission(activity.id);
                        }}
                        aria-label={`View file submissions for ${activity.title || "Untitled Activity"}`}
                      >
                        <File className="w-4 h-4 mr-1" />
                        View File Submissions
                      </Button>
                      {submissionIsViewed[activity.id].some((viewed) => viewed) && (
                        <CheckCircle
                          className="w-4 h-4 ml-2 text-teal-400"
                          aria-label="At least one submission viewed by professor"
                        />
                      )}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadClick(activity.id);
                    }}
                    aria-label={`Upload file for ${activity.title || "Untitled Activity"}`}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Upload File
                  </Button>
                </div>
                <CardFooter className="p-0 mt-4 flex flex-col gap-1">
                  <p
                    className="text-xs font-medium text-teal-300 bg-gray-700/50 px-3 py-1 rounded-full w-fit"
                    aria-label={`Start date: ${formatDate(activity.start_time)}`}
                  >
                    Start: {formatDate(activity.start_time)}
                  </p>
                  <p
                    className="text-xs font-medium text-teal-300 bg-gray-700/50 px-3 py-1 rounded-full w-fit"
                    aria-label={`Deadline: ${formatDate(activity.deadline)}`}
                  >
                    Deadline: {formatDate(activity.deadline)}
                  </p>
                </CardFooter>
              </CardContent>
              <Dialog
                open={isDescriptionDialogOpen[activity.id] || false}
                onOpenChange={(open) => setIsDescriptionDialogOpen((prev) => ({ ...prev, [activity.id]: open }))}
              >
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"}
                    </DialogTitle>
                    <DialogDescription className="text-teal-300 text-sm">
                      Activity description
                    </DialogDescription>
                  </DialogHeader>
                  <div className="text-teal-200 text-base max-h-[50vh] overflow-y-auto">
                    {activity.description || "No description available"}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      onClick={() => setIsDescriptionDialogOpen((prev) => ({ ...prev, [activity.id]: false }))}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={isImageDialogOpen[activity.id] || false}
                onOpenChange={(open) => setIsImageDialogOpen((prev) => ({ ...prev, [activity.id]: open }))}
              >
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"} Image
                    </DialogTitle>
                    <DialogDescription className="text-teal-300 text-sm">
                      Activity image
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-center">
                    <Image
                      src={signedImageUrls[activity.id] || "/images/placeholder-image.jpg"}
                      alt={`Activity ${activity.title || "Untitled"}`}
                      width={800}
                      height={600}
                      className="rounded-md max-w-full max-h-[50vh] object-contain"
                      unoptimized
                      loading="lazy"
                      onError={(e) => handleImageError(e, activity.id)}
                    />
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      onClick={() => setIsImageDialogOpen((prev) => ({ ...prev, [activity.id]: false }))}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={isSubmissionDialogOpen[activity.id] || false}
                onOpenChange={(open) => setIsSubmissionDialogOpen((prev) => ({ ...prev, [activity.id]: open }))}
              >
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"} File Submissions
                    </DialogTitle>
                    <DialogDescription className="text-teal-300 text-sm">
                      Your submitted files for this activity
                    </DialogDescription>
                  </DialogHeader>
                  <div className="text-teal-200 text-base max-h-[50vh] overflow-y-auto">
                    {submissionError[activity.id] ? (
                      <p className="text-red-400">{submissionError[activity.id]}</p>
                    ) : submissionFileName[activity.id]?.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        {submissionFileName[activity.id].map((fileName, index) => (
                          <div key={index} className="border-b border-teal-500/30 pb-2">
                            <p><span className="font-semibold">File {index + 1}:</span> {fileName}</p>
                            <p>
                              <span className="font-semibold">Professor Viewed:</span>{" "}
                              {submissionIsViewed[activity.id][index] ? (
                                <span className="text-teal-400 flex items-center">
                                  Yes <CheckCircle className="w-4 h-4 ml-1" />
                                </span>
                              ) : (
                                "No"
                              )}
                            </p>
                            <p>
                              <span className="font-semibold">AI-Generated Percentage:</span>{" "}
                              {submissionAiPercentage[activity.id][index] !== null ? (
                                `${submissionAiPercentage[activity.id][index]?.toFixed(2)}%`
                              ) : (
                                <span className="text-teal-300">Not yet analyzed</span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No submissions found.</p>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      onClick={() => setIsSubmissionDialogOpen((prev) => ({ ...prev, [activity.id]: false }))}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={isUploadDialogOpen[activity.id] || false}
                onOpenChange={(open) => setIsUploadDialogOpen((prev) => ({ ...prev, [activity.id]: open }))}
              >
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      Upload File for {activity.title || "Untitled Activity"}
                    </DialogTitle>
                    <DialogDescription className="text-teal-300 text-sm">
                      Select a file to submit for this activity (.py, .c, .cpp, .java).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      type="file"
                      accept=".py,.c,.cpp,.java"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSubmitActivity(activity.id, e.target.files[0]);
                        }
                      }}
                      className="text-teal-300 border-teal-500/30 focus:ring-2 focus:ring-teal-400"
                      aria-label="Upload file input"
                    />
                    {uploadError[activity.id] && (
                      <p className="text-red-400 text-sm" aria-live="polite">
                        {uploadError[activity.id]}
                      </p>
                    )}
                    {uploadSuccess[activity.id] && (
                      <p className="text-teal-400 text-sm" aria-live="polite">
                        File uploaded successfully!
                      </p>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      onClick={() => setIsUploadDialogOpen((prev) => ({ ...prev, [activity.id]: false }))}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          </article>
        ))
      )}
    </div>
  );
}
