"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, REALTIME_SUBSCRIBE_STATES } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
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

export default function MonitoringPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch logs manually
  const fetchLogs = useCallback(async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .rpc("get_activity_logs", { class_id: classId });
      if (logsError) {
        console.warn("RPC fetch failed:", logsError.message, logsError.details);
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
        setRefreshKey((prev) => prev + 1);
        console.log("Fetched logs:", formattedLogs);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error("Fetch logs error:", err);
      setErrorMessage("An error occurred while fetching logs.");
    }
  }, [classId]);

  // Initial fetch
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
              console.error("No session:", sessionError?.message);
              router.push("/login");
              return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
              console.error("Auth error:", authError?.message);
              router.push("/login");
              return;
            }

            const role = await getUserRole();
            if (!role || role !== "professor") {
              console.warn("Invalid role:", role);
              router.push("/dashboard/student");
              return;
            }

            const { data: classDataArray, error: classError } = await supabase
              .rpc("get_professor_classes")
              .eq("id", classId);

            if (classError || !classDataArray || classDataArray.length === 0) {
              console.error("Class fetch error:", classError?.message);
              router.push("/dashboard/professor");
              return;
            }

            const classData = classDataArray[0] as Class;
            setClassData(classData);

            await fetchLogs();
          } catch (err) {
            console.error("Unexpected error:", err);
            setErrorMessage("An unexpected error occurred. Please try again later.");
            router.push("/dashboard/professor");
          } finally {
            setIsLoading(false);
          }
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        setErrorMessage("An unexpected error occurred. Please try again later.");
        router.push("/dashboard/professor");
      }
    };

    initialize();
  }, [classId, router, fetchLogs]);

  // Real-time subscription with reconnection
  useEffect(() => {
    if (isPaused) {
      console.log("Real-time subscription paused for class:", classId);
      return;
    }

    console.log("Initializing real-time subscription for class:", classId);

    const channel = supabase
      .channel(`activity_logs:class_${classId}`, {
        config: {
          broadcast: { ack: true },
        },
      })
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
            console.log("Received real-time payload:", payload);
            const { data: userData, error: userError } = await supabase
              .from("users")
              .select("first_name, last_name")
              .eq("id", payload.new.student_id)
              .single();
            if (userError) {
              console.warn("Failed to fetch user:", userError.message);
            }
            const newLog: ActivityLog = {
              id: payload.new.id,
              student_id: payload.new.student_id,
              student_name: userData && userData.first_name && userData.last_name 
                ? `${userData.first_name} ${userData.last_name}`.trim() 
                : "Unknown",
              action: payload.new.action,
              timestamp: payload.new.timestamp,
            };
            setLogs((prev) => {
              const updatedLogs = [newLog, ...prev].slice(0, 1000);
              console.log("Appended real-time log:", newLog, "Total logs:", updatedLogs.length);
              return updatedLogs;
            });
            setRefreshKey((prev) => prev + 1);
          } catch (err) {
            console.error("Error processing real-time log:", err);
            setErrorMessage("Error processing real-time updates.");
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Subscription error:", err);
          setErrorMessage("Real-time updates failed. Please refresh the page.");
        }
        console.log("Subscription status:", status);
        // Attempt to reconnect on error or closed state
        if (status === REALTIME_SUBSCRIBE_STATES.CLOSED || status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          console.log("Attempting to reconnect to channel:", `activity_logs:class_${classId}`);
          setTimeout(() => {
            supabase.channel(`activity_logs:class_${classId}`).subscribe();
          }, 5000);
        }
      });

    return () => {
      console.log("Unsubscribing from real-time channel:", `activity_logs:class_${classId}`);
      supabase.removeChannel(channel);
    };
  }, [classId, isPaused]);

  // Fallback polling for logs
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      console.log("Polling logs for class:", classId);
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [classId, isPaused, fetchLogs]);

  // Aggregate and filter logs
  const aggregatedLogs = useMemo(() => {
    console.log("Recomputing aggregatedLogs, refreshKey:", refreshKey, "logs count:", logs.length);
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
    const result = Array.from(logMap.values()).sort((a, b) =>
      new Date(b.latest_timestamp).getTime() - new Date(a.latest_timestamp).getTime()
    );
    console.log("Aggregated logs:", result);
    return result;
  }, [logs, filter, refreshKey]);

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
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (!classData) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Class not found.</div>;
  }

  return (
    <SidebarProvider>
      <ProfessorSidebar classes={[classData]} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-white shadow-sm">
          <SidebarTrigger className="-ml-1 text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/professor" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-gray-900 text-sm font-medium">
                  Monitoring - {classData.name} ({classData.section})
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6 bg-gray-100">
          <div className="max-w-7xl mx-auto space-y-8">
            <Card className="border-none shadow-lg bg-white rounded-xl">
              <CardHeader className="border-b border-gray-200 flex flex-row justify-between items-center">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Student Activity Logs
                </CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="Filter by student or action"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-64"
                  />
                  <Button
                    onClick={() => setIsPaused(!isPaused)}
                    variant={isPaused ? "default" : "outline"}
                  >
                    {isPaused ? "Resume Updates" : "Pause Updates"}
                  </Button>
                  <Button
                    onClick={fetchLogs}
                    variant="outline"
                    title="Refresh logs"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {errorMessage ? (
                  <p className="text-red-500 text-center">{errorMessage}</p>
                ) : aggregatedLogs.length === 0 ? (
                  <p className="text-gray-500 text-center">No activity logs available.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Latest Action</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedLogs.map((aggLog) => (
                        <React.Fragment key={aggLog.student_id}>
                          <TableRow
                            className={
                              new Date().getTime() - new Date(aggLog.latest_timestamp).getTime() < 30 * 1000
                                ? "bg-blue-50"
                                : ""
                            }
                          >
                            <TableCell>{aggLog.student_name}</TableCell>
                            <TableCell>{aggLog.latest_action}</TableCell>
                            <TableCell>{new Date(aggLog.latest_timestamp).toLocaleString()}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(aggLog.student_id)}
                              >
                                {expandedStudents.has(aggLog.student_id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedStudents.has(aggLog.student_id) && (
                            aggLog.all_logs.map((log) => (
                              <TableRow key={log.id} className="bg-gray-50">
                                <TableCell colSpan={2} className="pl-8">{log.action}</TableCell>
                                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}