"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, Pause, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import React from "react";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface ActivityLog {
  id: string;
  student_id: string;
  student_name: string;
  action: string;
  timestamp: string;
}

interface RawActivityLog {
  id: string;
  student_id: string;
  action: string;
  timestamp: string;
  first_name: string | null;
  last_name: string | null;
}

interface AggregatedLog {
  student_id: string;
  student_name: string;
  latest_action: string;
  latest_timestamp: string;
  all_logs: ActivityLog[];
}

const REALTIME_SUBSCRIBE_STATES = {
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
  SUBSCRIBED: "SUBSCRIBED",
} as const;

export default function MonitoringPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .rpc("get_activity_logs", { class_id: classId });
      if (logsError) {
        setErrorMessage("Failed to load activity logs. Please try again.");
        setLogs([]);
      } else {
        const formattedLogs: ActivityLog[] = (logsData as RawActivityLog[]).map((log) => ({
          id: log.id,
          student_id: log.student_id,
          student_name: log.first_name && log.last_name 
            ? `${log.first_name} ${log.last_name}`.trim() 
            : "Unknown",
          action: log.action,
          timestamp: log.timestamp,
        }));
        setLogs(formattedLogs);
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage("An error occurred while fetching logs.");
    }
  }, [classId]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
            subscription.unsubscribe();
            proceedWithSession();
          }
        });

        const proceedWithSession = async () => {
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              router.push("/dashboard/student");
              return;
            }

            const { data: allClassesData, error: allClassesError } = await supabase
              .rpc("get_professor_classes");
            if (allClassesError || !allClassesData || allClassesData.length === 0) {
              router.push("/dashboard/professor");
              return;
            }
            setAllClasses(allClassesData as Class[]);

            const current = allClassesData.find((c: Class) => c.id === classId);
            if (!current) {
              router.push("/dashboard/professor");
              return;
            }
            setCurrentClass(current);

            await fetchLogs();
          } catch {
            setErrorMessage("An unexpected error occurred.");
            router.push("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch {
        setErrorMessage("An unexpected error occurred.");
        router.push("/dashboard/professor");
      }
    };

    initialize();
  }, [classId, router, fetchLogs]);

  // Real-time subscription
  useEffect(() => {
    if (isPaused) return;

    const channel = supabase
      .channel(`activity_logs:class_${classId}`, { config: { broadcast: { ack: true } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `class_id=eq.${classId}`,
        },
        async (payload) => {
          try {
            const { data: userData, error: userError } = await supabase
              .from("users")
              .select("first_name, last_name")
              .eq("id", payload.new.student_id)
              .single();
            if (userError) return;

            const newLog: ActivityLog = {
              id: payload.new.id,
              student_id: payload.new.student_id,
              student_name: userData && userData.first_name && userData.last_name 
                ? `${userData.first_name} ${userData.last_name}`.trim() 
                : "Unknown",
              action: payload.new.action,
              timestamp: payload.new.timestamp,
            };
            setLogs((prev) => [newLog, ...prev].slice(0, 1000));
          } catch {
            setErrorMessage("Error processing real-time updates.");
          }
        }
      )
      .subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.CLOSED || status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          setTimeout(() => {
            supabase.channel(`activity_logs:class_${classId}`).subscribe();
          }, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, isPaused]);

  // Polling fallback
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isPaused, fetchLogs]);

  // Aggregate and filter logs — CLEAN
  const aggregatedLogs = useMemo(() => {
    const logMap = new Map<string, AggregatedLog>();
    logs
      .filter((log) =>
        filter
          ? log.student_name.toLowerCase().includes(filter.toLowerCase()) ||
            log.action.toLowerCase().includes(filter.toLowerCase())
          : true
      )
      .forEach((log) => {
        const existing = logMap.get(log.student_id);
        if (!existing) {
          logMap.set(log.student_id, {
            student_id: log.student_id,
            student_name: log.student_name,
            latest_action: log.action,
            latest_timestamp: log.timestamp,
            all_logs: [log],
          });
        } else {
          const isNewer = new Date(log.timestamp) > new Date(existing.latest_timestamp);
          logMap.set(log.student_id, {
            ...existing,
            latest_action: isNewer ? log.action : existing.latest_action,
            latest_timestamp: isNewer ? log.timestamp : existing.latest_timestamp,
            all_logs: [log, ...existing.all_logs].slice(0, 50),
          });
        }
      });
    return Array.from(logMap.values()).sort((a, b) =>
      new Date(b.latest_timestamp).getTime() - new Date(a.latest_timestamp).getTime()
    );
  }, [logs, filter]);

