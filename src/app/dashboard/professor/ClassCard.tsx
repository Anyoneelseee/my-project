// src/app/dashboard/professor/ClassCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <Card className="p-4">
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