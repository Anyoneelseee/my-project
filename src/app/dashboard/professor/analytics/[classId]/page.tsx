"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { format, subMonths, parseISO } from "date-fns";
import { Download, ArrowLeft, AlertTriangle, ChevronDown, Users, FileText, Brain, Activity } from "lucide-react";
import { motion} from "framer-motion";
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
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

const mockUsers: { [key: string]: { first_name: string; last_name: string } } = {
  "f4e42be7-7a4c-4a53-a351-c3199abbd679": { first_name: "John", last_name: "Doe" },
  "a5bc1904-5ca5-4782-8d3e-8cd485431f36": { first_name: "Jane", last_name: "Smith" },
  "4077b193-d7ee-4edc-964f-d62b0180442e": { first_name: "Alice", last_name: "Johnson" },
  "a2b8ebe9-83e5-4fed-958f-1d077e11eeba": { first_name: "Bob", last_name: "Brown" },
  "79b48882-7b34-49be-b6c7-dd5f8a2fd174": { first_name: "Carol", last_name: "White" },
};

const enrollmentChartConfig: ChartConfig = {
  students: { label: "Students", color: "#10B981" },
};

const submissionTrendChartConfig: ChartConfig = {
  submissions: { label: "Submissions", color: "#3B82F6" },
};

const aiUsageChartConfig: ChartConfig = {
  submissions: { label: "Submissions", color: "#F59E0B" },
};

