// File: src/components/StudentNotificationsPage.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bell, X, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { subscriptionManager } from "@/lib/subscriptionManager";

interface Notification {
  id: string;
  student_id: string;
  class_id: string;
  activity_id: string;
  message: string;
  created_at: string;
}

export default function StudentNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark" || "dark") : "dark"
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("No session found:", sessionError?.message);
        router.push("/login");
        return;
      }

      await subscriptionManager.initialize(session.user.id);
      const unsubscribe = subscriptionManager.subscribe((updatedNotifications) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Updating student notifications state:", updatedNotifications);
        }
        setNotifications(updatedNotifications);
      });

      const syncInterval = setInterval(() => {
        if (subscriptionManager.currentUserId) {
          subscriptionManager.syncNotifications(subscriptionManager.currentUserId);
        }
      }, 5 * 60 * 1000);

      const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "TOKEN_REFRESHED" && newSession) {
          if (process.env.NODE_ENV === "development") {
            console.log("Token refreshed for user:", newSession.user.id);
          }
          subscriptionManager.initialize(newSession.user.id);
        }
      });

      return () => {
        unsubscribe();
        clearInterval(syncInterval);
        authListener.subscription.unsubscribe();
      };
    };

    initialize();

    return () => {
      if (process.env.NODE_ENV === "development") {
        console.log("StudentNotificationsPage unmounted");
      }
    };
  }, [router]);

  const handleDeleteNotification = async (notificationId: string) => {
    if (deletingId === notificationId) return;
    setDeletingId(notificationId);

    try {
      const { error } = await supabase
        .from("student_notifications")
        .delete()
        .eq("id", notificationId)
        .eq("student_id", subscriptionManager.currentUserId);

      if (error) {
        console.error("Error deleting notification:", error.message, error.details, error.hint);
        if (error.code === "42501") {
          toast.error("Permission denied. Please check your authentication status.", {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        } else {
          toast.error(`Failed to delete notification: ${error.message}`, {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        }
        return;
      }

      subscriptionManager.currentNotifications = subscriptionManager.currentNotifications.filter(
        (notif) => notif.id !== notificationId
      );
      subscriptionManager.notifySubscribers();
      toast.success("Notification deleted successfully.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from("student_notifications")
        .delete()
        .eq("student_id", subscriptionManager.currentUserId);

      if (error) {
        console.error("Error deleting all notifications:", error.message, error.details, error.hint);
        if (error.code === "42501") {
          toast.error("Permission denied. Please check your authentication status.", {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        } else {
          toast.error(`Failed to delete all notifications: ${error.message}`, {
            style: {
              background: theme === "light" ? "#f1f5f9" : "#1f2937",
              color: theme === "light" ? "#0f172a" : "#e5e7eb",
              border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
            },
          });
        }
        return;
      }

      subscriptionManager.currentNotifications = [];
      subscriptionManager.notifySubscribers();
      toast.success("All notifications deleted successfully.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
    }
  };

  const handleForceSync = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("No active session. Please log in again.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
        },
      });
      return;
    }
    await subscriptionManager.syncNotifications(session.user.id);
    toast.success("Notifications synced manually.", {
      style: {
        background: theme === "light" ? "#f1f5f9" : "#1f2937",
        color: theme === "light" ? "#0f172a" : "#e5e7eb",
        border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
      },
    });
  };

  return (
    <div className={`min-h-screen ${
      theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
    } p-6 font-['Poppins']`}>
      <Card className={`${
        theme === "light" ? "bg-gradient-to-br from-slate-100 to-gray-200" : "bg-gradient-to-br from-gray-800 to-gray-900"
      } border-teal-500/20 rounded-xl shadow-lg max-w-2xl mx-auto`}>
        <CardHeader>
          <CardTitle className={`text-2xl font-extrabold ${
            theme === "light" ? "text-slate-900" : "text-teal-400"
          }`}>
            Student Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleForceSync}
              className={`${
                theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"
              } text-white font-semibold rounded-lg px-4 py-2 transition-all duration-200`}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Sync Notifications
            </Button>
          </div>
          <div className="max-h-[600px] overflow-y-auto space-y-4">
            {notifications.length === 0 ? (
              <div className={`text-center text-sm md:text-base ${
                theme === "light" ? "text-slate-700" : "text-gray-200"
              }`}>
                No notifications available.
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative p-4 rounded-lg ${
                    theme === "light" ? "bg-gradient-to-br from-slate-100 to-gray-200" : "bg-gray-700/50"
                  } shadow-md`}
                >
                  <button
                    onClick={() => handleDeleteNotification(notification.id)}
                    className={`absolute top-2 right-2 bg-transparent ${
                      theme === "light" ? "text-slate-900 hover:text-teal-600" : "text-gray-200 hover:text-teal-300"
                    }`}
                    disabled={deletingId === notification.id}
                  >
                    <X className={`w-5 h-5 ${deletingId === notification.id ? "opacity-50" : ""}`} />
                  </button>
                  <div className="flex items-center gap-3">
                    <Bell className={`w-5 h-5 ${
                      theme === "light" ? "text-teal-600" : "text-teal-300"
                    }`} />
                    <div>
                      <p className={`text-sm md:text-base ${
                        theme === "light" ? "text-slate-900" : "text-gray-200"
                      }`}>{notification.message}</p>
                      <p className={`text-xs ${
                        theme === "light" ? "text-slate-500" : "text-gray-400"
                      } mt-1`}>
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
        <div className="p-6 pt-0">
          <Button
            onClick={handleDeleteAllNotifications}
            className={`w-full ${
              theme === "light" ? "bg-red-600 hover:bg-red-700" : "bg-red-600 hover:bg-red-700"
            } text-white font-semibold rounded-lg px-4 py-2 transition-all duration-200`}
            disabled={notifications.length === 0}
          >
            Delete All Notifications
          </Button>
        </div>
      </Card>
    </div>
  );
}