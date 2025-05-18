"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateClassDialog } from "./CreateClassDialog";
import { ClassCodeDialog } from "./ClassCodeDialog";
import { ClassCard } from "./ClassCard";
import Link from "next/link";

// Interface for a class
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

export default function ProfessorDashboard() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", section: "", course: "" });
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Wait for Supabase to restore session
        await new Promise((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
              resolve(session);
            }
          });
          return () => subscription.unsubscribe();
        });

        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session found:", sessionError?.message);
          redirect("/login");
          return;
        }

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error("Auth error:", authError?.message);
          redirect("/login");
          return;
        }

        // Check user role
        const role = await getUserRole();
        if (!role) {
          redirect("/login");
          return;
        }
        if (role !== "professor") {
          redirect("/dashboard/student");
          return;
        }

        // Fetch classes using RPC
        const { data, error } = await supabase
          .rpc("get_professor_classes");

        if (error) {
          console.error("Error fetching classes:", error.message, error.details, error.hint);
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

  const handleCreateClass = async () => {
    if (!newClass.name || !newClass.section || !newClass.course) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      // Ensure session is valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("No session in create class:", sessionError?.message);
        redirect("/login");
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("Auth error in create class:", authError?.message);
        redirect("/login");
        return;
      }

      // Generate a unique class code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newClassData = {
        name: newClass.name,
        section: newClass.section,
        course: newClass.course,
        code,
        professor_id: user.id,
      };

      const { error } = await supabase
        .from("classes")
        .insert([newClassData]);

      if (error) {
        console.error("Error creating class:", error.message, error.details, error.hint);
        alert("Failed to create class. Please try again.");
        return;
      }

      // Fetch updated classes
      const { data, error: fetchError } = await supabase
        .rpc("get_professor_classes");

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

      setClassCode(code);
      setNewClass({ name: "", section: "", course: "" });
      setIsCreateDialogOpen(false);
      setIsCodeDialogOpen(true);
    } catch (err) {
      console.error("Unexpected error in create class:", err);
      alert("An unexpected error occurred. Please try again.");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard/professor">
                    Professor Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Home</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            {/* Create Class Card */}
            <Card className="flex flex-col justify-between p-6 border-dashed border-2 border-gray-300 h-[200px]">
              <CardHeader className="flex flex-col items-center justify-center text-center pt-4 md:pt-6 lg:pt-8">
                <CardTitle className="text-lg md:text-xl lg:text-2xl xl:text-3xl">
                  Create a Class
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-end">
                <CreateClassDialog
                  isOpen={isCreateDialogOpen}
                  onOpenChange={setIsCreateDialogOpen}
                  newClass={newClass}
                  setNewClass={setNewClass}
                  onCreateClass={handleCreateClass}
                />
              </CardContent>
            </Card>

            {/* Display Existing Classes */}
            {classes.map((classData) => (
              <Link href={`/dashboard/professor/${classData.id}`} key={classData.id}>
                <ClassCard classData={classData} />
              </Link>
            ))}
          </div>
          <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>

        {/* Class Code Dialog */}
        <ClassCodeDialog
          isOpen={isCodeDialogOpen}
          onOpenChange={setIsCodeDialogOpen}
          classCode={classCode}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}