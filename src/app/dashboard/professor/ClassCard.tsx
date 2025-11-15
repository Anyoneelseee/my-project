// components/ClassCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  BookOpen,
  Users,
  Code,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface ClassCardProps {
  classData: Class;
  onClick?: () => void;
  onDelete?: (classId: string) => void;
}

interface StudentCountRow {
  class_id: string;
  class_name: string;
  section: string;
  student_count: number;
}

export function ClassCard({ classData, onClick, onDelete }: ClassCardProps) {
  const router = useRouter();
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // === FETCH STUDENT COUNT ===
  useEffect(() => {
    const fetchStudentCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc("get_class_student_counts", {
          professor_id_input: user.id,
        });

      if (error) {
        console.error("Error fetching student counts:", error);
        setStudentCount(0);
        return;
      }

      const row = (data as StudentCountRow[]).find(
        (r) => r.class_id === classData.id
      );

      setStudentCount(row ? Number(row.student_count) : 0);
    };

    fetchStudentCount();

    const channel = supabase
      .channel(`class_${classData.id}_members`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `class_id=eq.${classData.id}`,
        },
        () => fetchStudentCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classData.id]);

  // === COPY CODE ===
  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(classData.code);
      setIsCopied(true);

      toast.success("Code copied!", {
        icon: <Check className="w-5 h-5 text-emerald-400" />,
        className: "border border-emerald-500/30",
        style: {
          background: "rgba(16, 185, 129, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#ecfdf5",
          maxWidth: "320px",
        },
        descriptionClassName: "text-xs text-emerald-200 mt-1 opacity-100",
      });

      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy", {
        icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
        className: "border border-red-500/30",
        style: {
          background: "rgba(239, 68, 68, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#fee2e2",
          maxWidth: "320px",
        },
        descriptionClassName: "text-xs text-red-200 mt-1 opacity-100",
      });
    }
  };

  // === DELETE CLASS VIA RPC ===
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .rpc("delete_class_with_cascade", {
          p_class_id: classData.id,
        });

      if (error) throw error;

      toast.success("Class deleted", {
        icon: <Trash2 className="w-5 h-5 text-emerald-400" />,
        className: "border border-emerald-500/30",
        style: {
          background: "rgba(16, 185, 129, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#ecfdf5",
          maxWidth: "320px",
        },
        descriptionClassName: "text-xs text-emerald-200 mt-1 opacity-100",
      });

      onDelete?.(classData.id);
      setShowDeleteDialog(false);
    } catch (err) {
      const error = err as Error;
      toast.error("Failed to delete", {
        description: error.message || "Please try again.",
        icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
        className: "border border-red-500/30",
        style: {
          background: "rgba(239, 68, 68, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#fee2e2",
          maxWidth: "320px",
        },
        descriptionClassName: "text-xs text-red-200 mt-1 opacity-100",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // === CARD CLICK ===
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      router.push(`/dashboard/professor/${classData.id}`);
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -8, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="group"
      >
        <Card
          className="
            relative overflow-hidden rounded-2xl border border-teal-500/30
            bg-gradient-to-br from-gray-900/95 via-blue-950/90 to-gray-900/95
            backdrop-blur-xl shadow-xl
            cursor-pointer
            transition-all duration-300 ease-out
            hover:shadow-2xl hover:shadow-teal-500/20
            hover:border-teal-400/60
            active:scale-[0.98]
          "
          onClick={handleCardClick}
          aria-label={`Open class: ${classData.name}`}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-teal-600/10 via-transparent to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Header */}
          <CardHeader className="pb-3 pt-6 px-6 relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/20 backdrop-blur-md border border-teal-400/40 shadow-md group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="w-6 h-6 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white drop-shadow-md line-clamp-1 group-hover:text-teal-300 transition-colors">
                    {classData.name}
                  </h3>
                  <p className="text-sm text-teal-300 font-medium mt-0.5">
                    {classData.course}
                  </p>
                </div>
              </div>

              {/* DELETE BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="p-2 rounded-lg bg-red-500/10 backdrop-blur-md border border-red-400/30 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500/20"
                aria-label="Delete class"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </CardHeader>

          {/* Body */}
          <CardContent className="px-6 pb-6 space-y-4">
            {/* Section & Code */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-medium text-teal-300">
                  Section {classData.section}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-mono font-bold text-purple-300">
                  {classData.code}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="ml-1 p-1.5 rounded-lg bg-purple-500/20 backdrop-blur-md border border-purple-400/40 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-purple-500/30"
                  aria-label="Copy class code"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-purple-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Student Count */}
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-emerald-300 text-xs font-bold shadow-sm">
                <Users className="w-3.5 h-3.5" />
                {studentCount === null ? (
                  <span className="w-8 h-3 bg-emerald-400/30 rounded animate-pulse" />
                ) : (
                  <>{studentCount} {studentCount === 1 ? "student" : "students"}</>
                )}
              </div>
            </div>

            {/* Hover Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </CardContent>
        </Card>
      </motion.div>

      {/* CONFIRM DELETE DIALOG */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900/95 via-red-950/90 to-gray-900/95 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-2xl p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-extrabold text-red-400 drop-shadow-md flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Delete Class?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-red-200 mt-2">
              This will permanently delete <strong>{classData.name}</strong> and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex gap-3 mt-6">
            <AlertDialogCancel
              className="flex-1 border border-gray-600 bg-gray-800/50 text-gray-300 font-medium hover:bg-gray-700 hover:text-gray-100 hover:border-gray-500 transition-all"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold shadow-lg shadow-red-500/30 transition-all"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Deleting...
                </span>
              ) : (
                "Delete Class"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}