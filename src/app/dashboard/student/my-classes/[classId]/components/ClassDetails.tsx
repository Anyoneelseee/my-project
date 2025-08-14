import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <Card className="mb-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl font-extrabold text-teal-400">
          {classData.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <p className="text-sm md:text-base text-gray-200">
            Section: {classData.section}
          </p>
            <p className="text-sm md:text-base text-gray-200">
             Course: {classData.course}
          </p>
            <p className="text-sm md:text-base text-gray-200">
            
            Professor: {classData.professorName || 'Not assigned'}
            </p>
          <p className="text-sm md:text-base text-gray-200">
            Email: {classData.professorEmail || 'Not provided'}          </p>
               <p className="text-sm md:text-base font-semibold text-teal-300 bg-teal-500/30 px-3 py-1 rounded-full inline-block">
            Class Code: {classData.code}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}