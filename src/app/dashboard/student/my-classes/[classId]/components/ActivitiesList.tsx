"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  CheckCircle,
  Trash2,
  PlayCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface Activity {
  id: string;
  description: string;
  title: string | null;
  image_url: string | null;
  start_time: string | null;
  deadline: string | null;
  created_at: string | null;
  submission_type: "code" | "file";
  class_id: string;
}

interface ActivitiesListProps {
  activities: Activity[];
  classId: string;
  selectedActivityId: string | null;
  onStartActivity: (activityId: string) => void;
  isLoading?: boolean;
}

interface Submission {
  id: string;
  file_name: string;
  file_path: string;
  is_viewed: boolean;
  ai_percentage: number | null;
}

export default function ActivitiesList({
  activities,
  classId,
  selectedActivityId,
  onStartActivity,
  isLoading = false,
}: ActivitiesListProps) {
  const [signedImageUrls, setSignedImageUrls] = useState<{ [key: string]: string | null }>({});
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isImageDialogOpen, setIsImageDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [submissionFileName, setSubmissionFileName] = useState<{ [key: string]: string[] }>({});
  const [submissionIsViewed, setSubmissionIsViewed] = useState<{ [key: string]: boolean[] }>({});
  const [submissionAiPercentage, setSubmissionAiPercentage] = useState<{ [key: string]: (number | null)[] }>({});
  const [hasSubmission, setHasSubmission] = useState<{ [key: string]: boolean }>({});
  const [uploadError, setUploadError] = useState<{ [key: string]: string | null }>({});
  const [uploadSuccess, setUploadSuccess] = useState<{ [key: string]: boolean }>({});
  const [section, setSection] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File[] }>({});

  // === INSTANT STATUS ===
  const getStatus = (start: string | null, deadline: string | null) => {
    const now = Date.now();
    if (!start && !deadline) return { text: "No Dates", color: "bg-gray-600" };
    if (start && new Date(start).getTime() > now)
      return { text: "Not Started", color: "bg-blue-500" };
    if (deadline && new Date(deadline).getTime() < now)
      return { text: "Overdue", color: "bg-red-500" };
    if (deadline && new Date(deadline).getTime() - now < 86_400_000)
      return { text: "Due Soon", color: "bg-yellow-500" };
    return { text: "In Progress", color: "bg-teal-500" };
  };

  const getFinalStatus = (id: string, baseStatus: ReturnType<typeof getStatus>) => {
    if (hasSubmission[id]) return { text: "Submitted", color: "bg-green-500" };
    return baseStatus;
  };

  /* --------------------------------------------------------------
     FETCH DATA
     -------------------------------------------------------------- */
  useEffect(() => {
    if (isLoading || activities.length === 0) return;

    const fetchSection = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase.rpc("get_student_class_section", {
        class_id_input: classId,
        student_id_input: session.user.id,
      });
      const result = Array.isArray(data) && data[0] ? data[0] : null;
      setSection(result?.section || null);
    };

    const fetchSubmissions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const status: { [k: string]: boolean } = {};
      const names: { [k: string]: string[] } = {};
      const viewed: { [k: string]: boolean[] } = {};
      const ai: { [k: string]: (number | null)[] } = {};

      for (const act of activities) {
        const { data } = await supabase
          .from("submissions")
          .select("id, file_name, file_path, is_viewed, ai_percentage")
          .eq("class_id", classId)
          .eq("activity_id", act.id)
          .eq("student_id", session.user.id);

        status[act.id] = !!data?.length;
        names[act.id] = data?.map((s: Submission) => s.file_name) || [];
        viewed[act.id] = data?.map((s: Submission) => s.is_viewed) || [];
        ai[act.id] = data?.map((s: Submission) => s.ai_percentage) || [];
      }

      setHasSubmission(status);
      setSubmissionFileName(names);
      setSubmissionIsViewed(viewed);
      setSubmissionAiPercentage(ai);
    };

    const fetchSignedUrls = async () => {
      const urls: { [k: string]: string | null } = {};
      for (const act of activities) {
        if (act.image_url && !act.image_url.includes("null")) {
          const { data } = await supabase.storage
            .from("activity-images")
            .createSignedUrl(act.image_url, 3600);
          urls[act.id] = data?.signedUrl || null;
        } else {
          urls[act.id] = null;
        }
      }
      setSignedImageUrls(urls);
    };

    fetchSection();
    fetchSubmissions();
    fetchSignedUrls();

    const interval = setInterval(fetchSignedUrls, 300_000);
    return () => clearInterval(interval);
  }, [activities, classId, isLoading]);

  // === IS DATA READY? ===
  const isDataReady = useMemo(() => {
    if (isLoading || activities.length === 0) return false;
    if (!section) return false;
    if (Object.keys(hasSubmission).length !== activities.length) return false;
    if (Object.keys(signedImageUrls).length !== activities.length) return false;
    return true;
  }, [isLoading, activities, section, hasSubmission, signedImageUrls]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString() : "Not set";

  const sorted = useMemo(() => {
    return [...activities].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
  }, [activities]);

  const isSelected = (id: string) => selectedActivityId === id;

  // === HANDLERS (MUST BE INSIDE COMPONENT) ===
  const handleUploadClick = (id: string) => {
    if (hasSubmission[id]) return;
    setIsUploadDialogOpen((p) => ({ ...p, [id]: true }));
    setUploadError((p) => ({ ...p, [id]: null }));
    setUploadSuccess((p) => ({ ...p, [id]: false }));
    setSelectedFiles((p) => ({ ...p, [id]: [] }));
  };

  const handleViewSubmission = async (id: string) => {
    setIsSubmissionDialogOpen((p) => ({ ...p, [id]: true }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from("submissions")
      .select("id, file_name, file_path, is_viewed, ai_percentage")
      .eq("class_id", classId)
      .eq("activity_id", id)
      .eq("student_id", session.user.id);

    setSubmissionFileName((p) => ({ ...p, [id]: data?.map((s) => s.file_name) || [] }));
    setSubmissionIsViewed((p) => ({ ...p, [id]: data?.map((s) => s.is_viewed) || [] }));
    setSubmissionAiPercentage((p) => ({ ...p, [id]: data?.map((s) => s.ai_percentage) || [] }));
  };

  const handleFileSelect = (id: string, files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) =>
      /\.(py|c|cpp|java)$/i.test(f.name)
    );
    setSelectedFiles((p) => ({
      ...p,
      [id]: [...(p[id] || []), ...valid],
    }));
    setUploadError((p) => ({
      ...p,
      [id]: valid.length === files.length ? null : "Only .py, .c, .cpp, .java allowed.",
    }));
  };

  const handleRemoveFile = (id: string, idx: number) => {
    setSelectedFiles((p) => ({
      ...p,
      [id]: p[id].filter((_, i) => i !== idx),
    }));
  };

  const handleSubmitActivity = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (!session?.user) throw new Error("Please log in again.");
      if (!section) throw new Error("Section not loaded.");

      const files = selectedFiles[id] || [];
      if (files.length === 0) throw new Error("No files selected.");

      const fileNames = files.map((f) => f.name);
      const unique = new Set(fileNames);
      if (unique.size !== fileNames.length) throw new Error("Duplicate file names.");

      const { data: existing } = await supabase
        .from("submissions")
        .select("file_name")
        .eq("class_id", classId)
        .eq("activity_id", id)
        .eq("student_id", session.user.id);

      const existingNames = existing?.map((s) => s.file_name) || [];
      const dups = fileNames.filter((n) => existingNames.includes(n));
      if (dups.length) throw new Error(`Already submitted: ${dups.join(", ")}`);

      const filesData = await Promise.all(
        files.map(async (f) => ({
          code: await f.text(),
          fileName: f.name,
          language: f.name.split(".").pop()?.toLowerCase() ?? "",
        }))
      );

      const body = {
        files: filesData,
        classId,
        activityId: id,
        section,
        studentId: session.user.id,
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? "",
      };

      const res = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");

      setHasSubmission((p) => ({ ...p, [id]: true }));
      setUploadSuccess((p) => ({ ...p, [id]: true }));
      setSelectedFiles((p) => ({ ...p, [id]: [] }));

      const { data: newSubs } = await supabase
        .from("submissions")
        .select("id, file_name, file_path, is_viewed, ai_percentage")
        .eq("class_id", classId)
        .eq("activity_id", id)
        .eq("student_id", session.user.id);

      if (newSubs) {
        setSubmissionFileName((p) => ({ ...p, [id]: newSubs.map((s) => s.file_name) }));
        setSubmissionIsViewed((p) => ({ ...p, [id]: newSubs.map((s) => s.is_viewed) }));
        setSubmissionAiPercentage((p) => ({ ...p, [id]: newSubs.map((s) => s.ai_percentage) }));
      }

      setTimeout(() => {
        setIsUploadDialogOpen((p) => ({ ...p, [id]: false }));
        setUploadSuccess((p) => ({ ...p, [id]: false }));
      }, 2000);
    } catch (e: unknown) {
      setUploadError((p) => ({
        ...p,
        [id]: e instanceof Error ? e.message : String(e),
      }));
    }
  };

  // === FULL PAGE SKELETON ===
  if (!isDataReady) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/30 backdrop-blur-sm h-[380px] flex flex-col overflow-hidden"
          >
            <CardHeader className="p-4 space-y-3">
              <Skeleton className="h-6 w-3/4 rounded bg-gray-700" />
              <Skeleton className="h-5 w-24 rounded-full bg-gray-700" />
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded bg-gray-700" />
                <Skeleton className="h-4 w-32 rounded bg-gray-700" />
              </div>
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-8 flex-1 rounded bg-gray-700" />
                {i % 2 === 0 && <Skeleton className="h-8 w-20 rounded bg-gray-700" />}
              </div>
              <Skeleton className="h-10 w-full rounded mt-4 bg-gray-700" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // === NO ACTIVITIES ===
  if (activities.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
        <Card className="rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/30 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-gray-300 text-center py-8 text-lg font-medium">
              No activities created yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === REAL ACTIVITIES ===
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {sorted.map((activity) => {
        const baseStatus = getStatus(activity.start_time, activity.deadline);
        const status = getFinalStatus(activity.id, baseStatus);
        const isInProgress = status.text === "In Progress" || status.text === "Due Soon";
        const isCodeType = activity.submission_type === "code";
        const isFileType = activity.submission_type === "file";

        return (
          <article key={activity.id}>
            <Card
              className={`relative rounded-lg border-teal-500/30 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out h-[380px] flex flex-col overflow-hidden ${
                isSelected(activity.id) ? "ring-2 ring-teal-400" : ""
              }`}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-xl font-extrabold text-teal-400 truncate">
                  {activity.title || "Untitled Activity"}
                </CardTitle>
                <p className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${status.color} w-fit mt-1`}>
                  {status.text}
                </p>
              </CardHeader>

              <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
                {/* DATES */}
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-teal-300 bg-gray-700/50 px-3 py-1 rounded-full w-fit">
                    Start: {formatDate(activity.start_time)}
                  </p>
                  <p className="text-teal-300 bg-gray-700/50 px-3 py-1 rounded-full w-fit">
                    Deadline: {formatDate(activity.deadline)}
                  </p>
                </div>

                {/* DESCRIPTION & IMAGE */}
                {isFileType && (
                  <div className="flex gap-2 flex-wrap mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                      onClick={() => setIsDescriptionDialogOpen((p) => ({ ...p, [activity.id]: true }))}
                    >
                      <FileText className="w-4 h-4 mr-1" /> Description
                    </Button>

                    {signedImageUrls[activity.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/20"
                        onClick={() => setIsImageDialogOpen((p) => ({ ...p, [activity.id]: true }))}
                      >
                        <ImageIcon className="w-4 h-4 mr-1" /> Image
                      </Button>
                    )}
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="mt-4">
                  {isCodeType && (
                    <>
                      {!hasSubmission[activity.id] && isInProgress && (
                        <div className="flex justify-center">
                          <Button
                            onClick={() => onStartActivity(activity.id)}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <PlayCircle className="w-5 h-5 mr-2" />
                            Start Activity
                          </Button>
                        </div>
                      )}

                      {hasSubmission[activity.id] && (
                        <div className="flex justify-center">
                          <Button
                            onClick={() => handleViewSubmission(activity.id)}
                            className="bg-teal-600 hover:bg-teal-700 text-sm"
                          >
                            <File className="w-5 h-5 mr-2" />
                            View Submissions
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {isFileType && (
                    <>
                      {!hasSubmission[activity.id] && (
                        <div className="flex justify-center">
                          <Button
                            onClick={() => handleUploadClick(activity.id)}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Upload className="w-5 h-5 mr-2" />
                            Upload File
                          </Button>
                        </div>
                      )}

                      {hasSubmission[activity.id] && (
                        <div className="flex justify-center">
                          <Button
                            onClick={() => handleViewSubmission(activity.id)}
                            className="bg-teal-600 hover:bg-teal-700 text-sm"
                          >
                            <File className="w-5 h-5 mr-2" />
                            View Submissions
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>

              {/* DIALOGS */}
              <Dialog open={isDescriptionDialogOpen[activity.id] || false} onOpenChange={(open) => setIsDescriptionDialogOpen((p) => ({ ...p, [activity.id]: open }))}>
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"}
                    </DialogTitle>
                    <DialogDescription className="text-teal-300 text-sm">Activity description</DialogDescription>
                  </DialogHeader>
                  <div className="text-teal-200 text-base max-h-[50vh] overflow-y-auto">
                    {activity.description || "No description available"}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button onClick={() => setIsDescriptionDialogOpen((p) => ({ ...p, [activity.id]: false }))} className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg">
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isImageDialogOpen[activity.id] || false} onOpenChange={(open) => setIsImageDialogOpen((p) => ({ ...p, [activity.id]: open }))}>
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"} Image
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex justify-center">
                    <Image
                      src={signedImageUrls[activity.id] || "/images/placeholder-image.jpg"}
                      alt={activity.title || "Activity"}
                      width={800}
                      height={600}
                      className="rounded-md max-w-full max-h-[50vh] object-contain"
                      unoptimized
                      loading="lazy"
                    />
                  </div>
                  <DialogFooter className="mt-4">
                    <Button onClick={() => setIsImageDialogOpen((p) => ({ ...p, [activity.id]: false }))} className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg">
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isSubmissionDialogOpen[activity.id] || false} onOpenChange={(open) => setIsSubmissionDialogOpen((p) => ({ ...p, [activity.id]: open }))}>
                <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-extrabold text-teal-400">
                      {activity.title || "Untitled Activity"} Submissions
                    </DialogTitle>
                  </DialogHeader>
                  <div className="text-teal-200 text-base max-h-[50vh] overflow-y-auto">
                    {submissionFileName[activity.id]?.length > 0 ? (
                      <div className="flex flex-col gap-4">
  {submissionFileName[activity.id].map((name, i) => (
    <div key={i} className="border-b border-teal-500/30 pb-2">
      <p>
        <span className="font-semibold">File {i + 1}:</span> {name}
      </p>
      <p className="flex items-center">
        <span className="font-semibold">Professor Viewed:</span>{" "}
        {submissionIsViewed[activity.id][i] ? (
          <span className="text-teal-400 flex items-center ml-1">
            Yes
            <CheckCircle className="w-4 h-4 ml-1" />
          </span>
        ) : (
          <span className="ml-1">No</span>
        )}
      </p>
      <p>
        <span className="font-semibold">AI-Generated %:</span>{" "}
        {submissionAiPercentage[activity.id][i] !== null
          ? `${submissionAiPercentage[activity.id][i]?.toFixed(2)}%`
          : "Not analyzed"}
      </p>
    </div>
  ))}
</div>

                    ) : (
                      <p>No submissions found.</p>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button onClick={() => setIsSubmissionDialogOpen((p) => ({ ...p, [activity.id]: false }))} className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg">
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {isFileType && (
                <Dialog open={isUploadDialogOpen[activity.id] || false} onOpenChange={(open) => setIsUploadDialogOpen((p) => ({ ...p, [activity.id]: open }))}>
                  <DialogContent className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-teal-500/30 rounded-lg backdrop-blur-md p-6 max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-extrabold text-teal-400">
                        Upload Files for {activity.title || "Untitled Activity"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept=".py,.c,.cpp,.java"
                        multiple
                        onChange={(e) => handleFileSelect(activity.id, e.target.files)}
                        className="w-55 h-10 border border-gray-600 rounded-lg p-1 bg-gray-700/50 text-gray-200 
                         file:h-8 file:px-4 file:bg-teal-500 file:text-white file:rounded-lg"
                        disabled={hasSubmission[activity.id]}
                      />
                      {selectedFiles[activity.id]?.length > 0 && (
                        <div className="text-teal-200 text-sm max-h-[20vh] overflow-y-auto">
                          <p className="font-semibold mb-2">Selected Files:</p>
                          <ul className="space-y-2">
                            {selectedFiles[activity.id].map((f, i) => (
                              <li key={i} className="flex items-center justify-between">
                                <span>{f.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => handleRemoveFile(activity.id, i)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {uploadError[activity.id] && <p className="text-red-400 text-sm">{uploadError[activity.id]}</p>}
                      {uploadSuccess[activity.id] && <p className="text-teal-400 text-sm">Files uploaded successfully!</p>}
                    </div>
                    <DialogFooter className="mt-4 flex flex-row gap-2">
                      <Button onClick={() => setIsUploadDialogOpen((p) => ({ ...p, [activity.id]: false }))} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleSubmitActivity(activity.id)}
                        className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
                        disabled={hasSubmission[activity.id] || !selectedFiles[activity.id]?.length}
                      >
                        Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </Card>
          </article>
        );
      })}
    </div>
  );
}