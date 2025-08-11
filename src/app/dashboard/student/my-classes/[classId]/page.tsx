"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import ActivitiesList from "./components/ActivitiesList";
import CodeEditorSection from "./components/CodeEditorSection";
import ClassDetails from "./components/ClassDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
  users: Professor; // Single professor object
}

interface RawClassData {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professor_id: string;
  users: Professor | Professor[]; // Allow single object or array
}

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
  code?: string;
  language?: string;
}

export default function JoinedClassPage() {
  const { classId } = useParams() as { classId: string };
  const router = useRouter();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Wait for auth ready
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

        // Query with explicit join
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

        console.log("Raw Data:", rawData); // Debug log
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

        // Transform to match ClassDetails interface
        const classDataForDetails = {
          id: formattedClassData.id,
          name: formattedClassData.name,
          section: formattedClassData.section,
          course: formattedClassData.course,
          code: formattedClassData.code,
          professorName: professor.first_name + " " + professor.last_name,
          professorEmail: professor.email,
        };

        console.log("Formatted Class Data for Details:", classDataForDetails); // Debug log
        setClassData(formattedClassData); // Keep original state for consistency

        const { data: activitiesData, error: activitiesError } = await supabase
          .rpc("get_student_activities", { class_id: classId });

        if (activitiesError || !activitiesData) {
          console.error("Activities error:", activitiesError?.message);
          setActivities([]);
        } else {
          setActivities(
            (activitiesData as Activity[]).filter(
              (act): act is Activity =>
                act &&
                typeof act.id === "string" &&
                typeof act.description === "string" &&
                (act.image_url === null || typeof act.image_url === "string") &&
                typeof act.created_at === "string"
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

  // Pass transformed data to ClassDetails
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-200">
      <header className="flex items-center justify-between p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-b border-teal-500/20">
        <Button
          onClick={handleBack}
          variant="ghost"
          className="flex items-center gap-2 text-teal-400 hover:bg-teal-500/20 rounded-lg transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </Button>
        <h1 className="text-xl md:text-2xl font-extrabold text-teal-400">
          {classData.name} - {classData.section}
        </h1>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl">
          <ClassDetails classData={classDataForDetails} />
        </section>

        <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl">
          <ActivitiesList activities={activities} onActivitySelect={setSelectedActivityId} />
        </section>

        <section className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl">
          <CodeEditorSection classId={classId} activityId={selectedActivityId} />
        </section>
      </div>
    </div>
  );
}