const engagementChartConfig: ChartConfig = {
  startedTyping: { label: "Started Typing", color: "#EF4444" },
  ranCode: { label: "Ran Code", color: "#06B6D4" },
  submittedActivity: { label: "Submitted Activity", color: "#10B981" },
};

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
  const [dateRange, setDateRange] = useState<string>("6");
  const [isLoading, setIsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState({
    enrollment: true,
    submissions: true,
    aiUsage: true,
    engagement: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [openSelects, setOpenSelects] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (classId && classId !== "all") setSelectedClass(classId);
  }, [classId]);

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
        const { data: classesData, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .eq("professor_id", session.user.id);
        if (classesError) throw new Error(`Failed to fetch classes: ${classesError.message}`);
        setClasses(classesData || []);
        setChartLoading((prev) => ({ ...prev, enrollment: false }));
        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select("*");
        if (submissionsError) throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
        setSubmissions(submissionsData || []);
        setChartLoading((prev) => ({ ...prev, submissions: false, aiUsage: false }));
        const { data: studentCountsData, error: studentCountsError } = await supabase
          .rpc("get_class_student_counts", { professor_id_input: session.user.id });
        if (studentCountsError) throw new Error(`Failed to fetch student counts: ${studentCountsError.message}`);
        setStudentCounts(studentCountsData || []);
        setChartLoading((prev) => ({ ...prev, enrollment: false }));
        const { data: membershipsData, error: membershipsError } = await supabase
          .from("class_members")
          .select("id, class_id, student_id, joined_at");
        if (membershipsError) throw new Error(`Failed to fetch memberships: ${membershipsError.message}`);
        setMemberships(membershipsData || []);
        const { data: activityLogsData, error: activityLogsError } = await supabase
          .from("activity_logs")
          .select("*");
        if (activityLogsError) throw new Error(`Failed to fetch activity logs: ${activityLogsError.message}`);
        setActivityLogs(activityLogsData || []);
        setChartLoading((prev) => ({ ...prev, engagement: false }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        router.push("/dashboard/professor");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [router]);

  const filteredSubmissions = useMemo(() => {
    const months = parseInt(dateRange) || 12;
    const startDate = dateRange === "all" ? new Date(0) : subMonths(new Date(), months);
    return submissions.filter((sub) => {
      if (!sub.class_id || !sub.student_id || !sub.submitted_at) return false;
      const subDate = parseISO(sub.submitted_at);
      const classMatch = selectedClass === "all" || sub.class_id === selectedClass;
      const studentMatch = selectedStudent === "all" || sub.student_id === selectedStudent;
      return classMatch && studentMatch && subDate >= startDate;
    });
  }, [submissions, selectedClass, selectedStudent, dateRange]);

  const filteredActivityLogs = useMemo(() => {
    const months = parseInt(dateRange) || 12;
    const startDate = dateRange === "all" ? new Date(0) : subMonths(new Date(), months);
    return activityLogs.filter((log) => {
      if (!log.class_id || !log.student_id || !log.timestamp) return false;
      const logDate = parseISO(log.timestamp);
      const classMatch = selectedClass === "all" || log.class_id === selectedClass;
      const studentMatch = selectedStudent === "all" || log.student_id === selectedStudent;
      return classMatch && studentMatch && logDate >= startDate;
    });
  }, [activityLogs, selectedClass, selectedStudent, dateRange]);

  const enrollmentData = useMemo(() => {
    return studentCounts.map((cls) => ({
      name: `${cls.class_name} (${cls.section})`,
      students: cls.student_count,
      fill: enrollmentChartConfig.students.color,
    }));
  }, [studentCounts]);

  const submissionTrendData = useMemo(() => {
    const months = parseInt(dateRange) || 12;
    const trendMonths = Array.from({ length: dateRange === "all" ? 12 : months }, (_, i) => {
      const date = subMonths(new Date(), i);
      return { month: format(date, "MMM yyyy"), submissions: 0 };
    }).reverse();
    filteredSubmissions.forEach((sub) => {
      const month = format(parseISO(sub.submitted_at), "MMM yyyy");
      const index = trendMonths.findIndex((m) => m.month === month);
      if (index !== -1) trendMonths[index].submissions += 1;
    });
    return trendMonths;
  }, [filteredSubmissions, dateRange]);

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

  const engagementData = useMemo(() => {
    const keyActions = ["Started Typing", "Ran Code", "Submitted Activity"];
    const actionMap = new Map<string, { name: string; startedTyping: number; ranCode: number; submittedActivity: number }>();
    classes.forEach((cls) => {
      const className = `${cls.name} (${cls.section})`;
      if (!actionMap.has(className)) {
        actionMap.set(className, { name: className, startedTyping: 0, ranCode: 0, submittedActivity: 0 });
      }
    });
    filteredActivityLogs.forEach((log) => {
      if (keyActions.includes(log.action)) {
        const className = classes.find((c) => c.id === log.class_id)?.name;
        const section = classes.find((c) => c.id === log.class_id)?.section;
        const fullName = className && section ? `${className} (${section})` : "Unknown";
        if (!actionMap.has(fullName)) {
          actionMap.set(fullName, { name: fullName, startedTyping: 0, ranCode: 0, submittedActivity: 0 });
        }
        const entry = actionMap.get(fullName)!;
        if (log.action === "Started Typing") entry.startedTyping += 1;
        if (log.action === "Ran Code") entry.ranCode += 1;
        if (log.action === "Submitted Activity") entry.submittedActivity += 1;
      }
    });
    return Array.from(actionMap.values());
  }, [filteredActivityLogs, classes]);

  const uniqueStudents = useMemo(() => {
    const studentIds = Array.from(new Set(memberships.map((m) => m.student_id)));
    return studentIds.map((id) => ({
      id,
      name: `${mockUsers[id]?.first_name || "Unknown"} ${mockUsers[id]?.last_name || ""}`.trim() || "Unknown Student",
    }));
  }, [memberships]);

  const summaryMetrics = useMemo(() => ({
    totalStudents: enrollmentData.reduce((acc, d) => acc + d.students, 0),
    totalSubmissions: filteredSubmissions.length,
    avgAiUsage: (filteredSubmissions.reduce((acc, s) => acc + s.ai_percentage, 0) / (filteredSubmissions.length || 1)).toFixed(2),
    totalActions: filteredActivityLogs.length,
  }), [enrollmentData, filteredSubmissions, filteredActivityLogs]);

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
    } catch {
      setError("Failed to export CSV.");
    }
  };

  const handleSelectOpenChange = (key: string, open: boolean) => {
    setOpenSelects(prev => ({ ...prev, [key]: open }));
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="text-xl font-semibold text-red-400 flex items-center"
        >
          <AlertTriangle className="w-6 h-6 mr-2" />
          {error}
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Skeleton className="w-64 h-8 rounded-xl bg-slate-700" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 mb-8 rounded-3xl p-6 shadow-2xl shadow-teal-500/10"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/professor")}
              className="text-teal-400 hover:bg-teal-500/20 border border-teal-500/30 rounded-2xl transition-all hover:scale-105 hover:shadow-md hover:shadow-teal-500/20 bg-slate-800/50 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Button>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Button
              onClick={exportCsv}
              className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-2xl transition-all hover:scale-105 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Insights
            </Button>
          </motion.div>
        </div>
      </motion.header>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10"
      >
        <div className="space-y-3">
          <label className="text-slate-200 font-semibold text-sm tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Select Class
          </label>
          <Select value={selectedClass} onValueChange={setSelectedClass} open={openSelects.class} onOpenChange={(open) => handleSelectOpenChange('class', open)}>
            <SelectTrigger className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 text-slate-100 rounded-2xl text-sm shadow-sm hover:shadow-teal-500/10 transition-all group data-[state=open]:border-teal-500/50 data-[state=open]:bg-slate-800/70 flex items-center justify-between px-3 py-2 h-auto min-h-[44px]">
              <SelectValue placeholder="Select a class..." className="text-slate-100" />
              <ChevronDown className="h-4 w-4 text-slate-300 group-data-[state=open]:text-teal-400 group-data-[state=open]:rotate-180 transition-all duration-200 ml-2 shrink-0" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800/95 backdrop-blur-xl text-slate-100 border border-slate-700/50 rounded-2xl shadow-2xl shadow-teal-500/10 w-[var(--radix-select-trigger-width)] mt-1">
              <SelectItem value="all" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id} className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">
                  {cls.name} ({cls.section})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <label className="text-slate-200 font-semibold text-sm tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Select Student
          </label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent} open={openSelects.student} onOpenChange={(open) => handleSelectOpenChange('student', open)}>
            <SelectTrigger className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 text-slate-100 rounded-2xl text-sm shadow-sm hover:shadow-teal-500/10 transition-all group data-[state=open]:border-teal-500/50 data-[state=open]:bg-slate-800/70 flex items-center justify-between px-3 py-2 h-auto min-h-[44px]">
              <SelectValue placeholder="Select a student..." className="text-slate-100" />
              <ChevronDown className="h-4 w-4 text-slate-300 group-data-[state=open]:text-teal-400 group-data-[state=open]:rotate-180 transition-all duration-200 ml-2 shrink-0" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800/95 backdrop-blur-xl text-slate-100 border border-slate-700/50 rounded-2xl shadow-2xl shadow-teal-500/10 w-[var(--radix-select-trigger-width)] mt-1">
              <SelectItem value="all" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">All Students</SelectItem>
              {uniqueStudents.map((student) => (
                <SelectItem key={student.id} value={student.id} className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <label className="text-slate-200 font-semibold text-sm tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Date Range
          </label>
          <Select value={dateRange} onValueChange={setDateRange} open={openSelects.date} onOpenChange={(open) => handleSelectOpenChange('date', open)}>
            <SelectTrigger className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 text-slate-100 rounded-2xl text-sm shadow-sm hover:shadow-teal-500/10 transition-all group data-[state=open]:border-teal-500/50 data-[state=open]:bg-slate-800/70 flex items-center justify-between px-3 py-2 h-auto min-h-[44px]">
              <SelectValue placeholder="Select date range..." className="text-slate-100" />
              <ChevronDown className="h-4 w-4 text-slate-300 group-data-[state=open]:text-teal-400 group-data-[state=open]:rotate-180 transition-all duration-200 ml-2 shrink-0" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800/95 backdrop-blur-xl text-slate-100 border border-slate-700/50 rounded-2xl shadow-2xl shadow-teal-500/10 w-[var(--radix-select-trigger-width)] mt-1">
              <SelectItem value="3" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">Last 3 Months</SelectItem>
              <SelectItem value="6" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">Last 6 Months</SelectItem>
              <SelectItem value="12" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">Last 12 Months</SelectItem>
              <SelectItem value="all" className="hover:bg-teal-500/10 text-slate-100 rounded-xl cursor-pointer transition-colors py-2 px-3">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Summary Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
        <Card className="bg-slate-800/60 backdrop-blur-2xl border border-teal-500/30 shadow-2xl shadow-teal-500/10 rounded-3xl mb-10 w-full max-w-6xl mx-auto overflow-hidden">
          <CardHeader className="p-8 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-b border-teal-500/20">
            <CardTitle className="text-teal-400 text-3xl font-bold tracking-tight flex items-center gap-3">
              <Brain className="w-8 h-8" />
              Executive Analytics Summary
            </CardTitle>
            <CardDescription className="text-slate-300 text-lg mt-2">
              Premium insights for {selectedClass === "all" ? "all classes" : "selected class"} as of {format(new Date(), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8">
            {[
              { value: summaryMetrics.totalStudents, label: "Total Students", icon: Users, color: "from-emerald-500 to-emerald-400" },
              { value: summaryMetrics.totalSubmissions, label: "Total Submissions", icon: FileText, color: "from-blue-500 to-blue-400" },
              { value: `${summaryMetrics.avgAiUsage}%`, label: "Avg AI Usage", icon: Brain, color: "from-amber-500 to-amber-400" },
              { value: summaryMetrics.totalActions, label: "Total Actions", icon: Activity, color: "from-purple-500 to-purple-400" },
            ].map((metric, index) => (
              <motion.div 
                key={metric.label}
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="group text-center space-y-3 p-6 rounded-2xl bg-gradient-to-b from-slate-700/50 to-slate-800/30 border border-slate-600/50 hover:border-teal-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-teal-500/20"
              >
                <motion.div 
                  className={`p-3 rounded-xl bg-gradient-to-r ${metric.color} bg-opacity-20 flex justify-center`}
                  whileHover={{ scale: 1.05 }}
                >
                  <metric.icon className={`w-6 h-6 text-${metric.color.split(' ')[0].replace('from-', '')}-300`} />
                </motion.div>
                <p className={`text-3xl font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}>{metric.value}</p>
                <p className="text-slate-300 text-sm font-medium group-hover:text-teal-300 transition-colors">{metric.label}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Grid — PREMIUM RESPONSIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl mx-auto">
        {/* Enrollment */}
        <ErrorBoundary>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
            <Card className="bg-slate-800/60 backdrop-blur-2xl border border-teal-500/30 shadow-2xl shadow-teal-500/10 rounded-3xl flex flex-col overflow-hidden group hover:shadow-teal-500/20 transition-all">
              <CardHeader className="p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-teal-500/20">
                <CardTitle className="text-emerald-400 text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Student Enrollment • Per Class
                </CardTitle>
                <CardDescription className="text-slate-300">Distribution of enrolled students across classes</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6 pt-0 min-h-[350px] relative">
                {chartLoading.enrollment ? (
                  <Skeleton className="w-full h-full rounded-2xl bg-slate-700/50" />
                ) : enrollmentData.length ? (
                  <ChartContainer config={enrollmentChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={enrollmentData} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={70}
                          tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }}
                          tickLine={false}
                          tickFormatter={(v) => v.length > 15 ? `${v.slice(0, 13)}...` : v}
                        />
                        <YAxis tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <Tooltip 
                          content={<ChartTooltipContent className="border border-teal-500/20 bg-slate-800/95 backdrop-blur-sm text-slate-100" />} 
                          wrapperStyle={{ fontSize: 14 }}
                        />
                        <Bar dataKey="students" fill={enrollmentChartConfig.students.color} radius={[8, 8, 0, 0]} className="group-hover:opacity-90 transition-opacity" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-slate-400">
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No enrollment data yet
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="p-6 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-t border-teal-500/20">
                <div className="text-emerald-300 text-base font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Total Enrollments: <span className="text-2xl font-bold text-slate-100">{summaryMetrics.totalStudents}</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* Submission Trend */}
        <ErrorBoundary>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            <Card className="bg-slate-800/60 backdrop-blur-2xl border border-teal-500/30 shadow-2xl shadow-teal-500/10 rounded-3xl flex flex-col overflow-hidden group hover:shadow-teal-500/20 transition-all">
              <CardHeader className="p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-teal-500/20">
                <CardTitle className="text-blue-400 text-2xl font-bold flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  Submission Trends • Over Time
                </CardTitle>
                <CardDescription className="text-slate-300">Temporal evolution of student submissions</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6 pt-0 min-h-[350px] relative">
                {chartLoading.submissions ? (
                  <Skeleton className="w-full h-full rounded-2xl bg-slate-700/50" />
                ) : submissionTrendData.some(d => d.submissions > 0) ? (
                  <ChartContainer config={submissionTrendChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={submissionTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
                        <XAxis dataKey="month" tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <YAxis tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <Tooltip 
                          content={<ChartTooltipContent className="border border-teal-500/20 bg-slate-800/95 backdrop-blur-sm text-slate-100" />} 
                          wrapperStyle={{ fontSize: 14 }}
                        />
                        <Line type="monotone" dataKey="submissions" stroke={submissionTrendChartConfig.submissions.color} strokeWidth={3} dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2 }} activeDot={{ r: 6 }} className="group-hover:opacity-90 transition-opacity" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-slate-400">
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No submission trends yet
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="p-6 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-t border-teal-500/20">
                <div className="text-blue-300 text-base font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Total Submissions: <span className="text-2xl font-bold text-slate-100">{summaryMetrics.totalSubmissions}</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* AI Usage */}
        <ErrorBoundary>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            <Card className="bg-slate-800/60 backdrop-blur-2xl border border-teal-500/30 shadow-2xl shadow-teal-500/10 rounded-3xl flex flex-col overflow-hidden group hover:shadow-teal-500/20 transition-all">
              <CardHeader className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-teal-500/20">
                <CardTitle className="text-amber-400 text-2xl font-bold flex items-center gap-2">
                  <Brain className="w-6 h-6" />
                  AI Usage Distribution • Content Analysis
                </CardTitle>
                <CardDescription className="text-slate-300">Breakdown by AI generation percentage</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6 pt-0 min-h-[350px] relative">
                {chartLoading.aiUsage ? (
                  <Skeleton className="w-full h-full rounded-2xl bg-slate-700/50" />
                ) : aiUsageData.some(d => d.submissions > 0) ? (
                  <ChartContainer config={aiUsageChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiUsageData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
                        <XAxis dataKey="range" tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <YAxis tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <Tooltip 
                          content={<ChartTooltipContent className="border border-teal-500/20 bg-slate-800/95 backdrop-blur-sm text-slate-100" />} 
                          wrapperStyle={{ fontSize: 14 }}
                        />
                        <Bar dataKey="submissions" fill={aiUsageChartConfig.submissions.color} radius={[8, 8, 0, 0]} className="group-hover:opacity-90 transition-opacity" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-slate-400">
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No AI usage data yet
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="p-6 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-t border-teal-500/20">
                <div className="text-amber-300 text-base font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Average Usage: <span className="text-2xl font-bold text-slate-100">{summaryMetrics.avgAiUsage}%</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>

        {/* Engagement */}
        <ErrorBoundary>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}>
            <Card className="bg-slate-800/60 backdrop-blur-2xl border border-teal-500/30 shadow-2xl shadow-teal-500/10 rounded-3xl flex flex-col overflow-hidden group hover:shadow-teal-500/20 transition-all">
              <CardHeader className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-teal-500/20">
                <CardTitle className="text-purple-400 text-2xl font-bold flex items-center gap-2">
                  <Activity className="w-6 h-6" />
                  Student Engagement • Key Actions
                </CardTitle>
                <CardDescription className="text-slate-300">Interactive behaviors by class</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6 pt-0 min-h-[350px] relative">
                {chartLoading.engagement ? (
                  <Skeleton className="w-full h-full rounded-2xl bg-slate-700/50" />
                ) : engagementData.length > 0 ? (
                  <ChartContainer config={engagementChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={engagementData} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={70}
                          tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }}
                          tickLine={false}
                          tickFormatter={(v) => v.length > 15 ? `${v.slice(0, 13)}...` : v}
                        />
                        <YAxis tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 500 }} tickLine={false} />
                        <Tooltip 
                          content={<ChartTooltipContent className="border border-teal-500/20 bg-slate-800/95 backdrop-blur-sm text-slate-100" />} 
                          wrapperStyle={{ fontSize: 14 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 500, color: "#e5e7eb" }} />
                        <Bar dataKey="startedTyping" fill={engagementChartConfig.startedTyping.color} radius={[8, 8, 0, 0]} className="group-hover:opacity-90 transition-opacity" />
                        <Bar dataKey="ranCode" fill={engagementChartConfig.ranCode.color} radius={[8, 8, 0, 0]} className="group-hover:opacity-90 transition-opacity" />
                        <Bar dataKey="submittedActivity" fill={engagementChartConfig.submittedActivity.color} radius={[8, 8, 0, 0]} className="group-hover:opacity-90 transition-opacity" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-slate-400">
                    <AlertTriangle className="w-6 h-6 mr-2" />
                    No engagement data yet
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="p-6 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-t border-teal-500/20">
                <div className="text-purple-300 text-base font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Total Interactions: <span className="text-2xl font-bold text-slate-100">{summaryMetrics.totalActions}</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </ErrorBoundary>
      </div>
    </div>
  );
}