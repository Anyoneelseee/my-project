// app/dashboard/professor/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
import { Card } from "@/components/ui/card";
import { CreateClassDialog } from "./CreateClassDialog";
import { ClassCodeDialog } from "./ClassCodeDialog";
import { ClassCard } from "./ClassCard";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

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
  const [newClass, setNewClass] = useState({
    name: "",
    section: "",
    course: "",
  });
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // AUTH & DATA INITIALIZATION
  // =========================================================
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

      const proceedWithSession = async () => {
        try {
          let session = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data } = await supabase.auth.getSession();
            session = data?.session;
            if (session) break;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          if (!session) return;

          const { data: userResult } = await supabase.auth.getUser();
          const user = userResult?.user;
          if (!user) return;

          const { data, error } = await supabase.rpc("get_professor_classes");

          if (error || !Array.isArray(data)) {
            setClasses([]);
          } else {
            const validated = (data as Class[]).filter(
              (cls): cls is Class =>
                cls &&
                typeof cls.id === "string" &&
                typeof cls.name === "string" &&
                typeof cls.section === "string" &&
                typeof cls.course === "string" &&
                typeof cls.code === "string"
            );
            setClasses(validated);
          }
        } catch (err) {
          console.error("Error loading classes:", err);
        } finally {
          setIsLoading(false);
        }
      };

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          subscription.unsubscribe();
          proceedWithSession();
        }
      });

      proceedWithSession();
    };

    initialize();
  }, []);

  // =========================================================
  // CREATE CLASS HANDLER
  // =========================================================
  const handleCreateClass = async () => {
    if (!newClass.name || !newClass.section || !newClass.course) {
      toast.error("Please fill in all fields.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult?.user;
      if (!user) return;

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const classData = {
        name: newClass.name,
        section: newClass.section,
        course: newClass.course,
        code,
        professor_id: user.id,
      };

      const { error } = await supabase.from("classes").insert([classData]);
      if (error) {
        toast.error("Failed to create class.");
        return;
      }

      const { data } = await supabase.rpc("get_professor_classes");
      const validated = (data as Class[]).filter(
        (cls): cls is Class =>
          cls &&
          typeof cls.id === "string" &&
          typeof cls.name === "string" &&
          typeof cls.section === "string" &&
          typeof cls.course === "string" &&
          typeof cls.code === "string"
      );

      setClasses(validated);
      setClassCode(code);
      setNewClass({ name: "", section: "", course: "" });
      setIsCreateDialogOpen(false);
      setIsCodeDialogOpen(true);
      toast.success("Class created!");
    } catch{
      toast.error("Error creating class.");
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewClass({ name: "", section: "", course: "" });
    }
    setIsCreateDialogOpen(open);
  };

  // =========================================================
  // LOADING STATE
  // =========================================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="text-xl font-semibold text-gray-200">Loading...</div>
      </div>
    );
  }

  // =========================================================
  // MAIN RENDER
  // =========================================================
  return (
    <SidebarProvider>
      <ProfessorSidebar classes={classes} />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 bg-gradient-to-br from-gray-800 to-gray-900 border-b border-teal-500/20">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-gray-200" />
            <Breadcrumb>
              <BreadcrumbList className="text-sm">
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-teal-400 font-medium">
                    Professor Dashboard
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* CREATE CLASS CARD */}
            <motion.div
              whileHover={{ y: -12, scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="group"
            >
              <Card
                className="
                  relative overflow-hidden rounded-2xl
                  bg-gradient-to-br from-gray-800/95 via-teal-950/90 to-gray-900/95
                  backdrop-blur-xl
                  border border-teal-500/30
                  shadow-xl shadow-teal-500/10
                  hover:shadow-2xl hover:shadow-teal-500/30
                  hover:border-teal-400/60
                  cursor-pointer
                  transition-all duration-500 ease-out
                  h-[260px] flex flex-col justify-center items-center p-6
                  group-hover:ring-4 group-hover:ring-teal-500/20
                "
                onClick={() => setIsCreateDialogOpen(true)}
                aria-label="Create a new class"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                  <div className="absolute top-0 left-0 w-48 h-48 bg-teal-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 animate-pulse" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 animate-pulse delay-500" />
                </div>

                <div className="relative z-10 mb-5">
                  <div className="
                    w-16 h-16 rounded-2xl
                    bg-gradient-to-br from-teal-500/25 to-emerald-500/25
                    backdrop-blur-md
                    border border-teal-400/50
                    shadow-lg
                    flex items-center justify-center
                    group-hover:scale-110 group-hover:rotate-6
                    transition-all duration-500 ease-out
                  ">
                    <Plus className="w-8 h-8 text-teal-300 group-hover:text-white transition-colors duration-300" />
                  </div>
                </div>

                <div className="relative z-10 text-center space-y-2">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-md group-hover:text-teal-300 transition-colors duration-300">
                    Create a Class
                  </h3>
                  <p className="text-sm text-teal-300/90 font-medium group-hover:text-teal-200 transition-colors duration-300">
                    Start teaching in seconds
                  </p>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-center" />
              </Card>
            </motion.div>

            {/* DISPLAY CLASSES – WITH DELETE SUPPORT */}
            {classes.length > 0 ? (
              classes.map((classData) => (
                <div key={classData.id} className="group">
                  <ClassCard
                    classData={classData}
                    onDelete={(deletedId) => {
                      setClasses((prev) => prev.filter((c) => c.id !== deletedId));
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-teal-300 text-lg mt-8">
                No classes created yet. Click &quot;Create a Class&ldquo; to get started!
              </div>
            )}
          </div>
        </div>

        {/* DIALOGS */}
        <CreateClassDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={handleDialogClose}
          newClass={newClass}
          setNewClass={setNewClass}
          onCreateClass={handleCreateClass}
        />

        <ClassCodeDialog
          isOpen={isCodeDialogOpen}
          onOpenChange={setIsCodeDialogOpen}
          classCode={classCode}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}