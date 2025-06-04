import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

export default function ClassDetails({ classData }: { classData: Class }) {
  return (
    <Card className="mb-6 shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-t-xl">
        <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">
          {classData.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="space-y-2">
          <p className="text-sm md:text-base text-gray-600">
            Section: {classData.section} | Course: {classData.course}
          </p>
          <p className="text-sm md:text-base font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full inline-block">
            Class Code: {classData.code}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}