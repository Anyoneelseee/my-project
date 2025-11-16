import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Mail, BookOpen, Hash, UserCircle2, Code } from "lucide-react";
import { motion } from "framer-motion";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professorName?: string;
  professorEmail?: string;
}

export default function ClassDetails({ classData }: { classData: Class }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >

      <div className="flex-1 overflow-y-auto p-6 space-y-6"></div>
      <Card className={`
        relative overflow-hidden rounded-3xl border
        bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-violet-950/95
        backdrop-blur-2xl shadow-2xl
        border-cyan-500/30
        hover:border-cyan-400/60 hover:shadow-3xl hover:shadow-cyan-500/30
        transition-all duration-500 group
        min-h-[380px]
      `}>
        {/* Subtle animated glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/10 via-transparent to-violet-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Floating particles effect */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <CardHeader className="relative z-10 pb-6 pt-8 px-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className={`
                text-3xl sm:text-4xl font-extrabold
                bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400
                bg-clip-text text-transparent
                drop-shadow-2xl
              `}>
                {classData.name}
              </CardTitle>
              <p className="text-sm sm:text-base text-cyan-300/80 mt-2 font-medium">
                {classData.course}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-cyan-500/20 backdrop-blur-md border border-cyan-400/40 shadow-xl">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 px-6 sm:px-8 pb-8">
          <div className="space-y-5">
            {/* Section */}
            <motion.div
              whileHover={{ x: 6 }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300"
            >
              <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40">
                <Hash className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cyan-200/70">Section</p>
                <p className="text-lg font-bold text-cyan-300">{classData.section}</p>
              </div>
            </motion.div>

            {/* Professor */}
            <motion.div
              whileHover={{ x: 6 }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-teal-500/20 hover:border-teal-400/50 transition-all duration-300"
            >
              <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-400/40">
                <UserCircle2 className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-teal-200/70">Professor</p>
                <p className="text-lg font-bold text-teal-300">
                  {classData.professorName || "Not assigned"}
                </p>
              </div>
            </motion.div>

            {/* Email */}
            {classData.professorEmail && (
              <motion.div
                whileHover={{ x: 6 }}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300"
              >
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40">
                  <Mail className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-200/70">Contact</p>
                  <p className="text-base font-medium text-emerald-300 break-all">
                    {classData.professorEmail}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Class Code - Highlighted */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative p-6 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border-2 border-cyan-400/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-transparent" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-cyan-500/30 border border-cyan-300/50 shadow-lg">
                    <Code className="w-7 h-7 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-cyan-200">Class Code</p>
                    <p className="text-2xl sm:text-3xl font-bold font-mono tracking-widest text-cyan-300 mt-1">
                      {classData.code}
                    </p>
                  </div>
                </div>
                <div className="w-2 h-20 bg-gradient-to-b from-cyan-400 to-teal-400 rounded-full opacity-70" />
              </div>
            </motion.div>
          </div>
        </CardContent>

        {/* Bottom Glow Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
      </Card>
    </motion.div>
  );
}