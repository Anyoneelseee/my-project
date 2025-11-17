"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import ActivitiesList from "./components/ActivitiesList";
import CodeEditorSection from "./components/CodeEditorSection";
import ClassDetails from "./components/ClassDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, List, Code } from "lucide-react";
import { PostgrestError } from "@supabase/supabase-js";
import { Activity } from "./components/ActivitiesList";

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

export default function JoinedClassPage() {
  const { classId } = useParams() as { classId: string };
  const router = useRouter();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"details" | "activities" | "code">("details");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

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

        setClassData(formattedClassData);

        const { data: activitiesData, error: activitiesError } = await supabase
          .rpc("get_student_activities", { class_id: classId }) as { data: Activity[] | null; error: PostgrestError | null };

        if (activitiesError || !activitiesData) {
          console.error("Activities error:", activitiesError?.message);
          setActivities([]);
        } else {
          setActivities(
            activitiesData.filter(
              (act): act is Activity =>
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

  const handleStartActivity = (activityId: string) => {
    setSelectedActivityId(activityId);
    setActiveSection("code");
  };

  const handleSubmitSuccess = () => {
    setActivities((prev) => [...prev]);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950/80 to-violet-950/90 text-white backdrop-blur-xl"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
        />
        <span className="ml-3 text-lg font-medium text-cyan-300">Loading...</span>
      </motion.div>
    );
  }

  if (!classData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950/80 to-violet-950/90 text-white backdrop-blur-xl"
      >
        <div className="text-xl font-extrabold text-violet-400 drop-shadow-lg">Class not found.</div>
      </motion.div>
    );
  }

  const classDataForDetails = {
    id: classData.id,
    name: classData.name,
    section: classData.section,
    course: classData.course,
    code: classData.code,
    professorName: `${classData.users.first_name} ${classData.users.last_name}`,
    professorEmail: classData.users.email,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900/95 via-indigo-950/80 to-violet-950/90 text-gray-100 flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <motion.aside
        initial={{ x: -64 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="hidden md:block w-64 bg-white/5 via-gray-900/80 to-black/20 border-r border-cyan-500/20 backdrop-blur-3xl shadow-2xl shadow-cyan-500/10"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 border-b border-cyan-500/10"
        >
          <h2 className="text-xl font-extrabold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent truncate leading-tight">
            {classData.name}
          </h2>
        </motion.div>
        <nav className="p-6 space-y-2">
          {[
            { id: "details", icon: Info, label: "Class Details", section: "details" as const },
            { id: "activities", icon: List, label: "Activities", section: "activities" as const },
            { id: "code", icon: Code, label: "Code Editor", section: "code" as const },
          ].map(({ id, icon: Icon, label, section }) => (
            <motion.div key={id} whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
              <Button
                variant={activeSection === section ? "default" : "ghost"}
                className={`
                  w-full justify-start rounded-2xl backdrop-blur-md border border-cyan-500/20
                  text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all duration-300
                  ${activeSection === section ? "bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-200 shadow-lg shadow-cyan-500/20" : ""}
                  font-medium tracking-wide
                `}
                onClick={() => setActiveSection(section)}
                disabled={section === "code" && !selectedActivityId}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {label}
              </Button>
            </motion.div>
          ))}
        </nav>
      </motion.aside>

      {/* Mobile Nav */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900/95 via-indigo-950/90 to-violet-950/95 border-b border-cyan-500/20 backdrop-blur-xl shadow-2xl shadow-cyan-500/10"
      >
        <div className="p-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "details", icon: Info, label: "Details", section: "details" as const },
            { id: "activities", icon: List, label: "Activities", section: "activities" as const },
            { id: "code", icon: Code, label: "Code", section: "code" as const },
          ].map(({ id, icon: Icon, label, section }) => (
            <motion.div key={id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant={activeSection === section ? "default" : "ghost"}
                className={`
                  flex-shrink-0 rounded-full px-4 py-2 min-w-max
                  backdrop-blur-md border border-cyan-500/20
                  text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all duration-300
                  ${activeSection === section ? "bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-200 shadow-lg shadow-cyan-500/20" : ""}
                  font-medium tracking-wide
                `}
                onClick={() => setActiveSection(section)}
                disabled={section === "code" && !selectedActivityId}
              >
                <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                {label}
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.nav>

      <div className="flex-1 flex flex-col md:ml-0 pt-safe md:pt-0">
        <header className="sticky top-0 z-40 p-4 md:p-6 bg-gradient-to-r from-gray-900/95 via-indigo-950/90 to-violet-950/90 border-b border-cyan-500/20 backdrop-blur-xl shadow-xl shadow-cyan-500/10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleBack}
                variant="ghost"
                className="flex items-center gap-2 rounded-xl backdrop-blur-md border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all duration-300 shadow-md shadow-cyan-500/10"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Button>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg leading-tight truncate"
            >
              {classData.name} - {classData.section}
            </motion.h1>
            <div className="w-12" /> {/* Spacer for alignment */}
          </motion.div>
        </header>

      <main className="flex-1 overflow-hidden"> {/* ← REMOVE padding + overflow-auto */}
  <AnimatePresence mode="wait">
   {activeSection === "details" && (
  <motion.section
    key="details"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="h-full p-4 md:p-6"
  >
    {/* FULL-HEIGHT CARD */}
    <div className="h-full bg-white/5 via-gray-900/80 to-black/20 border border-cyan-500/20 rounded-3xl backdrop-blur-3xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col">
      <ClassDetails classData={classDataForDetails} />
    </div>
  </motion.section>
)}

    {activeSection === "activities" && (
      <motion.section
        key="activities"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-4 md:p-6"
      >
        <div className="h-full bg-white/5 via-gray-900/80 to-black/20 border border-cyan-500/20 rounded-3xl backdrop-blur-3xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
          <ActivitiesList
            activities={activities}
            classId={classId}
            selectedActivityId={selectedActivityId}
            onStartActivity={handleStartActivity}
            isLoading={isLoading}
          />
        </div>
      </motion.section>
    )}

    {/* CODE EDITOR: FULL SCREEN, NO PADDING, NO SCROLL */}
    {activeSection === "code" && selectedActivityId && (
      <motion.div
        key="code"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-screen w-screen fixed inset-0 z-50"
      >
        <CodeEditorSection
          classId={classId}
          activityId={selectedActivityId}
          section={classData.section}
          onSubmitSuccess={handleSubmitSuccess}
        />
      </motion.div>
    )}

    {activeSection === "code" && !selectedActivityId && (
      <motion.div
        key="code-empty"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center h-full p-4 md:p-6"
      >
        <div className="text-center p-8 bg-white/5 border border-cyan-500/10 rounded-3xl backdrop-blur-xl">
          <p className="text-lg font-medium text-cyan-300/70">
            Select an activity first to open the code editor.
          </p>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</main>
      </div>
    </div>
  );
}