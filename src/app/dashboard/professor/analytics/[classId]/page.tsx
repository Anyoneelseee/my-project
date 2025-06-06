"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Label, Pie, PieChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button"; // Import Button for return functionality

// Pie chart data for student enrollment (dummy data)
const enrollmentChartData = [
  { category: "enrolled", students: 25, fill: "var(--color-enrolled)" },
  { category: "not_enrolled", students: 10, fill: "var(--color-not_enrolled)" },
];

// Pie chart configuration
const enrollmentChartConfig = {
  students: {
    label: "Students",
  },
  enrolled: {
    label: "Enrolled Students",
    color: "#4CAF50", // Green
  },
  not_enrolled: {
    label: "Not Enrolled",
    color: "#F44336", // Red
  },
} satisfies ChartConfig;

// Dummy trend data for students with AI-generated content > 60% (last 6 months)
const trendChartData = [
  { month: "Dec 2024", students: 2 },
  { month: "Jan 2025", students: 3 },
  { month: "Feb 2025", students: 5 },
  { month: "Mar 2025", students: 4 },
  { month: "Apr 2025", students: 6 },
  { month: "May 2025", students: 7 },
];

// Trend chart configuration
const trendChartConfig = {
  students: {
    label: "Students with AI > 60%",
    color: "#2196F3", // Blue
  },
} satisfies ChartConfig;

// Dummy data for similarity chart (number of students in each similarity range)
const similarityChartData = [
  { range: "50-60%", students: 5 },
  { range: "60-70%", students: 3 },
  { range: "70-80%", students: 2 },
  { range: "80-90%", students: 1 },
  { range: "90-100%", students: 1 },
];

// Similarity chart configuration
const similarityChartConfig = {
  students: {
    label: "Students",
    color: "#FF9800", // Orange
  },
} satisfies ChartConfig;

export default function AnalyticsPage() {
  useParams();
  const [] = React.useState<boolean>(false); // No loading since we're using dummy data

  const totalStudents = React.useMemo(() => {
    return enrollmentChartData.reduce((acc, curr) => acc + curr.students, 0);
  }, []);

  const totalStudentsWithSimilarity = React.useMemo(() => {
    return similarityChartData.reduce((acc, curr) => acc + curr.students, 0);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Return Button */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          onClick={() => window.history.back()} // Navigate back to the previous page
          className="text-teal-600 hover:text-teal-700 hover:bg-teal-100 transition-colors"
        >
          ← Return
        </Button>
      </div>

      {/* Enrollment Pie Chart */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Student Enrollment - Pie Chart</CardTitle>
          <CardDescription>
            Enrollment Statistics as of May 29, 2025
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={enrollmentChartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={enrollmentChartData}
                dataKey="students"
                nameKey="category"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalStudents.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Students
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            Total students enrolled in this class <TrendingUp className="h-4 w-4" />
          </div>
          <div className="leading-none text-muted-foreground">
            Showing total enrollment as of May 29, 2025
          </div>
        </CardFooter>
      </Card>

      {/* Trend Chart for Students with AI-Generated Content > 60% */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Trend of Students with AI-Generated Content {">"} 60%</CardTitle>
          <CardDescription>
            Monthly Trend from December 2024 to May 2025
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={trendChartConfig}
            className="mx-auto aspect-[4/3] max-h-[300px]"
          >
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="students"
                stroke={trendChartConfig.students.color}
                strokeWidth={2}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            Increasing trend in AI-detected submissions <TrendingUp className="h-4 w-4" />
          </div>
          <div className="leading-none text-muted-foreground">
            Showing students with AI-generated content above 60%
          </div>
        </CardFooter>
      </Card>

      {/* Bar Chart for Students with Detected Similarity */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Students with Detected Code Similarity</CardTitle>
          <CardDescription>
            Distribution of Students by Similarity Range (Above 50%)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={similarityChartConfig}
            className="mx-auto aspect-[4/3] max-h-[300px]"
          >
            <BarChart data={similarityChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="students"
                fill={similarityChartConfig.students.color}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            {totalStudentsWithSimilarity} students with similarity above 50% <TrendingUp className="h-4 w-4" />
          </div>
          <div className="leading-none text-muted-foreground">
            Showing distribution of students by similarity percentage range
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}