// src/app/dashboard/student/my-classes/[classId]/components/ActivityCard.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  ImageIcon,
  File,
  CheckCircle,
  Trash2,
  PlayCircle,
  Calendar,
  Clock,
  Loader2,
  Code,
} from "lucide-react";
import { useState, useEffect, type ComponentType, type SVGProps } from "react";

/* --------------------------------------------------------------- */
interface ActivityCardProps {
  activity: {
    id: string;
    title: string | null;
    description: string;
    image_url: string | null;
    start_time: string | null;
    deadline: string | null;
    submission_type: "code" | "file";
    language?: string;
  };
  status: {
    text: string;
    color: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  };
  signedImageUrl: string | null;
  hasSubmission: boolean;
  isSelected: boolean;
  isInProgress: boolean;
  selectedFiles: File[];
  uploadError: string | null;
  uploadSuccess: boolean;
  submissionFiles: string[];
  submissionViewed: boolean[];
  submissionAi: (number | null)[];
  formatDate: (d: string | null) => string;
  onStartActivity: () => void;
  onFileSelect: (files: FileList | null) => void;
  onRemoveFile: (i: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

/* --------------------------------------------------------------- */
export function ActivityCard({
  activity,
  status,
  signedImageUrl,
  hasSubmission,
  isSelected,
  isInProgress,
  selectedFiles,
  uploadError,
  uploadSuccess,
  submissionFiles,
  submissionViewed,
  submissionAi,
  formatDate,
  onStartActivity,
  onFileSelect,
  onRemoveFile,
  onSubmit,
  isSubmitting,
}: ActivityCardProps) {
  const [descOpen, setDescOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const isCodeType = activity.submission_type === "code";
  const isFileType = activity.submission_type === "file";

  /* ---------- LANGUAGE ---------- */
  const lang = (activity.language ?? "python").toLowerCase();

  const extMap: Record<string, string> = {
    python: ".py",
    c: ".c",
    "c++": ".cpp",
    java: ".java",
  };
  const acceptExt = extMap[lang] ?? ".py";

  const badgeMap: Record<
    string,
    { icon: ComponentType<SVGProps<SVGSVGElement>>; colour: string }
  > = {
    python: { icon: Code, colour: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40" },
    c: { icon: Code, colour: "text-blue-400 bg-blue-500/20 border-blue-500/40" },
    "c++": { icon: Code, colour: "text-indigo-400 bg-indigo-500/20 border-indigo-500/40" },
    java: { icon: Code, colour: "text-orange-400 bg-orange-500/20 border-orange-500/40" },
  };
  const BadgeIcon = badgeMap[lang]?.icon ?? Code;
  const badgeColour = badgeMap[lang]?.colour ?? "text-teal-400 bg-teal-500/20 border-teal-500/40";

  /* ---------- AUTO-CLOSE UPLOAD ---------- */
  useEffect(() => {
    const close = () => setUploadOpen(false);
    window.addEventListener("close-upload-" + activity.id, close);
    return () => window.removeEventListener("close-upload-" + activity.id, close);
  }, [activity.id]);

  /* --------------------------------------------------------------- */
  return (
    <>
      {/* --------------------- CARD --------------------- */}
      <motion.article
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -8 }}
        className="relative group"
      >
        <Card
          className={`
            relative overflow-hidden rounded-2xl border border-teal-500/30
            bg-gradient-to-br from-gray-900/95 via-teal-950/40 to-cyan-950/20
            backdrop-blur-2xl shadow-2xl shadow-teal-500/20
            hover:border-teal-400/70 hover:shadow-3xl hover:shadow-teal-400/40
            transition-all duration-500 w-full flex flex-col
            ${isSelected ? "ring-4 ring-teal-400 ring-offset-4 ring-offset-black/50" : ""}
          `}
        >
          {/* decorative blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-4 -left-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-8 -right-8 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-700" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-tr from-teal-600/20 via-cyan-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <CardHeader className="relative z-10 p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 drop-shadow-xl line-clamp-2">
                {activity.title || "Untitled Activity"}
              </CardTitle>

              {/* status badge */}
              <div
                className={`px-3 py-1 rounded-full backdrop-blur-xl border text-xs font-bold flex items-center gap-1
                  ${status.text === "Submitted"
                    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                    : status.text === "Due Soon"
                    ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300"
                    : status.text === "Overdue"
                    ? "bg-red-500/20 border-red-400/50 text-red-300"
                    : "bg-teal-500/20 border-teal-400/50 text-teal-300"}`}
              >
                <status.icon className="w-4 h-4" />
                {status.text}
              </div>
            </div>
          </CardHeader>

          {/* ---------- CONTENT (grows with text) ---------- */}
          <CardContent className="relative z-10 p-4 pt-0 flex-1 flex flex-col">
            <div className="space-y-3 flex-1">

              {/* language badge */}
              {isFileType && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md border text-xs font-semibold ${badgeColour}`}
                >
                  <BadgeIcon className="w-3.5 h-3.5" />
                  <span>{lang.toUpperCase()}</span>
                </div>
              )}

              {/* dates */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md rounded-xl px-3 py-2 border border-teal-500/20">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <span className="text-teal-200 font-medium">Start</span>
                </div>
                <div className="text-teal-300 text-xs font-mono">
                  {formatDate(activity.start_time)}
                </div>

                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md rounded-xl px-3 py-2 border border-teal-500/20">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-200 font-medium">Deadline</span>
                </div>
                <div className="text-cyan-300 text-xs font-mono">
                  {formatDate(activity.deadline)}
                </div>
              </div>

              {/* description / image buttons */}
              {isFileType && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setDescOpen(true)}>
                    <FileText className="w-3 h-3 mr-1" /> Description
                  </Button>
                  {signedImageUrl && (
                    <Button variant="outline" size="sm" onClick={() => setImgOpen(true)}>
                      <ImageIcon className="w-3 h-3 mr-1" /> Image
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ---------- ACTION BUTTON (always visible) ---------- */}
            <div className="mt-4">
              {isCodeType && !hasSubmission && isInProgress && (
                <Button
                  onClick={onStartActivity}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-base py-4 rounded-xl shadow-2xl shadow-teal-500/50"
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Start Coding
                </Button>
              )}

              {isFileType && !hasSubmission && (
                <Button
                  onClick={() => setUploadOpen(true)}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-base py-4 rounded-xl shadow-2xl shadow-teal-500/50"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Files
                </Button>
              )}

              {hasSubmission && (
                <Button
                  variant="outline"
                  onClick={() => setSubOpen(true)}
                  className="w-full bg-black/50 backdrop-blur-md border-teal-500/60 hover:bg-teal-500/20 hover:border-teal-400 text-teal-300 font-bold text-base py-4 rounded-xl"
                >
                  <File className="w-5 h-5 mr-2" />
                  View Submission
                </Button>
              )}
            </div>
          </CardContent>

          {/* bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
        </Card>
      </motion.article>

      {/* --------------------- MODALS (unchanged) --------------------- */}
      {/* ... (Description, Image, Submission Viewer, Upload Modal – exactly the same as before) ... */}
      {/* (kept identical – only the card layout was changed) */}
      {/* Description */}
      <Dialog open={descOpen} onOpenChange={setDescOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-900/95 to-black/95 border-teal-500/40 rounded-3xl backdrop-blur-2xl p-6 max-w-2xl shadow-3xl shadow-teal-500/30">
          <DialogHeader>
            <DialogTitle className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400">
              {activity.title || "Untitled Activity"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 text-teal-100 text-base leading-relaxed max-h-96 overflow-y-auto bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-teal-500/30">
            {activity.description || "No description available."}
          </div>

          <DialogFooter className="mt-6">
            <Button
              onClick={() => setDescOpen(false)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer */}
      {signedImageUrl && (
        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="bg-gradient-to-br from-gray-900/95 to-black/95 border-teal-500/40 rounded-3xl backdrop-blur-2xl p-6 max-w-4xl shadow-3xl shadow-teal-500/30">
            <DialogHeader>
              <DialogTitle className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400">
                Reference Image
              </DialogTitle>
            </DialogHeader>

            <div className="flex justify-center my-6 bg-black/40 backdrop-blur-md rounded-3xl overflow-hidden border border-teal-500/40">
              <Image
                src={signedImageUrl}
                alt="Activity"
                width={1200}
                height={800}
                className="rounded-3xl max-w-full max-h-screen object-contain"
                unoptimized
              />
            </div>

            <DialogFooter>
              <Button
                onClick={() => setImgOpen(false)}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-xl"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Submission Viewer */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-900/95 to-black/95 border-teal-500/40 rounded-3xl backdrop-blur-2xl p-6 max-w-md shadow-3xl shadow-teal-500/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400">
              Your Submissions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-6 max-h-64 overflow-y-auto">
            {submissionFiles.length > 0 ? (
              submissionFiles.map((name, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-teal-500/40"
                >
                  <p className="text-lg font-bold text-cyan-300">{name}</p>
                  <div className="flex gap-4 mt-3 text-sm text-teal-200">
                    <span>Viewed: {submissionViewed[i] ? "Yes" : "No"}</span>
                    <span>
                      AI Score:{" "}
                      {submissionAi[i] !== null ? `${submissionAi[i]}%` : "Pending"}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-teal-400/70 py-8 text-lg">
                No submissions yet
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setSubOpen(false)}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg py-4 rounded-2xl shadow-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      {isFileType && (
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="bg-gradient-to-br from-gray-900/95 to-black/95 border-teal-500/40 rounded-3xl backdrop-blur-2xl p-6 max-w-lg shadow-3xl shadow-teal-500/30 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400">
                Upload {lang.toUpperCase()} Files
              </DialogTitle>
            </DialogHeader>

            <div className="my-6 space-y-6">
              {!hasSubmission && (
                <>
                  <input
                    type="file"
                    accept={acceptExt}
                    multiple
                    onChange={(e) => onFileSelect(e.target.files)}
                    disabled={isSubmitting}
                    className="w-full h-20 border-4 border-dashed border-teal-500/50 rounded-3xl p-6 bg-black/40 text-cyan-300 text-lg file:mr-6 file:py-4 file:px-8 file:rounded-2xl file:border-0 file:bg-gradient-to-r file:from-teal-600 file:to-cyan-600 file:text-white file:font-bold file:text-lg hover:file:from-teal-500 hover:file:to-cyan-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {selectedFiles.length > 0 && !isSubmitting && (
                    <div className="bg-black/50 backdrop-blur-md rounded-3xl p-6 border border-teal-500/40">
                      <p className="text-xl font-bold text-cyan-300 mb-4">Selected Files</p>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {selectedFiles.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-gray-900/60 rounded-2xl px-4 py-3 border border-teal-500/30"
                          >
                            <span className="text-teal-200 font-mono text-base">{f.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveFile(i)}
                              disabled={isSubmitting}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl disabled:opacity-50"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {uploadError && (
                <p className="text-red-400 text-base font-bold bg-red-900/40 px-6 py-4 rounded-2xl border border-red-500/50 text-center">
                  {uploadError}
                </p>
              )}

              {uploadSuccess && (
                <p className="text-emerald-400 text-xl font-bold bg-emerald-900/40 px-6 py-4 rounded-2xl border border-emerald-500/50 flex items-center justify-center gap-2">
                  <CheckCircle className="w-6 h-6" /> Upload Successful!
                </p>
              )}
            </div>

            <DialogFooter className="flex gap-4 mt-6">
              <Button
                onClick={() => setUploadOpen(false)}
                disabled={isSubmitting}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg px-8 py-6 rounded-2xl disabled:opacity-50"
              >
                Cancel
              </Button>

              {!hasSubmission && (
                <Button
                  onClick={onSubmit}
                  disabled={!selectedFiles.length || isSubmitting}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-2xl shadow-teal-500/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Files"
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}