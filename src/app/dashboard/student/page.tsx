"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { StudentSidebar } from "@/components/student-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
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
import ClassCard from "./my-classes/[classId]/components/ClassCard";
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
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
      alert("Please enter a class code.");
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

      if (classError) {
        console.error("Error finding class:", classError.message, classError.details, classError.hint);
        alert(classError.message || "Error occurred while searching for the class. Please try again.");
        return;
      }

      if (!classDataArray || classDataArray.length === 0) {
        console.log("No class found with code:", normalizedClassCode);
        alert("Invalid class code. Please try again.");
        return;
      }

      const classData = classDataArray[0];
      console.log("Found class:", classData);

      const { error: joinError } = await supabase
        .from("class_members")
        .insert([{ class_id: classData.id, student_id: user.id }]);

      if (joinError) {
        if (joinError.code === "23505") {
          alert("You are already a member of this class.");
        } else {
          console.error("Error joining class:", joinError.message, joinError.details, joinError.hint);
          alert("Failed to join class. Please try again.");
        }
        return;
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
      alert("Successfully joined the class!");
    } catch (err) {
      console.error("Unexpected error in join class:", err);
      alert("An unexpected error occurred. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${
        theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
      } text-gray-200 font-['Poppins']`}>
        <div className={`text-xl font-semibold ${
          theme === "light" ? "text-slate-700" : "text-gray-200"
        }`}>Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider className="bg-transparent">
      <StudentSidebar classes={classes} />
      <SidebarInset className="bg-transparent">
        <header className={`flex h-16 items-center justify-between px-6 ${
          theme === "light" ? "bg-slate-200 border-b border-teal-500/20" : "bg-gradient-to-br from-gray-800 to-gray-900 border-b border-teal-500/20"
        }`}>
          <div className="flex items-center gap-4">
            <SidebarTrigger className={`${
              theme === "light" ? "text-slate-700 hover:bg-teal-100" : "text-gray-200 hover:bg-teal-500/20"
            } p-2 rounded-lg transition-colors`} />
            <Breadcrumb>
              <BreadcrumbList className="text-sm">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/dashboard/student"
                    className={`${
                      theme === "light" ? "text-teal-600 hover:text-teal-700" : "text-teal-400 hover:text-teal-300"
                    } transition-colors`}
                  >
                    Student Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className={`mx-2 ${
                  theme === "light" ? "text-slate-400" : "text-gray-400"
                }`} />
                <BreadcrumbItem>
                  <BreadcrumbPage className={`${
                    theme === "light" ? "text-slate-700" : "text-gray-200"
                  }`}>
                    Home
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className={`min-h-screen ${
          theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
        } text-gray-200 p-6 font-['Poppins']`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Join a Class Card */}
            <Card className={`${
              theme === "light" ? "bg-gradient-to-br from-slate-100 to-gray-200" : "bg-gradient-to-br from-gray-800 to-gray-900"
            } border-teal-500/20 hover:shadow-xl transition-all duration-200 h-[250px] flex flex-col justify-between overflow-hidden rounded-xl`}>
              <CardHeader className="flex-1 flex items-center justify-center p-4">
                <CardTitle className={`text-center ${
                  theme === "light" ? "text-slate-900" : "text-teal-400"
                } font-extrabold text-xl md:text-2xl`}>
                  Join a Class
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      className={`w-full ${
                        theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
                      } text-white font-semibold rounded-xl py-2 transition-all duration-200 flex items-center justify-center gap-2 shadow-md`}
                    >
                      <Plus className="w-5 h-5" />
                      Join Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={`${
                    theme === "light" ? "bg-slate-200" : "bg-gradient-to-br from-gray-800 to-gray-900"
                  } border-teal-500/20 rounded-xl p-6 max-w-md`}>
                    <DialogHeader>
                      <DialogTitle className={`${
                        theme === "light" ? "text-slate-900" : "text-teal-400"
                      } text-2xl font-extrabold`}>
                        Join a Class
                      </DialogTitle>
                      <DialogDescription className={`${
                        theme === "light" ? "text-slate-600" : "text-gray-200"
                      } mt-2`}>
                        Enter the class code provided by your professor to join.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-1 gap-2">
                        <Label
                          htmlFor="code"
                          className={`text-sm font-medium ${
                            theme === "light" ? "text-slate-700" : "text-gray-200"
                          }`}
                        >
                          Class Code
                        </Label>
                        <Input
                          id="code"
                          value={classCode}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setClassCode(e.target.value)}
                          placeholder="Enter class code"
                          className={`w-full p-2 ${
                            theme === "light" ? "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500" : "bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400 focus:border-teal-500"
                          } rounded-lg`}
                          autoFocus
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleJoinClass}
                        className={`w-full ${
                          theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
                        } text-white font-semibold py-2 rounded-lg transition-all duration-200`}
                      >
                        Join
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Display Joined Classes */}
            {classes.map((classData) => (
              <Link
                href={`/dashboard/student/my-classes/${classData.id}`}
                key={classData.id}
                className="hover:scale-105 transition-transform duration-200"
              >
                <ClassCard classData={classData} />
              </Link>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
