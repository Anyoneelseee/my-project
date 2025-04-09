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
  const [activities, setActivities] = useState<Activity[]>([]); // Explicitly type as Activity[]
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      const role = await getUserRole();
      if (!role) return router.push("/login");
      if (role !== "student") return router.push("/dashboard/professor");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: membershipData, error: membershipError } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("student_id", user.id)
        .single();

      if (membershipError || !membershipData) {
        console.error("Error verifying class membership:", membershipError);
        return router.push("/dashboard/student");
      }

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (classError || !classData) {
        console.error("Error fetching class:", classError);
        return router.push("/dashboard/student");
      }

      setClassData(classData);

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("class_id", classId);

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        setActivities([]); // Empty array of Activity[]
      } else {
        setActivities(activitiesData || []); // Type inference should work with Activity[]
      }

      setIsLoading(false);
    };

    initialize();
  }, [classId, router]);

  if (isLoading) return <div>Loading...</div>;
  if (!classData) return <div>Class not found.</div>;

  return (
    <div className="p-4">
      <ClassDetails classData={classData} />
      <ActivitiesList activities={activities} />
      <CodeEditorSection classId={classId as string} /> {/* Cast classId to string */}
    </div>
  );
}