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

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function JoinedClassPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          console.error("No session found:", sessionError?.message);
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

        const { data: membershipData, error: membershipError } = await supabase
          .rpc("get_student_classes")
          .eq("id", classId);

        if (membershipError || !membershipData || membershipData.length === 0) {
          console.error("Error verifying class membership:", membershipError?.message, membershipError?.details, membershipError?.hint);
          router.push("/dashboard/student");
          return;
        }

        const classData = membershipData[0] as Class;
        setClassData(classData);

        const { data: activitiesData, error: activitiesError } = await supabase
          .rpc("get_student_activities", { class_id: classId });

        if (activitiesError) {
          console.error("Error fetching activities:", activitiesError.message, activitiesError.details, activitiesError.hint);
          setActivities([]);
        } else {
          const validatedActivities = (activitiesData as Activity[]).filter(
            (act): act is Activity =>
              act &&
              typeof act.id === "string" &&
              typeof act.description === "string" &&
              (act.image_url === null || typeof act.image_url === "string") &&
              typeof act.created_at === "string"
          );
          setActivities(validatedActivities);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">Class not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <header className="flex items-center justify-between p-6 bg-white shadow-sm border-b">
        <Button
          onClick={handleBack}
          variant="ghost"
          className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          {classData.name} - {classData.section}
        </h1>
      </header>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Class Details Section */}
        <section className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
          <ClassDetails classData={classData} />
        </section>

        {/* Activities List Section */}
        <section className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Class Activities</h2>
          <ActivitiesList activities={activities} />
        </section>

        {/* Code Editor Section */}
        <section className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Code Editor</h2>
          <CodeEditorSection classId={classId as string} />
        </section>
      </div>
    </div>
  );
}