"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import ActivitiesList from "./components/ActivitiesList";
import CodeEditorSection from "./components/CodeEditorSection";
import ClassDetails from "./components/ClassDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, List, Code } from "lucide-react";
import { PostgrestError } from "@supabase/supabase-js";

interface Professor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ClassData {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professor_id: string;
  users: Professor;
}

interface RawClassData {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professor_id: string;
  users: Professor | Professor[];
}

interface Activity {
  id: string;
  description: string;
  title: string | null;
  image_url: string | null;
  created_at: string | null;
  start_time: string | null;
  deadline: string | null;
}

export default function JoinedClassPage() {
  const { classId } = useParams() as { classId: string };
  const router = useRouter();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"details" | "activities" | "code">("details");

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
          console.error("Session error:", sessionError?.message);
          router.push("/login");
          return;
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error("Auth error:", authError?.message);
          router.push("/login");
          return;
        }

        const role = await getUserRole();
        if (!role) {
          router.push("/login");
          return;
        }
        if (role !== "student") {
          router.push("/dashboard/professor");
          return;
        }

        const { data: rawData, error: membershipError } = await supabase
          .from("classes")
          .select(`
            id,
            name,
            section,
            course,
            code,
            professor_id,
            users:professor_id (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq("id", classId)
          .single<RawClassData>();

        if (membershipError) {
          console.error("Membership error:", membershipError.message, membershipError.details);
          router.push("/dashboard/student");
          return;
        }
        if (!rawData) {
          console.error("No class data found for classId:", classId);
          router.push("/dashboard/student");
          return;
        }

        console.log("Raw Data:", rawData);
        let professor: Professor;
        if (Array.isArray(rawData.users)) {
          professor = rawData.users.find((u) => u.id === rawData.professor_id) || {
            id: "",
            first_name: "Not assigned",
            last_name: "",
            email: "Not provided",
          };
        } else if (rawData.users && typeof rawData.users === "object") {
          professor = rawData.users;
        } else {
          professor = {
            id: "",
            first_name: "Not assigned",
            last_name: "",
            email: "Not provided",
          };
        }

        const formattedClassData: ClassData = {
          id: rawData.id,
          name: rawData.name,
          section: rawData.section,
          course: rawData.course,
          code: rawData.code,
          professor_id: rawData.professor_id,
          users: professor,
        };

        const classDataForDetails = {
          id: formattedClassData.id,
          name: formattedClassData.name,
          section: formattedClassData.section,
          course: formattedClassData.course,
          code: formattedClassData.code,
          professorName: professor.first_name + " " + professor.last_name,
          professorEmail: professor.email,
        };

        console.log("Formatted Class Data for Details:", classDataForDetails);
        setClassData(formattedClassData);

        const { data: activitiesData, error: activitiesError } = await supabase
          .rpc("get_student_activities", { class_id: classId }) as { data: Activity[] | null; error: PostgrestError | null };

        if (activitiesError || !activitiesData) {
          console.error("Activities error:", activitiesError?.message);
          setActivities([]);
        } else {
          console.log("Fetched activities:", activitiesData);
          setActivities(
            activitiesData.filter(
              (act: Activity): act is Activity =>
                act &&
                typeof act.id === "string" &&
                typeof act.description === "string" &&
                (act.image_url === null || typeof act.image_url === "string") &&
                (act.created_at === null || typeof act.created_at === "string") &&
                (act.title === null || typeof act.title === "string") &&
                (act.start_time === null || typeof act.start_time === "string") &&
                (act.deadline === null || typeof act.deadline === "string")
            )
          );
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        router.push("/dashboard/student");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [classId, router]);

  const handleBack = () => {
    router.push("/dashboard/student");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white">
        <div className="text-xl font-semibold text-gray-200">Loading...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white">
        <div className="text-xl font-semibold text-gray-200">Class not found.</div>
      </div>
    );
  }

  const classDataForDetails = {
    id: classData.id,
    name: classData.name,
    section: classData.section,
    course: classData.course,
    code: classData.code,
    professorName: classData.users.first_name + " " + classData.users.last_name,
    professorEmail: classData.users.email,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200 flex">
      <aside className="hidden md:block w-64 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-r border-teal-500/30 backdrop-blur-md">
        <div className="p-4 border-b border-teal-500/20">
          <h2 className="text-lg font-extrabold text-teal-400 truncate">{classData.name}</h2>
        </div>
        <nav className="p-4 space-y-2">
          <Button
            variant={activeSection === "details" ? "default" : "ghost"}
            className={`w-full justify-start text-teal-300 hover:bg-teal-500/20 ${
              activeSection === "details" ? "bg-teal-500/30 text-teal-200" : ""
            }`}
            onClick={() => setActiveSection("details")}
            aria-label="View class details"
          >
            <Info className="w-4 h-4 mr-2" />
            Class Details
          </Button>
          <Button
            variant={activeSection === "activities" ? "default" : "ghost"}
            className={`w-full justify-start text-teal-300 hover:bg-teal-500/20 ${
              activeSection === "activities" ? "bg-teal-500/30 text-teal-200" : ""
            }`}
            onClick={() => setActiveSection("activities")}
            aria-label="View activities"
          >
            <List className="w-4 h-4 mr-2" />
            Activities
          </Button>
          <Button
            variant={activeSection === "code" ? "default" : "ghost"}
            className={`w-full justify-start text-teal-300 hover:bg-teal-500/20 ${
              activeSection === "code" ? "bg-teal-500/30 text-teal-200" : ""
            }`}
            onClick={() => setActiveSection("code")}
            aria-label="Open code editor"
          >
            <Code className="w-4 h-4 mr-2" />
            Code Editor
          </Button>
        </nav>
      </aside>

      <nav className="md:hidden bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-b border-teal-500/20 p-4 flex gap-2">
        <Button
          variant={activeSection === "details" ? "default" : "ghost"}
          className={`text-teal-300 hover:bg-teal-500/20 ${
            activeSection === "details" ? "bg-teal-500/30 text-teal-200" : ""
          }`}
          onClick={() => setActiveSection("details")}
          aria-label="View class details"
        >
          <Info className="w-4 h-4 mr-2" />
          Details
        </Button>
        <Button
          variant={activeSection === "activities" ? "default" : "ghost"}
          className={`text-teal-300 hover:bg-teal-500/20 ${
            activeSection === "activities" ? "bg-teal-500/30 text-teal-200" : ""
          }`}
          onClick={() => setActiveSection("activities")}
          aria-label="View activities"
        >
          <List className="w-4 h-4 mr-2" />
          Activities
        </Button>
        <Button
          variant={activeSection === "code" ? "default" : "ghost"}
          className={`text-teal-300 hover:bg-teal-500/20 ${
            activeSection === "code" ? "bg-teal-500/30 text-teal-200" : ""
          }`}
          onClick={() => setActiveSection("code")}
          aria-label="Open code editor"
        >
          <Code className="w-4 h-4 mr-2" />
          Code Editor
        </Button>
      </nav>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 md:p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-b border-teal-500/20">
          <Button
            onClick={handleBack}
            variant="ghost"
            className="flex items-center gap-2 text-teal-400 hover:bg-teal-500/20 rounded-lg transition-all duration-200"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl md:text-2xl font-extrabold text-teal-400">
            {classData.name} - {classData.section}
          </h1>
        </header>

        <main className="p-4 md:p-6 w-full flex-1">
          {activeSection === "details" && (
            <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl animate-in fade-in duration-300 w-full">
              <ClassDetails classData={classDataForDetails} />
            </section>
          )}
          {activeSection === "activities" && (
            <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl animate-in fade-in duration-300 w-full">
              <ActivitiesList
                activities={activities}
                classId={classId}
              />
            </section>
          )}
          {activeSection === "code" && (
            <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl animate-in fade-in duration-300 w-full">
              <CodeEditorSection classId={classId} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
