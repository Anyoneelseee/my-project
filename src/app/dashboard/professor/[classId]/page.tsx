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
import { ActivityCard } from "../ActivityCard";
import { CheckCircle } from "lucide-react"; // RESTORED

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
  is_viewed: boolean; // RESTORED
}

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState<Class | null>(null);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
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
            for (let attempt = 0; attempt < 3; attempt++) {
              const { data } = await supabase.auth.getSession();
              session = data?.session;
              if (session) break;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (!session) {
              router.push("/login");
              return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
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

            // FETCH ALL CLASSES
            const { data: allData, error: allError } = await supabase.rpc("get_professor_classes");
            if (!allError && Array.isArray(allData)) {
              const validated = allData.filter(
                (c): c is Class => c && typeof c.id === "string" && typeof c.name === "string"
              );
              setAllClasses(validated);
            }

            // FETCH CURRENT CLASS
            const { data: classDataArray, error: classError } = await supabase
              .rpc("get_professor_classes")
              .eq("id", normalizedClassId);

            if (classError || !classDataArray || classDataArray.length === 0) {
              router.push("/dashboard/professor");
              return;
            }

            setClassData(classDataArray[0] as Class);

            // FETCH STUDENTS
            const { data: studentsData, error: studentsError } = await supabase
              .rpc("get_class_student_profiles", { class_id_input: normalizedClassId });
            setStudents(studentsError ? [] : (studentsData as Student[]) || []);

            // FETCH ACTIVITIES
            const { data: activitiesData, error: activitiesError } = await supabase
              .from("activities")
              .select("*")
              .eq("class_id", normalizedClassId)
              .order("created_at", { ascending: false });

            if (!activitiesError && activitiesData) {
              setActivities(activitiesData);
              const fetchSignedUrls = async () => {
                const urlPromises = activitiesData.map(async (activity) => {
                  if (activity.image_url && !activity.image_url.includes("null")) {
                    const { data, error } = await supabase.storage
                      .from("activity-images")
                      .createSignedUrl(activity.image_url as string, 3600);
                    return { id: activity.id, url: error ? "" : data?.signedUrl || "" };
                  }
                  return { id: activity.id, url: "" };
                });
                const urls = await Promise.all(urlPromises);
                const urlMap = urls.reduce((acc, { id, url }) => ({ ...acc, [id]: url }), {} as Record<string, string>);
                setSignedUrls(urlMap);
              };
              await fetchSignedUrls();
            }

            // FETCH SUBMISSIONS WITH is_viewed
            const { data: submissionsData, error: submissionsError } = await supabase
              .from("submissions")
              .select("*, is_viewed")
              .eq("class_id", normalizedClassId);

            if (submissionsError) {
              setSubmissions([]);
              setOptimisticSubmissions([]);
            } else {
              const submissionsWithNames = await Promise.all(
                (submissionsData || []).map(async (submission) => {
                  const student = students.find((s) => s.student_id === submission.student_id);
                  let studentName = "Unknown Student";
                  if (student) {
                    studentName = `${student.first_name} ${student.last_name}`.trim();
                  } else {
                    const { data: userData } = await supabase
                      .from("users")
                      .select("first_name, last_name")
                      .eq("id", submission.student_id)
                      .single();
                    if (userData) {
                      studentName = `${userData.first_name} ${userData.last_name}`.trim() || "Unknown Student";
                    }
                  }
                  return { ...submission, student_name: studentName } as Submission;
                })
              );
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

  useEffect(() => {
    setOptimisticSubmissions(submissions);
  }, [submissions]);

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
            const { data, error } = await supabase.storage
              .from("activity-images")
              .createSignedUrl(activity.image_url as string, 3600);
            return { id: activity.id, url: error ? "" : data?.signedUrl || "" };
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
      const submissionsWithNames = await Promise.all(
        (submissionsData || []).map(async (submission) => {
          const student = students.find((s) => s.student_id === submission.student_id);
          let studentName = "Unknown Student";
          if (student) {
            studentName = `${student.first_name} ${student.last_name}`.trim();
          } else {
            const { data: userData } = await supabase
              .from("users")
              .select("first_name, last_name")
              .eq("id", submission.student_id)
              .single();
            if (userData) {
              studentName = `${userData.first_name} ${userData.last_name}`.trim() || "Unknown Student";
            }
          }
          return { ...submission, student_name: studentName } as Submission;
        })
      );
      setSubmissions(submissionsWithNames);
      setOptimisticSubmissions(submissionsWithNames);
    }
  };

  useEffect(() => {
    if (isActivityDialogOpen) return;
    handleActivityCreated();
  }, [classId, students, isActivityDialogOpen]);

  // RESTORED: Mark as Viewed
  const markSubmissionViewed = async (submissionId: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ is_viewed: true })
      .eq("id", submissionId);
    return !error;
  };

  const handleSubmissionClick = async (submission: Submission) => {
    if (!submission.is_viewed) {
      const newSubmissions = optimisticSubmissions.map((s) =>
        s.id === submission.id ? { ...s, is_viewed: true } : s
      );
      setOptimisticSubmissions(newSubmissions);
      const success = await markSubmissionViewed(submission.id);
      if (!success) {
        setOptimisticSubmissions(submissions);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="text-xl font-semibold text-teal-300">Loading...</div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-teal-300">
        {error || "Class not found."}
      </div>
    );
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedSubmissions = optimisticSubmissions.filter((sub) => sub.activity_id === selectedActivityId);

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={allClasses} />

      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-teal-300 hover:text-teal-400 text-sm font-medium">
                  Professor Dashboard
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

        <main className="p-6 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* PREMIUM TABS */}
            <div className="flex space-x-1 p-1 bg-gray-800/50 rounded-xl border border-teal-500/20">
              {["overview", "students", "activities"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as never)}
                  className={`flex-1 px-5 py-3 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg"
                      : "text-teal-300 hover:text-teal-200"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <Card className="border-teal-500/20 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-3xl font-bold text-teal-400">{classData.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Button
                    onClick={() => setIsActivityDialogOpen(true)}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg"
                  >
                    Create Activity
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-gray-700/50 border border-teal-500/20">
                      <p className="text-sm text-teal-300">Course</p>
                      <p className="text-xl font-bold text-teal-400">{classData.course}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-700/50 border border-teal-500/20">
                      <p className="text-sm text-teal-300">Section</p>
                      <p className="text-xl font-bold text-teal-400">{classData.section}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal-500/20 border border-teal-400/50">
                      <p className="text-sm text-teal-300">Class Code</p>
                      <p className="text-xl font-bold text-teal-400 font-mono">{classData.code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STUDENTS */}
            {activeTab === "students" && (
              <Card className="border-teal-500/20 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-teal-400">
                    Enrolled Students ({students.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className="text-center py-8 text-teal-300">No students enrolled.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-teal-500/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-gray-800 to-gray-900">
                            <TableHead className="text-teal-300 font-bold">Name</TableHead>
                            <TableHead className="text-teal-300 font-bold">Section</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s) => (
                            <TableRow key={s.student_id} className="hover:bg-gray-700/30">
                              <TableCell className="font-medium text-teal-400">
                                {s.first_name} {s.last_name}
                              </TableCell>
                              <TableCell className="text-teal-300">{s.section}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ACTIVITIES */}
            {activeTab === "activities" && (
              <Card className="border-teal-500/20 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-teal-400">
                    Activities ({activities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <p className="text-center py-8 text-teal-300">No activities created yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

          <CreateActivityDialog
            classId={classId as string}
            isOpen={isActivityDialogOpen}
            onOpenChange={setIsActivityDialogOpen}
            onActivityCreated={handleActivityCreated}
          />

          {/* RESTORED: Submission Dialog with CheckCircle */}
          <Dialog open={!!selectedActivityId} onOpenChange={() => setSelectedActivityId(null)}>
            <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 text-teal-300">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-teal-400">
                  Submissions: {selectedActivity?.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedSubmissions.length === 0 ? (
                  <p className="text-center py-8">No submissions yet.</p>
                ) : (
                  selectedSubmissions.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => handleSubmissionClick(sub)}
                      className="p-4 rounded-xl bg-gray-700/50 border border-teal-500/20 hover:bg-gray-600/50 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-teal-400">{sub.student_name}</p>
                        <p className="text-sm text-teal-300">File: {sub.file_name}</p>
                        <p className="text-xs text-teal-400">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      {sub.is_viewed && (
                        <CheckCircle className="w-5 h-5 text-teal-400" />
                      )}
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