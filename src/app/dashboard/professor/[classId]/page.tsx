"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

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
  section: string | null;
}

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
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
        if (role !== "professor") {
          router.push("/dashboard/student");
          return;
        }

        // Fetch class using RPC
        const { data: classDataArray, error: classError } = await supabase
          .rpc("get_professor_classes")
          .eq("id", classId);

        if (classError || !classDataArray || classDataArray.length === 0) {
          console.error("Error fetching class:", classError?.message, classError?.details, classError?.hint);
          router.push("/dashboard/professor");
          return;
        }

        const classData = classDataArray[0] as Class;
        setClassData(classData);

        // Fetch students using function
        const { data: studentsData, error: studentsError } = await supabase
          .rpc("get_class_student_profiles", { class_id_input: classId });

        if (studentsError) {
          console.error("Error fetching students:", studentsError.message, studentsError.details, studentsError.hint);
          setStudents([]);
        } else if (!studentsData || studentsData.length === 0) {
          console.log("No students have joined this class.");
          setStudents([]);
        } else {
          console.log("Fetched students data:", studentsData);

          const filteredStudents = classData.section
            ? studentsData.filter((student: Student) => student.section === classData.section)
            : studentsData;

          console.log("Filtered students:", filteredStudents);
          setStudents(filteredStudents);
        }

        // Fetch activities for this class
        const { data: activitiesData, error: activitiesError } = await supabase
          .from("activities")
          .select("*")
          .eq("class_id", classId);

        if (activitiesError) {
          console.error("Error fetching activities:", activitiesError.message, activitiesError.details, activitiesError.hint);
          setActivities([]);
        } else {
          console.log("Fetched activities:", activitiesData);
          setActivities(activitiesData || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        router.push("/dashboard/professor");
      } finally {
        setIsLoading(false);
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
      console.error("Error fetching updated activities:", error.message, error.details, error.hint);
      setActivities([]);
    } else {
      setActivities(data || []);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!classData) {
    return <div>Class not found.</div>;
  }

  return (
    <div className="p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{classData.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Section: {classData.section} | Course: {classData.course}
          </p>
          <p className="text-sm font-bold">Class Code: {classData.code}</p>
        </CardContent>
      </Card>

      <div className="mb-4">
        <Button
          onClick={() => setIsActivityDialogOpen(true)}
          className="flex items-center gap-2"
        >
          Create Activity
        </Button>
        <CreateActivityDialog
          classId={classId as string}
          isOpen={isActivityDialogOpen}
          onOpenChange={setIsActivityDialogOpen}
          onActivityCreated={handleActivityCreated}
        />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">
          Students Joined (Section: {classData.section || "N/A"}):
        </h3>
        {students.length === 0 ? (
          <p className="text-gray-500">
            No students from this section have joined this class yet.
          </p>
        ) : (
          <ul className="list-disc pl-5">
            {students.map((student) => (
              <li key={student.student_id}>
                {student.first_name} {student.last_name} (Section: {student.section || "N/A"})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Activities:</h3>
        {activities.length === 0 ? (
          <p className="text-gray-500">No activities created yet.</p>
        ) : (
          <ul className="list-disc pl-5">
            {activities.map((activity) => (
              <li key={activity.id}>
                {activity.description}
                {activity.image_url && (
                  <div>
                    <Image
                      src={activity.image_url}
                      alt="Activity"
                      width={300}
                      height={200}
                      className="mt-2 rounded-md"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Created at: {new Date(activity.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}