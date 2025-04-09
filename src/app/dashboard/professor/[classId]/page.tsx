// src/app/dashboard/professor/[classId]/page.tsx
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

interface ClassMember {
  student_id: string;
  section: string | null;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }; // Changed to single object instead of array
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

      // Fetch students who joined this class with a join query
      const { data: membersData, error: membersError } = await supabase
        .from("class_members")
        .select(
          `
          student_id,
          section,
          users (
            id,
            first_name,
            last_name
          )
        `
        )
        .eq("class_id", classId);

      if (membersError) {
        console.error("Error fetching class members:", membersError);
        setStudents([]);
      } else if (!membersData || membersData.length === 0) {
        console.log("No students have joined this class.");
        setStudents([]);
      } else {
        console.log("Fetched class members data:", membersData);
        // Log each member's users field to debug
        membersData.forEach((member, index) => {
          console.log(`Member ${index} users:`, member.users);
        });

        // Process the joined data with proper typing
        const studentsData = (membersData as unknown as ClassMember[])
          .filter((member) => {
            const hasUsers = member.users !== null && member.users !== undefined;
            if (!hasUsers) {
              console.log("Filtered out member due to missing users:", member);
            }
            return hasUsers;
          })
          .map((member) => ({
            id: member.users.id,
            first_name: member.users.first_name || "Unknown",
            last_name: member.users.last_name || "",
            section: member.section,
          }));

        console.log("Processed students data:", studentsData);

        // Filter students by section if classData.section is defined
        const filteredStudents = classData.section
          ? studentsData.filter((student) => {
              console.log(
                `Comparing student section: ${student.section} with class section: ${classData.section}`
              );
              if (student.section === null) {
                return classData.section === null;
              }
              return student.section === classData.section;
            })
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