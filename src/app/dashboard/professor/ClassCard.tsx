"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface ClassCardProps {
  classData: Class;
}

export function ClassCard({ classData }: ClassCardProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "dark" : "dark"
  );

  // Sync theme with localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  // Navigate to class details page
  const handleCardClick = () => {
    router.push(`/dashboard/class/${classData.id}`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        className={`${
          theme === "light" ? "bg-white" : "bg-slate-800/90"
        } shadow-lg border border-teal-500/20 rounded-2xl min-h-[200px] flex flex-col justify-between overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 font-['Poppins']`}
        onClick={handleCardClick}
        aria-label={`View details for ${classData.name}`}
      >
        <CardHeader className="p-4 bg-gradient-to-r from-teal-500/10 to-transparent">
          <CardTitle className={`${
            theme === "light" ? "text-slate-900" : "text-teal-400"
          } text-lg md:text-xl font-bold truncate flex items-center gap-2`}>
            <BookOpen className="w-5 h-5" />
            {classData.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <p className={`${
              theme === "light" ? "text-slate-700" : "text-teal-300"
            } text-sm md:text-base`}>
              Section: {classData.section}
            </p>
            <p className={`${
              theme === "light" ? "text-slate-700" : "text-teal-300"
            } text-sm md:text-base`}>
              Course: {classData.course}
            </p>
          </div>
          <div className="mt-4">
            <div
              className={`${
                theme === "light" ? "bg-teal-100 text-teal-700" : "bg-teal-500/20 text-teal-300"
              } text-sm font-semibold px-3 py-1 rounded-full inline-block`}
              aria-label={`Class code: ${classData.code}`}
            >
              Code: {classData.code}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
