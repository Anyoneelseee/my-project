"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
            subscription.unsubscribe();
            proceedWithSession();
          }
        });

        const proceedWithSession = async () => {
          try {
            let session = null;
            let sessionError = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              const result = await supabase.auth.getSession();
              session = result.data.session;
              sessionError = result.error;
              if (session) break;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (sessionError || !session) {
              console.warn("No session found after retries:", sessionError?.message);
              redirect("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              console.warn("Auth error:", authError?.message);
              redirect("/login");
              return;
            }

            const role = await getUserRole();
            if (!role) {
              console.warn("No user role found");
              redirect("/login");
              return;
            }
            if (role !== "professor") {
              redirect("/dashboard/student");
              return;
            }

            const { data, error } = await supabase.rpc("get_professor_classes");

            if (error) {
              console.warn("Failed to fetch classes:", error.message);
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
              console.log("Validated classes:", validatedClasses);
              setClasses(validatedClasses);
            }
          } catch (err) {
            console.error("Unexpected error in session handling:", err);
            redirect("/login");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        setClasses([]);
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.warn("No session in create class:", sessionError?.message);
        redirect("/login");
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn("Auth error in create class:", authError?.message);
        redirect("/login");
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newClassData = {
        name: newClass.name,
        section: newClass.section,
        course: newClass.course,
        code,
        professor_id: user.id,
      };

      const { error } = await supabase.from("classes").insert([newClassData]);

      if (error) {
        console.warn("Failed to create class:", error.message);
        alert("Failed to create class. Please try again.");
        return;
      }

      const { data, error: fetchError } = await supabase.rpc("get_professor_classes");

      if (fetchError) {
        console.warn("Failed to fetch updated classes:", fetchError.message);
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
        console.log("Updated classes:", validatedClasses);
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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 bg-white shadow-sm border-b">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors" />
            <Breadcrumb>
              <BreadcrumbList className="text-sm">
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-gray-900 font-medium">
                    Home
                    {/* Customize page text color (text-gray-900) in className */}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create a Class Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-[250px] flex flex-col justify-between overflow-hidden rounded-2xl">
              {/* Customize card background gradient (from-purple-50 to-white) and border color (border-purple-200) in className */}
              <CardHeader className="flex-1 flex items-center justify-center p-4">
                <CardTitle className="text-center text-purple-800 font-bold text-xl md:text-2xl">
                  Create a Class
                  {/* Customize title text color (text-purple-800) in className */}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <CreateClassDialog
                  isOpen={isCreateDialogOpen}
                  onOpenChange={setIsCreateDialogOpen}
                  newClass={newClass}
                  setNewClass={setNewClass}
                  onCreateClass={handleCreateClass}
                />
              </CardContent>
            </Card>

            {/* Display Created Classes */}
            {classes.length > 0 ? (
              classes.map((classData) => (
                <Link
                  href={`/dashboard/professor/${classData.id}`}
                  key={classData.id}
                  className="hover:scale-105 transition-transform duration-200"
                >
                  <ClassCard classData={classData} />
                </Link>
              ))
            ) : (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-gray-600 text-lg">
                No classes created yet. Click &quot;Create a Class&quot; to get started!
              </div>
            )}
          </div>
        </div>
        <ClassCodeDialog
          isOpen={isCodeDialogOpen}
          onOpenChange={setIsCodeDialogOpen}
          classCode={classCode}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}