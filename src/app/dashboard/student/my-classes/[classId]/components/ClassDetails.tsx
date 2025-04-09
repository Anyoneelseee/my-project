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
  );
}