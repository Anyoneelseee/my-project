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
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ActivityCard } from "../ActivityCard";

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
  title: string;
  image_url: string | null;
  created_at: string;
  start_time: string;
  deadline: string;
}

interface Submission {
  id: string;
  class_id: string;
  student_id: string;
  file_name: string;
  submitted_at: string;
  activity_id: string;
  student_name?: string;
}

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              router.push("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              router.push("/dashboard/student");
              return;
            }

            if (!classId) {
              setError("No classId provided in URL parameters.");
              setIsLoading(false);
              return;
            }

            const normalizedClassId = String(classId);

            const { data: classDataArray, error: classError } = await supabase
              .rpc("get_professor_classes")
              .eq("id", normalizedClassId);

            if (classError || !classDataArray || classDataArray.length === 0) {
              router.push("/dashboard/professor");
              return;
            }

            const classData = classDataArray[0] as Class;
            setClassData(classData);

            const { data: studentsData, error: studentsError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: normalizedClassId });

            if (studentsError) {
              setStudents([]);
            } else {
              setStudents(studentsData as Student[] || []);
            }

            const { data: activitiesData, error: activitiesError } = await supabase
              .from("activities")
              .select("*")
              .eq("class_id", normalizedClassId)
              .order("created_at", { ascending: false }); // Sort newest first

            if (activitiesError) {
              setActivities([]);
            } else {
              setActivities(activitiesData || []);
              const fetchSignedUrls = async () => {
                const urlPromises = activitiesData.map(async (activity) => {
                  if (activity.image_url && !activity.image_url.includes("null")) {
                    const filePath = activity.image_url;
                    const { data, error } = await supabase.storage
                      .from("activity-images")
                      .createSignedUrl(filePath, 3600);
                    if (error) {
                      return { id: activity.id, url: "" };
                    }
                    return { id: activity.id, url: data.signedUrl || "" };
                  }
                  return { id: activity.id, url: "" };
                });
                const urls = await Promise.all(urlPromises);
                const urlMap = urls.reduce((acc, { id, url }) => ({ ...acc, [id]: url }), {});
                setSignedUrls(urlMap);
              };
              await fetchSignedUrls();
            }

            const { data: submissionsData, error: submissionsError } = await supabase
              .from("submissions")
              .select("*")
              .eq("class_id", normalizedClassId);

            if (submissionsError) {
              setError(`Failed to fetch submissions: ${submissionsError.message}`);
              setSubmissions([]);
            } else {
              const submissionsWithNames = await Promise.all(submissionsData.map(async (submission) => {
                const student = students.find((s) => s.student_id === submission.student_id);
                let studentName = "Unknown Student";
                if (student) {
                  studentName = `${student.first_name} ${student.last_name}`.trim();
                } else {
                  const { data: userData, error: userError } = await supabase
                    .from("users")
                    .select("first_name, last_name")
                    .eq("id", submission.student_id)
                    .single();
                  if (!userError && userData) {
                    studentName = `${userData.first_name} ${userData.last_name}`.trim() || "Unknown Student";
                  }
                }
                return {
                  ...submission,
                  student_name: studentName,
                };
              }));
              setSubmissions(submissionsWithNames);
            }
          } catch {
            setError("An unexpected error occurred. Please try again.");
            router.push("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch {
        setError("An unexpected error occurred. Please try again.");
        router.push("/dashboard/professor");
      }
    };

    initialize();
  }, [classId, router]);

  const handleActivityCreated = async () => {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }); // Sort newest first

    if (error) {
      setActivities([]);
    } else {
      setActivities(data || []);
      const fetchSignedUrls = async () => {
        const urlPromises = data.map(async (activity) => {
          if (activity.image_url && !activity.image_url.includes("null")) {
            const filePath = activity.image_url;
            const { data, error } = await supabase.storage
              .from("activity-images")
              .createSignedUrl(filePath, 3600);
            if (error) {
              return { id: activity.id, url: "" };
            }
            return { id: activity.id, url: data.signedUrl || "" };
          }
          return { id: activity.id, url: "" };
        });
        const urls = await Promise.all(urlPromises);
        const urlMap = urls.reduce((acc, { id, url }) => ({ ...acc, [id]: url }), {});
        setSignedUrls(urlMap);
      };
      await fetchSignedUrls();
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from("submissions")
      .select("*")
      .eq("class_id", classId);

    if (submissionsError) {
      setSubmissions([]);
    } else {
      const submissionsWithNames = await Promise.all(submissionsData.map(async (submission) => {
        const student = students.find((s) => s.student_id === submission.student_id);
        let studentName = "Unknown Student";
        if (student) {
          studentName = `${student.first_name} ${student.last_name}`.trim();
        } else {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("first_name, last_name")
            .eq("id", submission.student_id)
            .single();
          if (!userError && userData) {
            studentName = `${userData.first_name} ${userData.last_name}`.trim() || "Unknown Student";
          }
        }
        return {
          ...submission,
          student_name: studentName,
        };
      }));
      setSubmissions(submissionsWithNames);
    }
  };

  // Update activities and submissions when a new activity is created
  useEffect(() => {
    if (isActivityDialogOpen) return; // Skip if dialog is open
    handleActivityCreated();
  }, [classId, students, isActivityDialogOpen]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        {error}
      </div>
    );
  }

  if (!classData) {
    return <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">Class not found.</div>;
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedSubmissions = submissions.filter((sub) => sub.activity_id === selectedActivityId);

  return (
    <SidebarProvider>
      <ProfessorSidebar
        classes={[
          { id: classId as string, name: classData.name, section: classData.section, course: classData.course, code: classData.code },
        ]}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="/dashboard/professor"
                  className="text-teal-300 hover:text-teal-400 text-sm font-medium transition-colors"
                >
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">{classData.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-2xl font-semibold text-teal-400">{classData.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
                  <div>
                    <p className="text-sm font-medium text-teal-300">Section</p>
                    <p className="text-lg font-semibold text-teal-400">{classData.section}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-teal-300">Course</p>
                    <p className="text-lg font-semibold text-teal-400">{classData.course}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-teal-300">Class Code</p>
                    <p className="text-lg font-semibold text-teal-400">{classData.code}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsActivityDialogOpen(true)}
                  className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg px-6 py-2 transition-colors"
                >
                  Create Activity
                </Button>
              </CardContent>
            </Card>

            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-xl font-semibold text-teal-400">Enrolled Students</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 overflow-y-auto max-h-60">
                {students.length === 0 ? (
                  <p className="text-teal-300 text-center">No students have joined this class.</p>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.student_id}
                        className="border border-teal-500/20 rounded-lg p-3 bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                      >
                        <p className="font-semibold text-teal-400">{student.first_name} {student.last_name}</p>
                        <p className="text-sm text-teal-300">Section: {student.section}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
              <CardHeader className="border-b border-teal-500/20">
                <CardTitle className="text-xl font-semibold text-teal-400">Activities</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {activities.length === 0 ? (
                  <p className="text-teal-300 text-center">No activities created yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activities.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        signedUrl={signedUrls[activity.id] || ""}
                        onClick={() => setSelectedActivityId(activity.id)}
                      />
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
          <Dialog open={!!selectedActivityId} onOpenChange={() => setSelectedActivityId(null)}>
            <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 text-teal-300">
              <DialogHeader>
                <DialogTitle className="text-teal-400">
                  Submissions for {selectedActivity?.title || "Untitled Activity"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedSubmissions.length === 0 ? (
                  <p className="text-teal-300 text-center">No submissions yet.</p>
                ) : (
                  selectedSubmissions.map((submission) => (
                    <Link
                      key={`${submission.student_id}-${submission.file_name}`}
                      href={`/dashboard/professor/${classId}/submissions/${encodeURIComponent(
                        `${submission.student_id}/${submission.file_name}`
                      )}`}
                    >
                      <div className="border border-teal-500/20 rounded-lg p-3 bg-gray-700/50 hover:bg-gray-600/50 transition-colors cursor-pointer">
                        <p className="font-semibold text-teal-400">{submission.student_name}</p>
                        <p className="text-sm text-teal-300">File: {submission.file_name}</p>
                        <p className="text-sm text-teal-300">
                          Submitted: {new Date(submission.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
