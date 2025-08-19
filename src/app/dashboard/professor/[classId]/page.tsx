"use client";

// app/dashboard/professor/[classId]/page.tsx
// Tabbed layout for Overview, Enrolled Students, and Activities with submissions dialog

import { useParams, useRouter } from "next/navigation";
import type { Session, AuthError } from "@supabase/supabase-js";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Book, CheckCircle, Code } from "lucide-react";
import { ActivityCard } from "../ActivityCard";

interface Class {
  professorEmail: string;
  professorName: string;
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
  is_viewed: boolean;
}

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [optimisticSubmissions, setOptimisticSubmissions] = useState<Submission[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "activities">("overview");

  // Initialize data fetching and auth
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
            let session: Session | null = null;
            let sessionError: AuthError | null = null;
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
              setStudents((studentsData as Student[]) || []);
            }

            const { data: activitiesData, error: activitiesError } = await supabase
              .from("activities")
              .select("*")
              .eq("class_id", normalizedClassId)
              .order("created_at", { ascending: false });

            if (activitiesError) {
              setActivities([]);
            } else {
              setActivities(activitiesData || []);
              const fetchSignedUrls = async () => {
                const urlPromises = (activitiesData || []).map(async (activity) => {
                  if (activity.image_url && !activity.image_url.includes("null")) {
                    const filePath = activity.image_url as string;
                    const { data, error } = await supabase.storage
                      .from("activity-images")
                      .createSignedUrl(filePath, 3600);
                    if (error) return { id: activity.id, url: "" };
                    return { id: activity.id, url: data.signedUrl || "" };
                  }
                  return { id: activity.id, url: "" };
                });
                const urls = await Promise.all(urlPromises);
                const urlMap = urls.reduce((acc, { id, url }) => ({ ...acc, [id]: url }), {} as Record<string, string>);
                setSignedUrls(urlMap);
              };
              await fetchSignedUrls();
            }

            const { data: submissionsData, error: submissionsError } = await supabase
              .from("submissions")
              .select("*, is_viewed")
              .eq("class_id", normalizedClassId);

            if (submissionsError) {
              setError(`Failed to fetch submissions: ${submissionsError.message}`);
              setSubmissions([]);
              setOptimisticSubmissions([]);
            } else {
              const submissionsWithNames = await Promise.all((submissionsData || []).map(async (submission) => {
                const student = (students || []).find((s) => s.student_id === submission.student_id);
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
                return { ...submission, student_name: studentName } as Submission;
              }));
              setSubmissions(submissionsWithNames);
              setOptimisticSubmissions(submissionsWithNames);
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

  // Sync optimistic submissions with fetched submissions
  useEffect(() => {
    setOptimisticSubmissions(submissions);
  }, [submissions]);

  // Handle activity creation and refresh submissions
  const handleActivityCreated = async () => {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    if (error) {
      setActivities([]);
    } else {
      setActivities(data || []);
      const fetchSignedUrls = async () => {
        const urlPromises = (data || []).map(async (activity) => {
          if (activity.image_url && !activity.image_url.includes("null")) {
            const filePath = activity.image_url as string;
            const { data, error } = await supabase.storage
              .from("activity-images")
              .createSignedUrl(filePath, 3600);
            if (error) return { id: activity.id, url: "" };
            return { id: activity.id, url: data.signedUrl || "" };
          }
          return { id: activity.id, url: "" };
        });
        const urls = await Promise.all(urlPromises);
        const urlMap = urls.reduce((acc, { id, url }) => ({ ...acc, [id]: url }), {} as Record<string, string>);
        setSignedUrls(urlMap);
      };
      await fetchSignedUrls();
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from("submissions")
      .select("*, is_viewed")
      .eq("class_id", classId);

    if (submissionsError) {
      setSubmissions([]);
      setOptimisticSubmissions([]);
    } else {
      const submissionsWithNames = await Promise.all((submissionsData || []).map(async (submission) => {
        const student = (students || []).find((s) => s.student_id === submission.student_id);
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
        return { ...submission, student_name: studentName } as Submission;
      }));
      setSubmissions(submissionsWithNames);
      setOptimisticSubmissions(submissionsWithNames);
    }
  };

  // Refresh activities and submissions when dialog closes
  useEffect(() => {
    if (isActivityDialogOpen) return; // avoid refresh while creating
    handleActivityCreated();
  }, [classId, students, isActivityDialogOpen]);

  // Mark submission as viewed
  const markSubmissionViewed = async (submissionId: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ is_viewed: true })
      .eq("id", submissionId);
    if (error) {
      console.error("Failed to mark viewed:", error.message);
      return false;
    }
    return true;
  };

  // Handle submission click with automatic view marking
  const handleSubmissionClick = async (submission: Submission) => {
    if (!submission.is_viewed) {
      const newSubmissions = optimisticSubmissions.map((s) =>
        s.id === submission.id ? { ...s, is_viewed: true } : s
      );
      setOptimisticSubmissions(newSubmissions); // Optimistic update
      const success = await markSubmissionViewed(submission.id);
      if (!success) {
        setOptimisticSubmissions(submissions); // Rollback on error
        toast.error("Failed to mark as viewed. Please try again.");
      } else {
        toast.success("Mark as Viewed.");
      }
    }
    router.push(
      `/dashboard/professor/${classId}/submissions/${encodeURIComponent(
        `${submission.student_id}/${submission.file_name}`
      )}`
    );
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        Loading...
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        {error}
      </div>
    );

  if (!classData)
    return (
      <div className="flex items-center justify-center h-screen text-teal-300 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        Class not found.
      </div>
    );

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedSubmissions = optimisticSubmissions.filter((sub) => sub.activity_id === selectedActivityId);

  return (
    <SidebarProvider>
      <ProfessorSidebar
        classes={[
          {
            id: classId as string,
            name: classData.name,
            section: classData.section,
            course: classData.course,
            code: classData.code,
          },
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
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">
                  {classData.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex-1 p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-teal-500/20 mb-4">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "overview"
                    ? "bg-gray-800 text-teal-400 border-b-2 border-teal-400"
                    : "text-teal-300 hover:text-teal-400"
                }`}
              >
                Create Activity
              </button>
              <button
                onClick={() => setActiveTab("students")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "students"
                    ? "bg-gray-800 text-teal-400 border-b-2 border-teal-400"
                    : "text-teal-300 hover:text-teal-400"
                }`}
              >
                Enrolled Students
              </button>
              <button
                onClick={() => setActiveTab("activities")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "activities"
                    ? "bg-gray-800 text-teal-400 border-b-2 border-teal-400"
                    : "text-teal-300 hover:text-teal-400"
                }`}
              >
                Activities
              </button>
            </div>

{/* Overview */}
{activeTab === "overview" && (
  <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
    <CardHeader className="border-b border-teal-500/20 py-4">
      <CardTitle className="text-2xl md:text-3xl font-semibold text-teal-400">
        {classData.name}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-6 space-y-6">
      <div className="space-y-3">
             <Button
        onClick={() => setIsActivityDialogOpen(true)}
        className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white font-semibold rounded-lg px-8 py-3 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:ring-2 focus:ring-teal-400 focus:ring-opacity-50"
      >
        Create Activity
      </Button>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
          <Book className="w-5 h-5 text-teal-300" />
          <div>
            <p className="text-sm font-medium text-teal-300">Course</p>
            <p className="text-lg font-semibold text-teal-400">{classData.course}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
          <Book className="w-5 h-5 text-teal-300" />
          <div>
            <p className="text-sm font-medium text-teal-300">Section</p>
            <p className="text-lg font-semibold text-teal-400">{classData.section}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-500/30">
          <Code className="w-5 h-5 text-teal-300" />
          <div>
            <p className="text-sm font-medium text-teal-300">Class Code</p>
            <p className="text-lg font-semibold text-teal-400">{classData.code}</p>
          </div>
        </div>
      </div>
  
    </CardContent>
  </Card>
)}

            {/* Students */}
            {activeTab === "students" && (
              <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
                <CardHeader className="border-b border-teal-500/20">
                  <CardTitle className="text-xl font-semibold text-teal-400">
                    Enrolled Students
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {students.length === 0 ? (
                    <div className="flex items-center justify-center py-8 bg-gray-700/50 rounded-lg border border-teal-500/20">
                      <p className="text-teal-300 text-lg font-medium">No students have joined this class.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-teal-500/20 bg-gradient-to-br from-gray-800/90 to-gray-900/90">
                      <Table className="w-full">
                        <TableHeader className="sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 shadow-sm z-10">
                          <TableRow className="border-teal-500/20">
                            <TableHead className="text-teal-300 font-semibold px-4 py-3">First Name</TableHead>
                            <TableHead className="text-teal-300 font-semibold px-4 py-3">Last Name</TableHead>
                            <TableHead className="text-teal-300 font-semibold px-4 py-3">Section</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student, index) => (
                            <TableRow
                              key={student.student_id}
                              className={`border-teal-500/20 transition-colors ${
                                index % 2 === 0 ? "bg-gray-700/30" : "bg-transparent"
                              } hover:bg-gray-600/50`}
                            >
                              <TableCell className="text-teal-400 font-medium px-4 py-3 truncate max-w-[200px]">
                                {student.first_name}
                              </TableCell>
                              <TableCell className="text-teal-400 font-medium px-4 py-3 truncate max-w-[200px]">
                                {student.last_name}
                              </TableCell>
                              <TableCell className="text-teal-300 px-4 py-3">
                                {student.section}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Activities */}
            {activeTab === "activities" && (
              <Card className="border-teal-500/20 shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
                <CardHeader className="border-b border-teal-500/20">
                  <CardTitle className="text-xl font-semibold text-teal-400">
                    Activities
                  </CardTitle>
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
            )}
          </div>

          {/* Create Activity Dialog */}
          <CreateActivityDialog
            classId={classId as string}
            isOpen={isActivityDialogOpen}
            onOpenChange={setIsActivityDialogOpen}
            onActivityCreated={handleActivityCreated}
          />

          {/* Submissions Modal */}
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
                    <div
                      key={`${submission.student_id}-${submission.file_name}`}
                      className="border border-teal-500/20 rounded-lg p-3 bg-gray-700/50 hover:bg-gray-600/50 transition-colors flex items-center justify-between"
                    >
                      <div
                        onClick={() => handleSubmissionClick(submission)}
                        className="flex-1 cursor-pointer"
                      >
                        <p className="font-semibold text-teal-400">{submission.student_name}</p>
                        <p className="text-sm text-teal-300">File: {submission.file_name}</p>
                        <p className="text-sm text-teal-300">
                          Submitted: {new Date(submission.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {submission.is_viewed && (
                          <CheckCircle className="h-5 w-5 text-teal-400" aria-label="Submission viewed" />
                        )}
                      </div>
                    </div>
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