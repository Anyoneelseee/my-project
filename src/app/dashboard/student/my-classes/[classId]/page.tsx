"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import ActivitiesList from "./components/ActivitiesList";
import CodeEditorSection from "./components/CodeEditorSection";
import ClassDetails from "./components/ClassDetails";

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
        // Wait for Supabase to restore session
        await new Promise((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
              resolve(session);
            }
          });
          return () => subscription.unsubscribe();
        });

        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session found:", sessionError?.message);
          router.push("/login");
          return;
        }

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error("Auth error:", authError?.message);
          router.push("/login");
          return;
        }

        // Check user role
        const role = await getUserRole();
        if (!role) {
          router.push("/login");
          return;
        }
        if (role !== "student") {
          router.push("/dashboard/professor");
          return;
        }

        // Verify class membership and get class data
        const { data: membershipData, error: membershipError } = await supabase
          .rpc("get_student_classes")
          .eq("id", classId);

        if (membershipError || !membershipData || membershipData.length === 0) {
          console.error("Error verifying class membership:", membershipError?.message, membershipError?.details, membershipError?.hint);
          router.push("/dashboard/student");
          return;
        }

        // Set class data
        const classData = membershipData[0] as Class;
        setClassData(classData);

        // Fetch activities
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

  if (isLoading) return <div>Loading...</div>;
  if (!classData) return <div>Class not found.</div>;

  return (
    <div className="p-4">
      <ClassDetails classData={classData} />
      <ActivitiesList activities={activities} />
      <CodeEditorSection classId={classId as string} />
    </div>
  );
}