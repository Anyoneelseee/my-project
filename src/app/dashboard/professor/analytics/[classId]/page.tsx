"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { format, subMonths, parseISO } from "date-fns";
import { TrendingUp, Download, ArrowLeft, AlertTriangle, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
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
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Interfaces for data
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
  professor_id: string;
  created_at: string;
}

interface Submission {
  id: string;
  class_id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  language: string;
  submitted_at: string;
  ai_percentage: number;
  activity_id: string;
  similarity_percentage: number;
  status: string;
}

interface ClassMembership {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

interface StudentCount {
  class_id: string;
  class_name: string;
  section: string;
  student_count: number;
}

interface ActivityLog {
  id: string;
  class_id: string;
  student_id: string;
  action: string;
  timestamp: string;
  created_at: string;
  activity_id: string | null;
}

// Mock user data (replace with real `users` table fetch)
const mockUsers: { [key: string]: { first_name: string; last_name: string } } = {
  "f4e42be7-7a4c-4a53-a351-c3199abbd679": { first_name: "John", last_name: "Doe" },
  "a5bc1904-5ca5-4782-8d3e-8cd485431f36": { first_name: "Jane", last_name: "Smith" },
  "4077b193-d7ee-4edc-964f-d62b0180442e": { first_name: "Alice", last_name: "Johnson" },
  "a2b8ebe9-83e5-4fed-958f-1d077e11eeba": { first_name: "Bob", last_name: "Brown" },
  "79b48882-7b34-49be-b6c7-dd5f8a2fd174": { first_name: "Carol", last_name: "White" },
};

// Chart configurations
const enrollmentChartConfig: ChartConfig = {
  students: { label: "Students", color: "#34C759" },
};

const submissionTrendChartConfig: ChartConfig = {
  submissions: { label: "Submissions", color: "#3B82F6" },
};

const aiUsageChartConfig: ChartConfig = {
  submissions: { label: "Submissions", color: "#F59E0B" },
};

const statusChartConfig: ChartConfig = {
  pending: { label: "Pending", color: "#EF4444" },
  graded: { label: "Graded", color: "#34C759" },
};

const engagementChartConfig: ChartConfig = {
  startedTyping: { label: "Started Typing", color: "#F97316" },
  ranCode: { label: "Ran Code", color: "#06B6D4" },
  submittedActivity: { label: "Submitted Activity", color: "#10B981" },
};

// Error Boundary Component
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!children) throw new Error("Invalid chart content");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  }, [children]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px] text-red-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        <span>Error: {error}</span>
      </div>
    );
  }
  return <>{children}</>;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const [classes, setClasses] = useState<Class[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [memberships, setMemberships] = useState<ClassMembership[]>([]);
  const [studentCounts, setStudentCounts] = useState<StudentCount[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("6m");
  const [isLoading, setIsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState({
    enrollment: true,
    submissions: true,
    aiUsage: true,
    status: true,
    engagement: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Set initial selectedClass based on classId from URL
  useEffect(() => {
    if (classId && classId !== "all") {
      setSelectedClass(classId);
    }
  }, [classId]);

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Fetch data from Supabase
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const role = await getUserRole();
        if (role !== "professor") {
          setError("Access denied. Professor role required.");
          router.push("/dashboard/student");
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          setError("Authentication failed. Please log in.");
          router.push("/login");
          return;
        }

        // Fetch classes
        const { data: classesData, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .eq("professor_id", session.user.id);
        if (classesError) throw new Error(`Failed to fetch classes: ${classesError.message}`);
        setClasses(classesData || []);
        setChartLoading((prev) => ({ ...prev, enrollment: false }));

        // Fetch submissions
        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select("*");
        if (submissionsError) throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
        setSubmissions(submissionsData || []);
        setChartLoading((prev) => ({ ...prev, submissions: false, aiUsage: false, status: false }));

        // Fetch student counts via RPC
        const { data: studentCountsData, error: studentCountsError } = await supabase
          .rpc("get_class_student_counts", { professor_id_input: session.user.id });
        if (studentCountsError) throw new Error(`Failed to fetch student counts: ${studentCountsError.message}`);
        setStudentCounts(studentCountsData || []);
        setChartLoading((prev) => ({ ...prev, enrollment: false }));

        // Fetch class memberships
        const { data: membershipsData, error: membershipsError } = await supabase
          .from("class_members")
          .select("id, class_id, student_id, joined_at");
        if (membershipsError) throw new Error(`Failed to fetch memberships: ${membershipsError.message}`);
        setMemberships(membershipsData || []);

        // Fetch activity logs
        const { data: activityLogsData, error: activityLogsError } = await supabase
          .from("activity_logs")
          .select("*");
        if (activityLogsError) throw new Error(`Failed to fetch activity logs: ${activityLogsError.message}`);
        setActivityLogs(activityLogsData || []);
        setChartLoading((prev) => ({ ...prev, engagement: false }));
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        router.push("/dashboard/professor");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [router]);

  // Filter data based on selections
  const filteredSubmissions = useMemo(() => {
    const startDate = dateRange === "all" ? new Date(0) : subMonths(new Date(), parseInt(dateRange));
    return submissions.filter((sub) => {
      if (!sub.class_id || !sub.student_id || !sub.submitted_at) return false;
      const subDate = parseISO(sub.submitted_at);
      const classMatch = selectedClass === "all" || sub.class_id === selectedClass;
      const studentMatch = selectedStudent === "all" || sub.student_id === selectedStudent;
      return classMatch && studentMatch && subDate >= startDate;
    });
  }, [submissions, selectedClass, selectedStudent, dateRange]);

  const filteredActivityLogs = useMemo(() => {
    const startDate = dateRange === "all" ? new Date(0) : subMonths(new Date(), parseInt(dateRange));
    return activityLogs.filter((log) => {
      if (!log.class_id || !log.student_id || !log.timestamp) return false;
      const logDate = parseISO(log.timestamp);
      const classMatch = selectedClass === "all" || log.class_id === selectedClass;
      const studentMatch = selectedStudent === "all" || log.student_id === selectedStudent;
      return classMatch && studentMatch && logDate >= startDate;
    });
  }, [activityLogs, selectedClass, selectedStudent, dateRange]);

  // Enrollment data
  const enrollmentData = useMemo(() => {
    return studentCounts.map((cls) => ({
      name: `${cls.class_name} (${cls.section})`,
      students: cls.student_count,
      fill: enrollmentChartConfig.students.color,
    }));
  }, [studentCounts]);

  // Submission trend data
  const submissionTrendData = useMemo(() => {
    const months = Array.from({ length: parseInt(dateRange) || 12 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return { month: format(date, "MMM yyyy"), submissions: 0 };
    }).reverse();
    filteredSubmissions.forEach((sub) => {
      const month = format(parseISO(sub.submitted_at), "MMM yyyy");
      const index = months.findIndex((m) => m.month === month);
      if (index !== -1) months[index].submissions += 1;
    });
    return months;
  }, [filteredSubmissions, dateRange]);

  // AI usage histogram
  const aiUsageData = useMemo(() => {
    const bins = [
      { range: "0-20%", submissions: 0 },
      { range: "20-40%", submissions: 0 },
      { range: "40-60%", submissions: 0 },
      { range: "60-80%", submissions: 0 },
      { range: "80-100%", submissions: 0 },
    ];
    filteredSubmissions.forEach((sub) => {
      const ai = sub.ai_percentage;
      if (ai < 20) bins[0].submissions += 1;
      else if (ai < 40) bins[1].submissions += 1;
      else if (ai < 60) bins[2].submissions += 1;
      else if (ai < 80) bins[3].submissions += 1;
      else bins[4].submissions += 1;
    });
    return bins;
  }, [filteredSubmissions]);

  // Submission status data
  const statusData = useMemo(() => {
    const statusCounts = filteredSubmissions.reduce(
      (acc: { [key: string]: number }, sub: Submission) => {
        acc[sub.status] = (acc[sub.status] || 0) + 1;
        return acc;
      },
      { pending: 0, graded: 0 }
    );
    return [
      { status: "Pending", count: statusCounts.pending, fill: statusChartConfig.pending.color },
      { status: "Graded", count: statusCounts.graded, fill: statusChartConfig.graded.color },
    ];
  }, [filteredSubmissions]);

  // Engagement data
  const engagementData = useMemo(() => {
    const keyActions = ["Started Typing", "Ran Code", "Submitted Activity"];
    const actionCounts = filteredActivityLogs.reduce(
      (acc: { [key: string]: { name: string; startedTyping: number; ranCode: number; submittedActivity: number } }, log: ActivityLog) => {
        if (keyActions.includes(log.action)) {
          const className = classes.find((c) => c.id === log.class_id)?.name || "Unknown";
          if (!acc[className]) {
            acc[className] = { name: className, startedTyping: 0, ranCode: 0, submittedActivity: 0 };
          }
          if (log.action === "Started Typing") acc[className].startedTyping += 1;
          if (log.action === "Ran Code") acc[className].ranCode += 1;
          if (log.action === "Submitted Activity") acc[className].submittedActivity += 1;
        }
        return acc;
      },
      {}
    );
    return Object.values(actionCounts);
  }, [filteredActivityLogs, classes]);

  // Unique students for dropdown
  const uniqueStudents = useMemo(() => {
    const studentIds = Array.from(new Set(memberships.map((m: ClassMembership) => m.student_id)));
    return studentIds.map((id) => ({
      id,
      name: `${mockUsers[id]?.first_name || "Unknown"} ${mockUsers[id]?.last_name || ""}`.trim() || "Unknown Student",
    }));
  }, [memberships]);

  // Summary metrics
  const summaryMetrics = useMemo(() => ({
    totalStudents: enrollmentData.reduce((acc: number, d: { students: number }) => acc + d.students, 0),
    totalSubmissions: filteredSubmissions.length,
    avgAiUsage: (filteredSubmissions.reduce((acc: number, s: Submission) => acc + s.ai_percentage, 0) / (filteredSubmissions.length || 1)).toFixed(2),
    totalActions: filteredActivityLogs.length,
  }), [enrollmentData, filteredSubmissions, filteredActivityLogs]);

  // Export report as CSV
  const exportCsv = () => {
    try {
      const csvContent = [
        ["Class,Students"],
        ...enrollmentData.map((d) => [`${d.name},${d.students}`]),
        [],
        ["Submission Trends"],
        ["Month,Submissions"],
        ...submissionTrendData.map((d) => [`${d.month},${d.submissions}`]),
        [],
        ["AI Usage Distribution"],
        ["Range,Submissions"],
        ...aiUsageData.map((d) => [`${d.range},${d.submissions}`]),
        [],
        ["Submission Status"],
        ...statusData.map((d) => [`${d.status},${d.count}`]),
        [],
        ["Student Engagement"],
        ["Class,Started Typing,Ran Code,Submitted Activity"],
        ...engagementData.map((d) => [`${d.name},${d.startedTyping},${d.ranCode},${d.submittedActivity}`]),
      ].flat().join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analytics-report-${format(new Date(), "yyyyMMdd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      setError("Failed to export CSV.");
    }
  };

  // Export report as LaTeX
  const exportLatex = async () => {
    try {
      const latexContent = `
\\documentclass{article}
\\usepackage{geometry}
\\usepackage{booktabs}
\\usepackage{xcolor}
\\geometry{a4paper, margin=1in}
\\begin{document}
\\title{Class Analytics Report}
\\author{Generated by System}
\\date{${format(new Date(), "MMMM d, yyyy")}}
\\maketitle

\\section{Enrollment}
\\begin{tabular}{ll}
\\toprule
Class & Students \\\\
\\midrule
${enrollmentData.length ? enrollmentData.map((d) => `${d.name} & ${d.students} \\\\`).join("\n") : "No data available \\\\"}
\\bottomrule
\\end{tabular}

\\section{Submissions Over Time}
${submissionTrendData.length ? submissionTrendData.map((d) => `${d.month}: ${d.submissions} submissions`).join("\\\\\n") : "No submissions available"}

\\section{AI Usage Distribution}
\\begin{tabular}{lr}
\\toprule
Range & Submissions \\\\
\\midrule
${aiUsageData.map((d) => `${d.range} & ${d.submissions} \\\\`).join("\n")}
\\bottomrule
\\end{tabular}

\\section{Submission Status}
Pending: ${statusData.find((d) => d.status === "Pending")?.count || 0}\\\\
Graded: ${statusData.find((d) => d.status === "Graded")?.count || 0}

\\section{Student Engagement}
\\begin{tabular}{lrrr}
\\toprule
Class & Started Typing & Ran Code & Submitted Activity \\\\
\\midrule
${engagementData.length ? engagementData.map((d) => `${d.name} & ${d.startedTyping} & ${d.ranCode} & ${d.submittedActivity} \\\\`).join("\n") : "No engagement data available \\\\"}
\\bottomrule
\\end{tabular}

\\end{document}
      `;
      const blob = new Blob([latexContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analytics-report-${format(new Date(), "yyyyMMdd")}.tex`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting LaTeX:", err);
      setError("Failed to export LaTeX.");
    }
  };

  if (error) {
    return (
      <div className={`min-h-screen ${theme === "light" ? "bg-gray-50" : "bg-gray-900"} flex items-center justify-center p-4`}>
        <div className="text-xl font-semibold text-red-400 flex items-center">
          <AlertTriangle className="w-6 h-6 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme === "light" ? "bg-gray-50" : "bg-gray-900"} flex items-center justify-center p-4`}>
        <Skeleton className="w-64 h-8 rounded-lg" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-gray-50" : "bg-gray-900"} p-4 sm:p-6 transition-colors duration-300`}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-opacity-80 backdrop-blur-md mb-6">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/professor")}
              className={`${theme === "light" ? "text-teal-600 hover:bg-teal-100" : "text-teal-400 hover:bg-teal-500/20"} rounded-lg transition-transform hover:scale-105`}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Button
                onClick={exportCsv}
                className={`${theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"} text-white rounded-lg transition-transform hover:scale-105`}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Button
                onClick={exportLatex}
                className={`${theme === "light" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"} text-white rounded-lg transition-transform hover:scale-105`}
              >
                <Download className="w-4 h-4 mr-2" />
                Export LaTeX
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Button
                onClick={toggleTheme}
                className={`${theme === "light" ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-700 hover:bg-gray-600"} rounded-lg transition-transform hover:scale-105`}
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row gap-4 mb-8"
      >
        <div className="flex-1">
          <label className={`${theme === "light" ? "text-gray-700" : "text-gray-100"} font-medium`}>Select Class</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className={`min-w-[200px] w-full ${theme === "light" ? "bg-white border-gray-300 text-gray-900" : "bg-gray-800 border-gray-600 text-gray-100"} rounded-lg`}>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent className={`${theme === "light" ? "bg-white text-gray-900" : "bg-gray-800 text-gray-100"} border-teal-500/20 rounded-lg`}>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.section})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className={`${theme === "light" ? "text-gray-700" : "text-gray-100"} font-medium`}>Select Student</label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className={`min-w-[200px] w-full ${theme === "light" ? "bg-white border-gray-300 text-gray-900" : "bg-gray-800 border-gray-600 text-gray-100"} rounded-lg`}>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent className={`${theme === "light" ? "bg-white text-gray-900" : "bg-gray-800 text-gray-100"} border-teal-500/20 rounded-lg`}>
              <SelectItem value="all">All Students</SelectItem>
              {uniqueStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className={`${theme === "light" ? "text-gray-700" : "text-gray-100"} font-medium`}>Date Range</label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className={`min-w-[200px] w-full ${theme === "light" ? "bg-white border-gray-300 text-gray-900" : "bg-gray-800 border-gray-600 text-gray-100"} rounded-lg`}>
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent className={`${theme === "light" ? "bg-white text-gray-900" : "bg-gray-800 text-gray-100"} border-teal-500/20 rounded-lg`}>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl mb-8 w-full max-w-5xl mx-auto`}>
          <CardHeader className="p-4">
            <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>Analytics Summary</CardTitle>
            <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
              Key metrics for {selectedClass === "all" ? "all classes" : "selected class"} as of {format(new Date(), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            <div className="text-center">
              <p className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-lg font-bold`}>{summaryMetrics.totalStudents}</p>
              <p className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm`}>Total Students</p>
            </div>
            <div className="text-center">
              <p className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-lg font-bold`}>{summaryMetrics.totalSubmissions}</p>
              <p className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm`}>Total Submissions</p>
            </div>
            <div className="text-center">
              <p className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-lg font-bold`}>{summaryMetrics.avgAiUsage}%</p>
              <p className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm`}>Avg AI Usage</p>
            </div>
            <div className="text-center">
              <p className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-lg font-bold`}>{summaryMetrics.totalActions}</p>
              <p className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm`}>Total Actions</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Enrollment Bar Chart */}
        <ErrorBoundary>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl h-[420px] sm:h-[400px] flex flex-col relative pb-[48px]`}>
              <CardHeader className="p-4">
                <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>Student Enrollment</CardTitle>
                <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
                  Students per class as of {format(new Date(), "MMMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                {chartLoading.enrollment ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : enrollmentData.length ? (
                  <ChartContainer config={enrollmentChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={enrollmentData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e5e7eb" : "#4b5563"} />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }}
                          tickFormatter={(value) => (value.length > 15 ? `${value.slice(0, 12)}...` : value)}
                        />
                        <YAxis tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="students" fill={enrollmentChartConfig.students.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className={`flex items-center justify-center h-full ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No enrollment data available
                  </div>
                )}
              </CardContent>
              <CardFooter className="absolute bottom-0 left-0 right-0 min-h-[48px] p-4 pt-2 flex items-center justify-center overflow-visible">
                <div className={`flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"} text-sm sm:text-base font-semibold whitespace-nowrap`}>
                  Total Students: {summaryMetrics.totalStudents} <TrendingUp className="h-4 w-4 flex-shrink-0" />
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* Submission Trend Line Chart */}
        <ErrorBoundary>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl h-[420px] sm:h-[400px] flex flex-col relative pb-[48px]`}>
              <CardHeader className="p-4">
                <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>Submission Trends</CardTitle>
                <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
                  Submissions over time for {selectedClass === "all" ? "all classes" : "selected class"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                {chartLoading.submissions ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : submissionTrendData.some((d) => d.submissions > 0) ? (
                  <ChartContainer config={submissionTrendChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={submissionTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e5e7eb" : "#4b5563"} />
                        <XAxis dataKey="month" tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <YAxis tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="submissions"
                          stroke={submissionTrendChartConfig.submissions.color}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className={`flex items-center justify-center h-full ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No submission data available
                  </div>
                )}
              </CardContent>
              <CardFooter className="absolute bottom-0 left-0 right-0 min-h-[48px] p-4 pt-2 flex items-center justify-center overflow-visible">
                <div className={`flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"} text-sm sm:text-base font-semibold whitespace-nowrap`}>
                  Total Submissions: {summaryMetrics.totalSubmissions} <TrendingUp className="h-4 w-4 flex-shrink-0" />
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* AI Usage Histogram */}
        <ErrorBoundary>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl h-[420px] sm:h-[400px] flex flex-col relative pb-[48px]`}>
              <CardHeader className="p-4">
                <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>AI Usage Distribution</CardTitle>
                <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
                  Distribution of AI-generated content in submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                {chartLoading.aiUsage ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : aiUsageData.some((d) => d.submissions > 0) ? (
                  <ChartContainer config={aiUsageChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiUsageData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e5e7eb" : "#4b5563"} />
                        <XAxis dataKey="range" tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <YAxis tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="submissions" fill={aiUsageChartConfig.submissions.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className={`flex items-center justify-center h-full ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No AI usage data available
                  </div>
                )}
              </CardContent>
              <CardFooter className="absolute bottom-0 left-0 right-0 min-h-[48px] p-4 pt-2 flex items-center justify-center overflow-visible">
                <div className={`flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"} text-sm sm:text-base font-semibold whitespace-nowrap`}>
                  Average AI Usage: {summaryMetrics.avgAiUsage}% <TrendingUp className="h-4 w-4 flex-shrink-0" />
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* Submission Status Pie Chart */}
        <ErrorBoundary>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl h-[420px] sm:h-[400px] flex flex-col relative pb-[48px]`}>
              <CardHeader className="p-4">
                <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>Submission Status</CardTitle>
                <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
                  Breakdown of submission statuses
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                {chartLoading.status ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : statusData.some((d) => d.count > 0) ? (
                  <ChartContainer config={statusChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                        <Pie
                          data={statusData}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={60}
                          strokeWidth={5}
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className={`flex items-center justify-center h-full ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No submission status data available
                  </div>
                )}
              </CardContent>
              <CardFooter className="absolute bottom-0 left-0 right-0 min-h-[48px] p-4 pt-2 flex items-center justify-center overflow-visible">
                <div className={`flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"} text-sm sm:text-base font-semibold whitespace-nowrap`}>
                  Total Submissions: {statusData.reduce((acc: number, d: { count: number }) => acc + d.count, 0)} <TrendingUp className="h-4 w-4 flex-shrink-0" />
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* Engagement Bar Chart */}
        <ErrorBoundary>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className={`${theme === "light" ? "bg-white" : "bg-gray-800"} shadow-sm border-teal-500/20 rounded-xl h-[420px] sm:h-[400px] flex flex-col relative pb-[48px]`}>
              <CardHeader className="p-4">
                <CardTitle className={`${theme === "light" ? "text-gray-900" : "text-gray-100"} text-xl sm:text-2xl`}>Student Engagement</CardTitle>
                <CardDescription className={`${theme === "light" ? "text-gray-600" : "text-gray-300"} text-sm sm:text-base`}>
                  Key actions ({selectedStudent === "all" ? "all students" : "selected student"}) by class
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                {chartLoading.engagement ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : engagementData.length ? (
                  <ChartContainer config={engagementChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={engagementData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e5e7eb" : "#4b5563"} />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }}
                          tickFormatter={(value) => (value.length > 15 ? `${value.slice(0, 12)}...` : value)}
                        />
                        <YAxis tick={{ fill: theme === "light" ? "#1f2937" : "#d1d5db", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Bar dataKey="startedTyping" fill={engagementChartConfig.startedTyping.color} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ranCode" fill={engagementChartConfig.ranCode.color} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="submittedActivity" fill={engagementChartConfig.submittedActivity.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className={`flex items-center justify-center h-full ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No engagement data available
                  </div>
                )}
              </CardContent>
              <CardFooter className="absolute bottom-0 left-0 right-0 min-h-[48px] p-4 pt-2 flex items-center justify-center overflow-visible">
                <div className={`flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"} text-sm sm:text-base font-semibold whitespace-nowrap`}>
                  Total Actions: {summaryMetrics.totalActions} <TrendingUp className="h-4 w-4 flex-shrink-0" />
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
