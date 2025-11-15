"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterUI,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Image as ImageIcon,
  Code,
  Calendar,
  Clock,
  AlertCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

/* ==== JOKES ==== */
const JOKES = [
  `console.log("Hello, World!"); // Classic`,
  `print("Python is love")`,
  `printf("C you later!");`,
  `cout << "C++ is fun" << endl;`,
  `System.out.println("Java runs everywhere");`,
  `alert("JS pops up!");`,
  `echo "PHP is not dead";`,
  `puts "Ruby shines"`,
  `fmt.Println("Go fast!")`,
  `SELECT * FROM jokes;`,
  `git commit -m "It works"`,
  `npm install happiness`,
];

const getJoke = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return JOKES[Math.abs(hash) % JOKES.length];
};

/* ==== TYPES ==== */
interface Activity {
  id: string;
  description: string;
  title: string;
  image_url: string | null;
  created_at: string;
  start_time: string;
  deadline: string;
  language?: string;
  submission_type?: "code" | "file";
}

interface ActivityCardProps {
  activity: Activity;
  signedUrl: string;
  onClick: () => void;
  onDelete?: (activityId: string) => void;
}

/* ==== UTILS ==== */
const getThemeIndex = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 12;
};

const getLanguageColor = (lang?: string) => {
  switch (lang?.toLowerCase()) {
    case "python": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "c": return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    case "c++": return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
    case "java": return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    default: return "bg-teal-500/20 text-teal-300 border-teal-500/40";
  }
};

const getStatusStyle = (status: { color: string }) => {
  const map: Record<string, string> = {
    "bg-gray-600": "bg-gray-500/20 text-gray-300 border-gray-500/40",
    "bg-blue-500": "bg-blue-500/20 text-blue-300 border-blue-500/40",
    "bg-red-500": "bg-red-500/20 text-red-300 border-red-500/40",
    "bg-yellow-500": "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    "bg-teal-500": "bg-teal-500/20 text-teal-300 border-teal-500/40",
  };
  return map[status.color] || map["bg-teal-500"];
};

