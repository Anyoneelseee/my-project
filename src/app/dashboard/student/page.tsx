"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { redirect } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { StudentSidebar } from "@/components/student-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import ClassCard from "./my-classes/[classId]/components/ClassCard";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professor_id?: string;
}

export default function StudentDashboard() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "dark" : "dark"
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await new Promise((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
              resolve(session);
            }
          });
          return () => subscription.unsubscribe();
        });

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session found:", sessionError?.message);
          redirect("/login");
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error("Auth error:", authError?.message);
          redirect("/login");
        }

        const role = await getUserRole();
        if (!role) {
          redirect("/login");
        }
        if (role !== "student") {
          redirect("/dashboard/professor");
        }

        const { data, error } = await supabase.rpc("get_student_classes");

        if (error) {
          console.error("Error fetching joined classes:", error.message, error.details, error.hint);
          setClasses([]);
        } else {
          const validatedClasses = (data as Class[]).filter(
            (cls): cls is Class =>
              cls &&
              typeof cls.id === "string" &&
              typeof cls.name === "string" &&
              typeof cls.section === "string" &&
              typeof cls.course === "string" &&
              typeof cls.code === "string"
          );
          setClasses(validatedClasses);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setClasses([]);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const handleJoinClass = async () => {
    if (!classCode) {
      toast.error("Please enter a class code.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("No session in join class:", sessionError?.message);
        redirect("/login");
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("Auth error in join class:", authError?.message);
        redirect("/login");
      }

      const normalizedClassCode = classCode.trim().toUpperCase();
      console.log("Normalized class code:", normalizedClassCode);

      const { data: classDataArray, error: classError } = await supabase
        .rpc("get_class_by_code", { class_code: normalizedClassCode });

      if (classError || !classDataArray || classDataArray.length === 0) {
        console.error("Error finding class:", classError?.message);
        toast.error(classError?.message || "Invalid class code. Please try again.", {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
        return;
      }

      const classData = classDataArray[0];

      if (!classData.id || !classData.name || !classData.professor_id) {
        console.error("Invalid class data:", classData);
        toast.error("Class data is incomplete. Please contact support.", {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
        return;
      }

      console.log("Found class:", classData);

      const { error: joinError } = await supabase
        .from("class_members")
        .insert([{ class_id: classData.id, student_id: user.id }]);

      if (joinError) {
        if (joinError.code === "23505") {
          toast.error("You are already a member of this class.", {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        } else {
          console.error("Error joining class:", joinError.message, joinError.details, joinError.hint);
          toast.error("Failed to join class. Please try again.", {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        }
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const studentName = userError || !userData || !userData.first_name
        ? user.email || "Unknown User"
        : `${userData.first_name}${userData.last_name ? ` ${userData.last_name}` : ""}`;
      if (userError) {
        console.error("Error fetching user data:", userError.message, userError.details, userError.hint);
      }

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          professor_id: classData.professor_id,
          class_id: classData.id,
          message: `Student ${studentName} joined your class "${classData.name}".`,
          created_at: new Date().toISOString(),
        });

      if (notificationError) {
        console.error("Error sending notification:", notificationError.message);
        toast.success(`Class "${classData.name}" joined, but failed to notify professor.`, {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
      } else {
        toast.success(`Successfully joined class "${classData.name}"!`, {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
      }

      const { data, error: fetchError } = await supabase.rpc("get_student_classes");

      if (fetchError) {
        console.error("Error fetching updated classes:", fetchError.message, fetchError.details, fetchError.hint);
      } else {
        const validatedClasses = (data as Class[]).filter(
          (cls): cls is Class =>
            cls &&
            typeof cls.id === "string" &&
            typeof cls.name === "string" &&
            typeof cls.section === "string" &&
            typeof cls.course === "string" &&
            typeof cls.code === "string"
        );
        setClasses(validatedClasses);
      }

      setClassCode("");
      setIsJoinDialogOpen(false);
    } catch (err) {
      console.error("Unexpected error in join class:", err);
      toast.error("An unexpected error occurred. Please try again.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${
        theme === "light" 
          ? "bg-gradient-to-br from-slate-50 to-slate-100" 
          : "bg-gradient-to-br from-slate-950 via-indigo-950/80 to-violet-950/90"
      }`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`w-8 h-8 border-2 ${
            theme === "light" 
              ? "border-cyan-400/30 border-t-cyan-400" 
              : "border-cyan-500/30 border-t-cyan-500"
          } rounded-full mr-3`}
        />
        <span className={`text-xl font-medium ${
          theme === "light" ? "text-slate-700" : "text-cyan-300"
        }`}>Loading...</span>
      </div>
    );
  }

  return (
    <SidebarProvider className="bg-transparent">
      <StudentSidebar classes={classes} />
      <SidebarInset className="bg-transparent">
        <header className={`flex h-16 items-center justify-between px-4 md:px-6 ${
          theme === "light" 
            ? "bg-gradient-to-r from-slate-50 to-white/80 border-b border-cyan-200/20 backdrop-blur-xl" 
            : "bg-gradient-to-r from-slate-950/95 via-indigo-950/90 to-violet-950/95 border-b border-cyan-500/20 backdrop-blur-xl shadow-sm shadow-cyan-500/5"
        }`}>
          <motion.div 
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <SidebarTrigger 
              className={`p-3 rounded-2xl transition-all duration-300 ${
                theme === "light" 
                  ? "text-slate-700 hover:bg-cyan-100 hover:shadow-md hover:shadow-cyan-200/50" 
                  : "text-cyan-300 hover:bg-cyan-500/10 hover:shadow-lg hover:shadow-cyan-500/20"
              }`} 
            />
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList className="text-sm font-medium">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/dashboard/student"
                    className={`transition-colors duration-300 ${
                      theme === "light" 
                        ? "text-cyan-600 hover:text-cyan-700" 
                        : "text-cyan-400 hover:text-cyan-300"
                    }`}
                  >
                    Student Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className={`mx-2 ${
                  theme === "light" ? "text-slate-400" : "text-cyan-500/50"
                }`} />
                <BreadcrumbItem>
                  <span className={`${
                    theme === "light" ? "text-slate-500" : "text-cyan-400/70"
                  }`}>My Classes</span>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </motion.div>
        </header>

        <div className={`min-h-[calc(100vh-4rem)] p-4 sm:p-6 ${
          theme === "light" 
            ? "bg-gradient-to-br from-slate-50/90 via-white/80 to-slate-100/90" 
            : "bg-gradient-to-br from-slate-950/95 via-indigo-950/80 to-violet-950/90"
        } backdrop-blur-xl`}>
          {/* FIXED GRID — This is the only changed part */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[1fr]"
          >
            {/* Join a Class Card – 1.5× wider, same height */}
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="sm:col-span-2 lg:col-span-2 xl:col-span-2"
            >
              <Card className={`
                relative h-full flex flex-col justify-between overflow-hidden rounded-3xl border cursor-pointer group
                ${theme === "light"
                  ? "bg-gradient-to-br from-white/80 to-slate-50/70 border-cyan-200/30 shadow-xl backdrop-blur-xl hover:shadow-2xl hover:shadow-cyan-200/20"
                  : "bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-violet-950/95 border-cyan-500/30 shadow-2xl backdrop-blur-2xl hover:shadow-3xl hover:shadow-cyan-500/30"
                } transition-all duration-500
              `}>
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <CardHeader className="flex-1 flex items-center justify-center p-8">
                  <CardTitle className={`text-center font-extrabold text-3xl lg:text-4xl ${
                    theme === "light" 
                      ? "text-slate-900 drop-shadow-lg" 
                      : "bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent drop-shadow-2xl"
                  }`}>
                    Join a Class
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-8 pt-0">
                  <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                    <DialogTrigger asChild>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                        <Button className={`
                          w-full rounded-2xl py-7 text-xl font-bold shadow-xl flex items-center justify-center gap-4
                          ${theme === "light"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                            : "bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/40 text-cyan-300 hover:from-cyan-500/30 hover:to-violet-500/30"
                          } backdrop-blur-md
                        `}>
                          <Plus className="w-8 h-8" />
                          Join Class
                        </Button>
                      </motion.div>
                    </DialogTrigger>
                    <DialogContent className={`
                      ${theme === "light"
                        ? "bg-gradient-to-br from-white/95 to-slate-50/80 border-cyan-200/30"
                        : "bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-violet-950/95 border-cyan-500/30"
                      } rounded-3xl p-6 max-w-md backdrop-blur-2xl shadow-2xl shadow-cyan-500/10
                    `}>
                      <DialogHeader>
                        <DialogTitle className={`${
                          theme === "light" ? "text-slate-900" : "bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent"
                        } text-2xl font-extrabold drop-shadow-lg`}>
                          Join a Class
                        </DialogTitle>
                        <DialogDescription className={`mt-2 ${
                          theme === "light" ? "text-slate-600" : "text-cyan-200/80"
                        }`}>
                          Enter the class code provided by your professor to join.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="code" className={`text-sm font-medium ${theme === "light" ? "text-slate-700" : "text-cyan-300"}`}>
                            Class Code
                          </Label>
                          <Input
                            id="code"
                            value={classCode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setClassCode(e.target.value)}
                            placeholder="Enter class code"
                            className={`
                              w-full p-3 rounded-2xl font-mono font-semibold tracking-wider
                              ${theme === "light"
                                ? "bg-white/80 border-slate-300/50 text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 shadow-sm"
                                : "bg-slate-800/50 border-cyan-500/30 text-cyan-200 placeholder-cyan-400/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 shadow-lg shadow-cyan-500/10"
                              }
                              backdrop-blur-md transition-all duration-300
                            `}
                            autoFocus
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button onClick={handleJoinClass} className={`
                            w-full rounded-2xl py-3 font-bold shadow-lg transition-all duration-300 flex items-center justify-center gap-2
                            ${theme === "light"
                              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-cyan-300/30 hover:shadow-cyan-400/50"
                              : "bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/40 text-cyan-300 hover:from-cyan-500/30 hover:to-violet-500/30 hover:border-cyan-400/60 hover:text-cyan-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
                            } backdrop-blur-md
                          `}>
                            Join Class
                          </Button>
                        </motion.div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>

                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Card>
            </motion.div>

            {/* Display Joined Classes – Perfect size now */}
            <AnimatePresence>
              {classes.map((classData, index) => (
                <motion.div
                  key={classData.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="relative overflow-hidden"
                >
                  <Link href={`/dashboard/student/my-classes/${classData.id}`} className="block h-full">
                    <ClassCard classData={classData} />
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}