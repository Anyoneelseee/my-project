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
    <Card
      className="shadow-lg rounded-xl border-teal-500/20 hover:shadow-xl transition-shadow duration-300 h-[250px] flex flex-col justify-between overflow-hidden"
      style={{ backgroundColor: "#003559" }}
    >
      <CardHeader className="p-4 rounded-t-xl" style={{ backgroundColor: "#003559" }}>
        <CardTitle className="text-xl md:text-2xl font-bold truncate text-teal-400">
          {classData.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <p className="text-sm md:text-base text-teal-300">
            Section: {classData.section}
          </p>
          <p className="text-sm md:text-base text-teal-300">
            Course: {classData.course}
          </p>
        </div>
        <div className="mt-4">
          <p
            className="text-sm md:text-base font-semibold px-3 py-1 rounded-full inline-block"
            style={{
              color: "#B9D6F2",
              backgroundColor: "#0353A4",
            }}
          >
            Code: {classData.code}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}