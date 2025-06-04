"use client";

import { useState, useEffect } from "react";
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

// Interface for a class
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

// Redesign ClassCard Component
function ClassCard({ classData }: { classData: Class }) {
  return (
    <Card className="bg-white shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300 h-[250px] flex flex-col justify-between overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-50 to-white p-4 rounded-t-xl">
        <CardTitle className="text-xl md:text-2xl font-bold text-green-800 truncate">
          {classData.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <p className="text-sm md:text-base text-gray-600">
            Section: {classData.section}
          </p>
          <p className="text-sm md:text-base text-gray-600">
            Course: {classData.course}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm md:text-base font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full inline-block">
            Code: {classData.code}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentDashboard() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <StudentSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 bg-white shadow-sm border-b">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors" />
            <Breadcrumb>
              <BreadcrumbList className="text-sm">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard/student" className="text-blue-600 hover:underline">
                    Student Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="mx-2 text-gray-400" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-gray-900">Home</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Join a Class Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-[250px] flex flex-col justify-between overflow-hidden rounded-2xl">
              <CardHeader className="flex-1 flex items-center justify-center p-4">
                <CardTitle className="text-center text-blue-800 font-bold text-xl md:text-2xl">
                  Join a Class
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 transition-colors flex items-center justify-center gap-2 shadow-md"
                    >
                      <Plus className="w-5 h-5" />
                      Join Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-semibold text-gray-900">
                        Join a Class
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 mt-2">
                        Enter the class code provided by your professor to join.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-1 gap-2">
                        <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                          Class Code
                        </Label>
                        <Input
                          id="code"
                          value={classCode}
                          onChange={(e) => setClassCode(e.target.value)}
                          placeholder="Enter class code"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleJoinClass}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
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