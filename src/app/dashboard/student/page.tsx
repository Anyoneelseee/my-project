// src/app/dashboard/student/page.tsx
"use client";

import { useState, useEffect } from "react";
import { StudentSidebar } from "@/components/student-sidebar";
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
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";

// Interface for a class
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

// Interface for a class member (returned by Supabase query)
interface ClassMember {
  class_id: string;
  classes: Class;
}

// Interface for the raw Supabase query result (matches TypeScript's inference)
interface RawSupabaseResult {
  class_id: unknown;
  classes: unknown;
}

// Type guard to validate the Class object
function isClass(obj: unknown): obj is Class {
  if (obj === null || typeof obj !== "object") {
    return false;
  }

  return (
    "id" in obj &&
    typeof obj.id === "string" &&
    "name" in obj &&
    typeof obj.name === "string" &&
    "section" in obj &&
    typeof obj.section === "string" &&
    "course" in obj &&
    typeof obj.course === "string" &&
    "code" in obj &&
    typeof obj.code === "string"
  );
}

// Type guard to validate the ClassMember object
function isClassMember(obj: unknown): obj is ClassMember {
  if (obj === null || typeof obj !== "object") {
    return false;
  }

  return (
    "class_id" in obj &&
    typeof obj.class_id === "string" &&
    "classes" in obj &&
    isClass(obj.classes)
  );
}

export default function Page() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user role and joined classes on mount
  useEffect(() => {
    const initialize = async () => {
      // Check user role
      const role = await getUserRole();
      if (!role) {
        redirect("/login");
      }
      if (role !== "student") {
        redirect("/dashboard/professor");
      }

      // Fetch joined classes
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login");
      }

      const { data, error } = await supabase
        .from("class_members")
        .select("class_id, classes!inner(*)")
        .eq("student_id", user.id);

      if (error) {
        console.error("Error fetching joined classes:", error);
      } else {
        const validatedData = (data as RawSupabaseResult[]).filter(isClassMember);
        const joinedClasses = validatedData.map((member) => member.classes);
        setClasses(joinedClasses);
      }
      setIsLoading(false);
    };

    initialize();
  }, []);

  // Handle joining a class
  const handleJoinClass = async () => {
    if (!classCode) {
      alert("Please enter a class code.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }

    // Normalize the class code to uppercase and trim whitespace
    const normalizedClassCode = classCode.trim().toUpperCase();
    console.log("Normalized class code:", normalizedClassCode);

    // Find the class by code
    const { data: classDataArray, error: classError } = await supabase
      .from("classes")
      .select("id, code")
      .eq("code", normalizedClassCode);

    if (classError) {
      console.error("Error finding class:", classError);
      console.log("Error details:", JSON.stringify(classError, null, 2));
      alert("Error occurred while searching for the class. Please try again.");
      return;
    }

    if (!classDataArray || classDataArray.length === 0) {
      console.log("No class found with code:", normalizedClassCode);
      console.log("Class data:", classDataArray);
      alert("Invalid class code. Please try again.");
      return;
    }

    if (classDataArray.length > 1) {
      console.error("Multiple classes found with code:", normalizedClassCode);
      alert("Error: Multiple classes found with this code. Please contact support.");
      return;
    }

    const classData = classDataArray[0];
    console.log("Found class:", classData);

    // Join the class
    const { error: joinError } = await supabase
      .from("class_members")
      .insert([{ class_id: classData.id, student_id: user.id }]);

    if (joinError) {
      if (joinError.code === "23505") {
        alert("You are already a member of this class.");
      } else {
        console.error("Error joining class:", joinError);
        alert("Failed to join class. Please try again.");
      }
      return;
    }

    // Fetch updated joined classes
    const { data, error: fetchError } = await supabase
      .from("class_members")
      .select("class_id, classes!inner(*)")
      .eq("student_id", user.id);

    if (fetchError) {
      console.error("Error fetching updated classes:", fetchError);
    } else {
      const validatedData = (data as RawSupabaseResult[]).filter(isClassMember);
      const joinedClasses = validatedData.map((member) => member.classes);
      setClasses(joinedClasses);
    }

    setClassCode("");
    setIsJoinDialogOpen(false);
    alert("Successfully joined the class!");
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <SidebarProvider>
      <StudentSidebar classes={classes} />
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
                  <BreadcrumbLink href="/dashboard/student">
                    Student Dashboard
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
            {/* Join a Class Card */}
            <Card className="flex flex-col justify-between p-6 border-dashed border-2 border-gray-300 h-[200px]">
              <CardHeader className="flex flex-col items-center justify-center text-center pt-4 md:pt-6 lg:pt-8">
                <CardTitle className="text-lg md:text-xl lg:text-2xl xl:text-3xl">
                  Join a Class
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-end">
                <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="rounded-xl flex items-center gap-2 px-4">
                      <Plus className="w-5 h-5" />
                      Join
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join a Class</DialogTitle>
                      <DialogDescription>
                        Enter the class code provided by your professor to join the class.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="code" className="text-right">
                          Class Code
                        </Label>
                        <Input
                          id="code"
                          value={classCode}
                          onChange={(e) => setClassCode(e.target.value)}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleJoinClass}>Join Class</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Other Placeholder Cards */}
            <Card className="bg-muted/50 aspect-video rounded-xl" />
            <Card className="bg-muted/50 aspect-video rounded-xl" />
          </div>

          {/* Main Content Section */}
          <Card className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}