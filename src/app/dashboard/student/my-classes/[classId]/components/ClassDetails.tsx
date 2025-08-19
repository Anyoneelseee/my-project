import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, Mail, Book, Code } from "lucide-react";

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
    <Card className="mb-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl font-extrabold text-teal-400">
          {classData.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
            <Book className="w-5 h-5 text-teal-300" />
            <p className="text-sm md:text-base text-gray-200">
              <span className="font-semibold text-teal-300">Course:</span> {classData.course}
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
            <Book className="w-5 h-5 text-teal-300" />
            <p className="text-sm md:text-base text-gray-200">
              <span className="font-semibold text-teal-300">Section:</span> {classData.section}
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
            <User className="w-5 h-5 text-teal-300" />
            <p className="text-sm md:text-base text-gray-200">
              <span className="font-semibold text-teal-300">Professor:</span>{" "}
              {classData.professorName || "Not assigned"}
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
            <Mail className="w-5 h-5 text-teal-300" />
            <p className="text-sm md:text-base text-gray-200">
              <span className="font-semibold text-teal-300">Email:</span>{" "}
              {classData.professorEmail || "Not provided"}
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-500/30">
            <Code className="w-5 h-5 text-teal-300" />
            <p className="text-sm md:text-base font-semibold text-teal-300">
              <span className="font-semibold text-teal-300">Class Code:</span> {classData.code}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
