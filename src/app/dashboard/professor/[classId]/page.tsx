"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import { CreateActivityDialog } from "../CreateActivityDialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  section: string;
}

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

interface Submission {
  student_id: string;
  student_name: string;
  file_name: string;
  submitted_at: string;
}

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
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
              router.push("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              console.warn("Auth error:", authError?.message);
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role) {
              console.warn("No user role found");
              router.push("/login");
              return;
            }
            if (role !== "professor") {
              router.push("/dashboard/student");
              return;
            }

            const { data: classDataArray, error: classError } = await supabase
              .rpc("get_professor_classes")
              .eq("id", classId);

            if (classError || !classDataArray || classDataArray.length === 0) {
              console.warn("Failed to fetch class:", classError?.message);
              router.push("/dashboard/professor");
              return;
            }

            const classData = classDataArray[0] as Class;
            setClassData(classData);

            const { data: studentsData, error: studentsError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: classId });

            if (studentsError) {
              console.warn("Failed to fetch students:", studentsError.message);
              setStudents([]);
            } else {
              console.log("Fetched students data:", studentsData);
              setStudents(studentsData as Student[]);
            }

            const { data: activitiesData, error: activitiesError } = await supabase
              .from("activities")
              .select("*")
              .eq("class_id", classId);

            if (activitiesError) {
              console.warn("Failed to fetch activities:", activitiesError.message);
              setActivities([]);
            } else {
              console.log("Fetched activities:", activitiesData);
              setActivities(activitiesData || []);
            }

            const submissionPromises = (studentsData as Student[] || []).map(async (student: Student) => {
              const { data: objectsData, error: objectsError } = await supabase.storage
                .from("submissions")
                .list(`submissions/${classData.section}/${student.student_id}`, {
                  limit: 100,
                  offset: 0,
                  sortBy: { column: "created_at", order: "desc" },
                });

              if (objectsError) {
                console.warn(`Failed to fetch submissions for student ${student.student_id}:`, objectsError.message);
                return [];
              }

              console.log(`Raw objects data for student ${student.student_id}:`, objectsData);

              return objectsData
                .filter((obj) => obj.name && obj.metadata)
                .map((obj) => {
                  const submission = {
                    student_id: student.student_id,
                    student_name: `${student.first_name} ${student.last_name}`.trim(),
                    file_name: obj.name,
                    submitted_at: obj.created_at || new Date().toISOString(),
                  };
                  console.log("Processed submission:", submission);
                  return submission;
                });
            });

            const submissionsArrays = await Promise.all(submissionPromises);
            const submissions = submissionsArrays.flat();
            console.log("Final submissions:", submissions);
            setSubmissions(submissions);

          } catch (err) {
            console.error("Unexpected error in session handling:", err);
            router.push("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        router.push("/dashboard/professor");
      }
    };

    initialize();
  }, [classId, router]);

  const handleActivityCreated = async () => {
    console.log("Activity created, refreshing activities...");
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("class_id", classId);

    if (error) {
      console.warn("Failed to fetch updated activities:", error.message);
      setActivities([]);
    } else {
      setActivities(data || []);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (!classData) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Class not found.</div>;
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={[{ id: classId as string, name: classData.name, section: classData.section, course: classData.course, code: classData.code }]} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-white shadow-sm">
          <SidebarTrigger className="-ml-1 text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-gray-900 text-sm font-medium">{classData.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gray-100">
          <div className="max-w-7xl mx-auto space-y-8">
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-2xl font-semibold text-gray-900">{classData.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Section</p>
                    <p className="text-lg font-semibold text-gray-900">{classData.section}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Course</p>
                    <p className="text-lg font-semibold text-gray-900">{classData.course}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Class Code</p>
                    <p className="text-lg font-semibold text-gray-900">{classData.code}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsActivityDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 transition-colors"
                >
                  Create Activity
                </Button>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-xl font-semibold text-gray-900">Enrolled Students</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {students.length === 0 ? (
                  <p className="text-gray-500 text-center">No students have joined this class.</p>
                ) : (
                  <div className="space-y-4">
                    {students.map((student) => (
                      <Card key={student.student_id} className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <p className="font-semibold text-gray-900">{student.first_name} {student.last_name}</p>
                          <p className="text-sm text-gray-500">Section: {student.section}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-xl font-semibold text-gray-900">Activities</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-center">No activities created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <Card key={activity.id} className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-2">
                          <p className="font-semibold text-gray-900">{activity.description}</p>
                          {activity.image_url && (
                            <Image
                              src={activity.image_url}
                              alt="Activity"
                              width={300}
                              height={200}
                              className="rounded-md w-full max-w-xs"
                            />
                          )}
                          <p className="text-sm text-gray-500">
                            Created at: {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-xl font-semibold text-gray-900">Student Submissions</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {submissions.length === 0 ? (
                  <p className="text-gray-500 text-center">No submissions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((submission) => (
                      <Link
                        key={`${submission.student_id}-${submission.file_name}`}
                        href={`/dashboard/professor/${classId}/submissions/${encodeURIComponent(`${submission.student_id}/${submission.file_name}`)}`}
                      >
                        <Card
                          className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 transition-shadow transition-colors cursor-pointer"
                        >
                          <CardContent className="p-4 space-y-1">
                            <p className="font-semibold text-gray-900">{submission.student_name}</p>
                            <p className="text-sm text-gray-500">File: {submission.file_name}</p>
                            <p className="text-sm text-gray-500">
                              Submitted: {new Date(submission.submitted_at).toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <CreateActivityDialog
            classId={classId as string}
            isOpen={isActivityDialogOpen}
            onOpenChange={setIsActivityDialogOpen}
            onActivityCreated={handleActivityCreated}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
