// src/app/dashboard/professor/[classId]/page.tsx
/* eslint-disable @next/next/no-img-element */
"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface Student {
  id: string;
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

      // Fetch class details
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (classError || !classData) {
        console.error("Error fetching class:", classError);
        router.push("/dashboard/professor");
        return;
      }

      console.log("Fetched class data:", classData);
      setClassData(classData);

      // Fetch students who joined this class
      const { data: members, error: membersError } = await supabase
        .from("class_members")
        .select("student_id")
        .eq("class_id", classId);

      if (membersError) {
        console.error("Error fetching class members:", membersError);
        setStudents([]);
      } else if (!members || members.length === 0) {
        console.log("No students have joined this class.");
        setStudents([]);
      } else {
        // Fetch user details for each student
        const studentIds = members.map((member) => member.student_id);
        console.log("Student IDs to fetch:", studentIds);

        if (studentIds.length === 0) {
          console.log("No student IDs to fetch.");
          setStudents([]);
        } else {
          const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, first_name, last_name, section")
            .in("id", studentIds);

          if (usersError) {
            console.error("Error fetching student details:", usersError);
            setStudents([]);
          } else if (!users || users.length === 0) {
            console.log("No students found for the given IDs (possibly due to RLS).");
            setStudents([]);
          } else {
            console.log("Fetched student data:", users);
            // Filter students by section in code
            const filteredStudents = classData.section
              ? users.filter((user) => user.section === classData.section)
              : users;

            const studentsData = filteredStudents.map((user) => ({
              id: user.id,
              first_name: user.first_name || "Unknown",
              last_name: user.last_name || "",
              section: user.section,
            }));
            console.log("Filtered students:", studentsData);
            setStudents(studentsData);
          }
        }
      }

      // Fetch activities for this class
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("class_id", classId);

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        setActivities([]);
      } else {
        console.log("Fetched activities:", activitiesData);
        setActivities(activitiesData || []);
      }

      setIsLoading(false);
    };

    initialize();
  }, [classId, router]);

  const handleActivityCreated = () => {
    console.log("Activity created, refreshing activities...");
    // Refresh activities after creating a new one
    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("class_id", classId);

      if (error) {
        console.error("Error fetching activities:", error);
      } else {
        setActivities(data || []);
      }
    };

    fetchActivities();
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

      {/* Create Activity Button */}
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

      {/* List of Students */}
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
              <li key={student.id}>
                {student.first_name} {student.last_name} (Section: {student.section || "N/A"})
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* List of Activities */}
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
                      className="mt-2 max-w-xs"
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