/* ==== MAIN COMPONENT ==== */
export function ActivityCard({
  activity,
  signedUrl,
  onClick,
  onDelete,
}: ActivityCardProps) {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const theme = getThemeIndex(activity.id);
  const isCode = activity.submission_type === "code";
  const joke = getJoke(activity.id);

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatus = () => {
    const now = new Date();
    const start = activity.start_time ? new Date(activity.start_time) : null;
    const deadline = activity.deadline ? new Date(activity.deadline) : null;

    if (!start && !deadline)
      return { text: "No Dates Set", icon: Calendar, color: "bg-gray-600" };
    if (start && start > now)
      return { text: "Not Started", icon: Clock, color: "bg-blue-500" };
    if (deadline && deadline < now)
      return { text: "Ended", icon: AlertCircle, color: "bg-red-500" };
    if (deadline && deadline.getTime() - now.getTime() < 86400000)
      return { text: "Due Soon", icon: AlertCircle, color: "bg-yellow-500" };
    return { text: "In Progress", icon: Clock, color: "bg-teal-500" };
  };

  const status = getStatus();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_activity_with_cascade", {
        p_activity_id: activity.id,
      });
      if (error) throw error;

      setIsDeleted(true);

      toast.custom(
        () => (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="w-full max-w-sm"
          >
            <div className="bg-gradient-to-br from-emerald-900/95 via-teal-950/90 to-emerald-900/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl p-5 flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-400 drop-shadow-lg" />
              </motion.div>
              <div className="flex-1">
                <p className="text-lg font-bold text-emerald-300">Activity Deleted</p>
                <p className="text-sm text-emerald-200 opacity-90 mt-1">
                  <strong>{activity.title}</strong> has been removed.
                </p>
              </div>
            </div>
          </motion.div>
        ),
        { duration: 3000, position: "top-center" }
      );

      setTimeout(() => onDelete?.(activity.id), 300);
    } catch {
      toast.error("Failed to delete", {
        description: "Please try again.",
        className: "bg-red-900/90 backdrop-blur-md border-red-500/40 text-red-200",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    /* ONE PARENT FRAGMENT */
    <>
      <AnimatePresence>
        {!isDeleted && (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.9,
              y: -30,
              transition: { duration: 0.3, ease: "easeIn" },
            }}
            className="w-full"
          >
            <GlassCard
              theme={theme}
              className="
                h-auto min-h-[360px] w-full max-w-xl mx-auto flex flex-col group cursor-pointer relative
                transition-all duration-300 ease-out
                hover:scale-[1.02] hover:shadow-2xl hover:shadow-teal-500/20
                hover:border-teal-400/50
                active:scale-[0.98]
              "
              onClick={onClick}
            >
              {/* ==== HEADER ==== */}
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-bold text-white drop-shadow-md line-clamp-2 leading-snug flex-1 pr-4 transition-colors group-hover:text-teal-300">
                    {activity.title || "Untitled Activity"}
                  </CardTitle>

                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white
                        backdrop-blur-md border shadow-sm whitespace-nowrap
                        ${getStatusStyle(status)}
                      `}
                    >
                      <status.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{status.text}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteDialog(true);
                      }}
                      className="p-2 rounded-lg bg-red-500/10 backdrop-blur-md border border-red-400/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500/20"
                      aria-label="Delete activity"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </CardHeader>

              {/* ==== LANGUAGE BADGE ==== */}
              <div className="absolute top-16 right-5 z-20">
                <div
                  className={`
                    p-2 rounded-xl backdrop-blur-xl border shadow-md
                    transform rotate-12 group-hover:rotate-0 transition-transform duration-300
                    ${getLanguageColor(activity.language)}
                  `}
                >
                  {isCode ? <Code className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
              </div>

              {/* ==== CONTENT ==== */}
              <CardContent className="px-5 pb-3 flex-1">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDescriptionOpen(true);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-1.5" /> Description
                  </Button>

                  {signedUrl && activity.image_url && !activity.image_url.includes("null") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageOpen(true);
                      }}
                    >
                      <ImageIcon className="w-4 h-4 mr-1.5" /> Image
                    </Button>
                  )}
                </div>

                {isCode && (
                  <div className="p-3 bg-black/40 rounded-lg border border-white/10 font-mono text-sm text-green-300 backdrop-blur-sm leading-tight transition-opacity group-hover:opacity-90">
                    <span className="text-gray-400">{activity.language}</span>
                    <br />
                    <span dangerouslySetInnerHTML={{ __html: joke }} />
                  </div>
                )}
              </CardContent>

              {/* ==== FOOTER ==== */}
              <CardFooter className="px-5 pb-5 pt-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 transition-colors group-hover:bg-white/20">
                    <Calendar className="w-4 h-4 text-white/70" />
                    <span className="text-white/90">Created: {formatDate(activity.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 transition-colors group-hover:bg-white/20">
                    <Clock className="w-4 h-4 text-white/70" />
                    <span className="text-white/90">Start: {formatDate(activity.start_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 transition-colors group-hover:bg-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300">Deadline: {formatDate(activity.deadline)}</span>
                  </div>
                </div>
              </CardFooter>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==== DIALOGS (inside the same fragment) ==== */}
      <Dialog open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-gray-900/95 to-gray-800/95 border-teal-500/30 rounded-2xl backdrop-blur-md p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-teal-400">
              {activity.title || "Untitled Activity"}
            </DialogTitle>
            <DialogDescription className="text-teal-300 text-base flex items-center gap-2">
              <Code className="w-5 h-5" />
              <span className="font-semibold">
                Language: {activity.language?.toUpperCase() ?? "PYTHON"}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 text-teal-100 text-base leading-relaxed max-h-[50vh] overflow-y-auto p-4 bg-gray-800/50 rounded-lg border border-teal-500/20">
            {activity.description || "No description provided."}
          </div>
          <DialogFooterUI className="mt-6">
            <Button
              onClick={() => setIsDescriptionOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-2 rounded-lg"
            >
              Close
            </Button>
          </DialogFooterUI>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl bg-gradient-to-br from-gray-900/95 to-gray-800/95 border-teal-500/30 rounded-2xl backdrop-blur-md p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-teal-400">
              {activity.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center mt-4">
            <Image
              src={signedUrl || "/images/placeholder-image.jpg"}
              alt={activity.title}
              width={800}
              height={600}
              className="rounded-lg max-w-full max-h-[60vh] object-contain shadow-lg border border-teal-500/20"
              unoptimized
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.src.includes("placeholder")) {
                  img.src = "/images/placeholder-image.jpg";
                }
              }}
            />
          </div>
          <DialogFooterUI className="mt-5">
            <Button
              onClick={() => setIsImageOpen(false)}
              className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold px-5 py-2 rounded-lg"
            >
              Close
            </Button>
          </DialogFooterUI>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900/95 via-red-950/40 to-gray-900/95 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-3xl p-8 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-extrabold text-red-400 drop-shadow-md flex items-center gap-3">
              <AlertCircle className="w-7 h-7" />
              Delete Activity?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-red-200 text-lg mt-3">
              This will permanently delete <strong>{activity.title}</strong> and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-4 mt-8">
            <AlertDialogCancel
              className="flex-1 border border-gray-600 bg-gray-800/60 text-gray-300 font-bold text-lg py-3 hover:bg-gray-700 hover:text-white transition-all"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold text-lg py-3 shadow-xl shadow-red-500/40 transition-all"
            >
              {isDeleting ? (
                <span className="flex items-center gap-3">
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Deleting...
                </span>
              ) : (
                "Delete Activity"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}