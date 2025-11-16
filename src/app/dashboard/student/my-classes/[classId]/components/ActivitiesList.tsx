// src/app/dashboard/student/my-classes/[classId]/components/ActivitiesList.tsx
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityCard } from "./ActivityCard";
import { CheckCircle, Calendar, Clock, AlertCircle } from "lucide-react";

// Updated Activity interface with language
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
  language?: string; // Added from activities table
}

interface Submission {
  file_name: string;
  is_viewed: boolean;
  ai_percentage: number | null;
  activity_id: string;
  student_id: string;
  class_id: string;
}

interface Props {
  activities: Activity[];
  classId: string;
  selectedActivityId: string | null;
  onStartActivity: (id: string) => void;
  isLoading?: boolean;
}

export default function ActivitiesList({
  activities,
  classId,
  selectedActivityId,
  onStartActivity,
  isLoading = false,
}: Props) {
  const [section, setSection] = useState<string | null>(null);
  const [hasSubmission, setHasSubmission] = useState<Record<string, boolean>>({});
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, string[]>>({});
  const [submissionViewed, setSubmissionViewed] = useState<Record<string, boolean[]>>({});
  const [submissionAi, setSubmissionAi] = useState<Record<string, (number | null)[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentSession = useRef<Session | null>(null);

  const getStatus = (start: string | null, deadline: string | null) => {
    const now = Date.now();
    if (!start && !deadline) return { text: "No Dates", color: "bg-gray-600", icon: Calendar };
    if (start && new Date(start).getTime() > now) return { text: "Not Started", color: "bg-blue-600", icon: Clock };
    if (deadline && new Date(deadline).getTime() < now) return { text: "Overdue", color: "bg-red-600", icon: AlertCircle };
    if (deadline && new Date(deadline).getTime() - now < 86400000) return { text: "Due Soon", color: "bg-yellow-600", icon: AlertCircle };
    return { text: "In Progress", color: "bg-teal-600", icon: Clock };
  };

  const fetchActivityData = useCallback(async () => {
    if (isLoading || activities.length === 0) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) return;

    currentSession.current = session;

    const { data: sec } = await supabase.rpc("get_student_class_section", {
      class_id_input: classId,
      student_id_input: session.user.id,
    });
    if (sec?.[0]?.section) setSection(sec[0].section);

    const has: Record<string, boolean> = {};
    const files: Record<string, string[]> = {};
    const viewed: Record<string, boolean[]> = {};
    const ai: Record<string, (number | null)[]> = {};
    const urls: Record<string, string | null> = {};

    for (const act of activities) {
      const { data } = await supabase
        .from("submissions")
        .select("file_name, is_viewed, ai_percentage")
        .eq("class_id", classId)
        .eq("activity_id", act.id)
        .eq("student_id", session.user.id);

      const subs = (data || []) as Submission[];

      has[act.id] = subs.length > 0;
      files[act.id] = subs.map((s) => s.file_name);
      viewed[act.id] = subs.map((s) => s.is_viewed);
      ai[act.id] = subs.map((s) => s.ai_percentage);

      if (act.image_url && !act.image_url.includes("null")) {
        const { data: signed } = await supabase.storage
          .from("activity-images")
          .createSignedUrl(act.image_url, 3600);
        urls[act.id] = signed?.signedUrl ?? null;
      } else urls[act.id] = null;
    }

    setHasSubmission(has);
    setSubmissionFiles(files);
    setSubmissionViewed(viewed);
    setSubmissionAi(ai);
    setSignedUrls(urls);
  }, [activities, classId, isLoading]);

  useEffect(() => {
    const session = currentSession.current;
    if (!session?.user || !section) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`submissions:${classId}:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const newSub = payload.new as Submission | null;
          const oldSub = payload.old as Submission | null;

          const studentId = newSub?.student_id ?? oldSub?.student_id;
          if (studentId !== session.user.id) return;

          const actId = newSub?.activity_id ?? oldSub?.activity_id;
          if (!actId) return;

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            if (newSub) {
              setHasSubmission((p) => ({ ...p, [actId]: true }));
              setSubmissionFiles((p) => ({
                ...p,
                [actId]: [...(p[actId] || []), newSub.file_name],
              }));
              setSubmissionViewed((p) => ({
                ...p,
                [actId]: [...(p[actId] || []), newSub.is_viewed],
              }));
              setSubmissionAi((p) => ({
                ...p,
                [actId]: [...(p[actId] || []), newSub.ai_percentage],
              }));
            }
          } else if (payload.eventType === "DELETE") {
            setHasSubmission((p) => ({ ...p, [actId]: false }));
            setSubmissionFiles((p) => ({ ...p, [actId]: [] }));
            setSubmissionViewed((p) => ({ ...p, [actId]: [] }));
            setSubmissionAi((p) => ({ ...p, [actId]: [] }));
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [classId, section]);

  useEffect(() => {
    fetchActivityData();
    const interval = setInterval(fetchActivityData, 300000);
    return () => clearInterval(interval);
  }, [fetchActivityData]);

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  // Dynamic file filtering based on activity.language
  const handleFileSelect = (id: string, files: FileList | null) => {
    if (!files) return;

    const activity = activities.find(a => a.id === id);
    const lang = activity?.language?.toLowerCase() || "python";
    const extMap: Record<string, RegExp> = {
      python: /\.py$/i,
      c: /\.c$/i,
      "c++": /\.cpp$/i,
      java: /\.java$/i,
    };
    const validExt = extMap[lang] || /\.py$/i;

    const valid = Array.from(files).filter(f => validExt.test(f.name));
    setSelectedFiles(p => ({ ...p, [id]: [...(p[id] || []), ...valid] }));
    setUploadError(p => ({
      ...p,
      [id]: valid.length === files.length ? null : `Only ${lang.toUpperCase()} files (${validExt.source}) allowed`,
    }));
  };

  const handleRemoveFile = (id: string, index: number) => {
    setSelectedFiles(p => ({
      ...p,
      [id]: p[id]?.filter((_, i) => i !== index) ?? [],
    }));
  };

  const handleSubmit = async (id: string) => {
    const files = selectedFiles[id] ?? [];
    if (files.length === 0)
      return setUploadError(p => ({ ...p, [id]: "No files selected" }));

    setIsSubmitting(p => ({ ...p, [id]: true }));
    setUploadError(p => ({ ...p, [id]: null }));

    try {
      const session = currentSession.current;
      if (!session?.user || !section) throw new Error("Authentication failed");

      const filesData = await Promise.all(
        files.map(async f => ({
          code: await f.text(),
          fileName: f.name,
          language: f.name.split(".").pop()?.toLowerCase() ?? "",
        }))
      );

      const res = await fetch("/api/studentsubmit_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          files: filesData,
          classId,
          activityId: id,
          section,
          studentId: session.user.id,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? "",
        }),
      });

      if (!res.ok) throw new Error("Submission failed");

      setUploadSuccess(p => ({ ...p, [id]: true }));
      setSelectedFiles(p => ({ ...p, [id]: [] }));
      setTimeout(() => setUploadSuccess(p => ({ ...p, [id]: false })), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadError(p => ({ ...p, [id]: message }));
    } finally {
      setIsSubmitting(p => ({ ...p, [id]: false }));
    }
  };

  const sorted = useMemo(
    () => [...activities].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [activities]
  );

  const isReady = section && Object.keys(signedUrls).length === activities.length;

  if (!isReady || isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-4 max-w-screen-2xl mx-auto">
        {[...Array(12)].map((_, i) => (
          <Skeleton key={i} className="w-full h-80 rounded-2xl bg-gray-800/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-4 max-w-screen-2xl mx-auto">
      {sorted.map((act) => {
        const baseStatus = getStatus(act.start_time, act.deadline);
        const status = hasSubmission[act.id]
          ? { text: "Submitted", color: "bg-emerald-600", icon: CheckCircle }
          : baseStatus;
        const isInProgress = ["In Progress", "Due Soon"].includes(status.text);

        return (
          <ActivityCard
            key={act.id}
            activity={act}
            status={status}
            signedImageUrl={signedUrls[act.id]}
            hasSubmission={hasSubmission[act.id]}
            isSelected={selectedActivityId === act.id}
            isInProgress={isInProgress}
            selectedFiles={selectedFiles[act.id] || []}
            uploadError={uploadError[act.id]}
            uploadSuccess={uploadSuccess[act.id]}
            submissionFiles={submissionFiles[act.id] || []}
            submissionViewed={submissionViewed[act.id] || []}
            submissionAi={submissionAi[act.id] || []}
            formatDate={formatDate}
            onStartActivity={() => onStartActivity(act.id)}
            onFileSelect={(files) => handleFileSelect(act.id, files)}
            onRemoveFile={(i) => handleRemoveFile(act.id, i)}
            onSubmit={() => handleSubmit(act.id)}
            isSubmitting={isSubmitting[act.id] || false}
          />
        );
      })}
    </div>
  );
}