const toggleExpand = useCallback((studentId: string) => {
  setExpandedStudents((prev) => {
    const newSet = new Set(prev);

    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }

    return newSet;
  });
}, []);




  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="text-2xl font-bold text-teal-300 animate-pulse">Loading Monitoring...</div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-teal-300">
        Class not found.
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={allClasses} />

      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4 border-b border-teal-500/20 bg-gradient-to-br from-gray-800 to-gray-900">
          <SidebarTrigger className="hover:bg-teal-500/20 p-2 rounded-lg transition-colors text-teal-400" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-teal-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-teal-300 hover:text-teal-400 text-sm font-medium">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-teal-400 text-sm font-medium">
                  Monitoring - {currentClass.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 min-h-screen">
          <div className="max-w-8xl mx-auto space-y-6">

            <Card className="border border-teal-500/30 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-teal-500/20 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 p-5 md:p-7">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl font-bold text-teal-400">
                      Live Student Activity
                    </CardTitle>
                    <p className="text-sm md:text-base text-teal-300 mt-1">
                      {currentClass.name} • {currentClass.section}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <Input
                      placeholder="Search student or action..."
                      value={filter}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
                      className="w-full sm:w-64 bg-gray-700/50 text-teal-300 border-teal-500/30 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsPaused(!isPaused)}
                        variant={isPaused ? "default" : "outline"}
                        className={`flex-1 sm:flex-initial min-w-[120px] h-12 rounded-xl font-bold transition-all ${
                          isPaused 
                            ? "bg-teal-500 hover:bg-teal-600 text-white shadow-lg" 
                            : "bg-gray-700/50 hover:bg-gray-600 text-teal-300 border-teal-500/30"
                        }`}
                      >
                        {isPaused ? (
                          <>
                            <Play className="h-4 w-4 mr-2" /> Resume
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-2" /> Pause
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={fetchLogs}
                        variant="outline"
                        className="h-12 w-12 p-0 rounded-xl bg-gray-700/50 hover:bg-gray-600 text-teal-300 border-teal-500/30"
                        title="Refresh"
                      >
                        <RefreshCw className={`h-4 w-4 ${isPaused ? "" : "animate-spin-slow"}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {errorMessage ? (
                  <div className="p-8 text-center">
                    <p className="text-red-400 text-lg">{errorMessage}</p>
                  </div>
                ) : aggregatedLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-teal-300 text-lg">No activity logs yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-teal-500/20">
                          <TableHead className="text-teal-400 font-bold text-sm md:text-base">Student</TableHead>
                          <TableHead className="text-teal-400 font-bold text-sm md:text-base">Latest Action</TableHead>
                          <TableHead className="text-teal-400 font-bold text-sm md:text-base hidden sm:table-cell">Last Active</TableHead>
                          <TableHead className="text-teal-400 font-bold text-right text-sm md:text-base">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aggregatedLogs.map((aggLog) => {
                          const isRecent = new Date().getTime() - new Date(aggLog.latest_timestamp).getTime() < 30 * 1000;
                          return (
                            <React.Fragment key={aggLog.student_id}>
                              <TableRow
                                className={`border-b border-teal-500/10 transition-colors ${
                                  isRecent ? "bg-teal-900/30 animate-pulse" : "hover:bg-gray-800/30"
                                }`}
                              >
                                <TableCell className="font-medium text-teal-300 text-sm md:text-base">
                                  {aggLog.student_name}
                                </TableCell>
                                <TableCell className="text-teal-300 text-sm md:text-base">
                                  <span className="font-mono text-xs md:text-sm bg-gray-800/50 px-2 py-1 rounded-lg">
                                    {aggLog.latest_action}
                                  </span>
                                </TableCell>
                                <TableCell className="text-teal-300 text-xs md:text-sm hidden sm:table-cell">
                                  {new Date(aggLog.latest_timestamp).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpand(aggLog.student_id)}
                                    className="text-teal-400 hover:text-teal-300 hover:bg-teal-500/20 rounded-xl"
                                  >
                                    {expandedStudents.has(aggLog.student_id) ? (
                                      <ChevronUp className="h-5 w-5" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>

                              {expandedStudents.has(aggLog.student_id) && (
                                <TableRow>
                                  <TableCell colSpan={4} className="p-0">
                                    <div className="bg-gray-800/50 border-t border-teal-500/20">
                                      {aggLog.all_logs.map((log) => (
                                        <div
                                          key={log.id}
                                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-3 border-b border-gray-700/50 last:border-0"
                                        >
                                          <span className="font-mono text-xs md:text-sm text-teal-300">
                                            {log.action}
                                          </span>
                                          <span className="text-xs text-gray-400 mt-1 sm:mt-0">
                                            {new Date(log.timestamp).toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}