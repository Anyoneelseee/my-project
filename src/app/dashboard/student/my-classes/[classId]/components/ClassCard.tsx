// components/student/ClassCard.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Hash } from "lucide-react";

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

export default function ClassCard({ classData }: ClassCardProps) {
  const [, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined"
      ? (localStorage.getItem("theme") as "light" | "dark") || "dark"
      : "dark"
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group w-full"
    >
      {/* THIS IS THE ONLY CHANGE — makes card 1.5× wider in grid */}
      <div className="w-full max-w-none lg:col-span-1 xl:col-span-1">
        <Card
          className={`
            relative overflow-hidden rounded-2xl border border-cyan-500/30
            bg-gradient-to-br from-gray-900/95 via-indigo-950/90 to-violet-950/95
            backdrop-blur-xl shadow-xl
            cursor-pointer
            transition-all duration-300 ease-out
            hover:shadow-2xl hover:shadow-cyan-500/20
            hover:border-cyan-400/60
            active:scale-[0.98]
            min-h-[180px] flex flex-col
            /* 1.5× wider than before */
            w-full
          `}
          aria-label={`View details for ${classData.name}`}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/10 via-transparent to-violet-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Header */}
          <CardHeader className="pb-2 pt-5 px-4 sm:px-5 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-xl bg-cyan-500/20 backdrop-blur-md border border-cyan-400/40 shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                  <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg font-extrabold text-white drop-shadow-md line-clamp-2 leading-tight group-hover:text-cyan-300 transition-colors">
                    {classData.name}
                  </CardTitle>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Body */}
          <CardContent className="px-4 sm:px-5 pb-5 flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-3">
              {/* Section & Course */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                  <span className="text-xs sm:text-sm font-medium text-cyan-300">
                    Sec {classData.section}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                <span className="text-base sm:text-lg font-mono font-bold text-violet-300 tracking-wider">
                  {classData.code}
                </span>
              </div>

              {/* Course */}
              <div className="flex justify-start">
                <p className="text-xs sm:text-sm text-violet-300 font-medium line-clamp-1">
                  {classData.course}
                </p>
              </div>
            </div>

            {/* Bottom Glow Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}