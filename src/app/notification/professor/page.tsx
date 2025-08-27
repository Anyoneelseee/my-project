"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X, Loader2 } from "lucide-react";

interface Notification {
  id: string;
  professor_id: string;
  class_id: string;
  message: string;
  created_at: string;
}

export default function ProfessorNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "dark" : "dark"
  );
  const router = useRouter();

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error("No session found:", sessionError?.message);
          router.push("/login");
          return;
        }

        const role = await getUserRole();
        if (!role || role !== "professor") {
          console.error("Unauthorized access: Not a professor");
          router.push("/dashboard/student");
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("id, professor_id, class_id, message, created_at")
          .eq("professor_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching notifications:", error.message);
          setNotifications([]);
        } else {
          setNotifications(data as Notification[]);
        }

        // Set up real-time subscription
        const subscription = supabase
          .channel("notifications")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `professor_id=eq.${session.user.id}`,
            },
            (payload) => {
              const newNotification = payload.new as Notification;
              setNotifications((prev) => [newNotification, ...prev].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ));
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "notifications",
              filter: `professor_id=eq.${session.user.id}`,
            },
            (payload) => {
              setNotifications((prev) => prev.filter((notif) => notif.id !== payload.old.id));
            }
          )
          .subscribe();

        // Clean up subscription on unmount
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Unexpected error:", err);
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) {
        console.error("Error deleting notification:", error.message);
        alert("Failed to delete notification.");
        return;
      }

      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred.");
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${
        theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
      } text-gray-200 p-6 font-['Poppins']`}>
        <div className="max-w-4xl mx-auto flex items-center justify-center h-[200px]">
          <Loader2 className={`w-8 h-8 animate-spin ${
            theme === "light" ? "text-teal-600" : "text-teal-300"
          }`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
    } text-gray-200 p-6 font-['Poppins']`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className={`text-2xl md:text-3xl font-extrabold ${
            theme === "light" ? "text-slate-900" : "text-teal-400"
          }`}>
            Notifications
          </h1>
          <Button
            onClick={() => router.push("/dashboard/professor")}
            className={`${
              theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            } text-white font-semibold rounded-lg px-6 py-2 transition-all duration-200`}
          >
            Back to Dashboard
          </Button>
        </div>
        {notifications.length === 0 ? (
          <Card className={`${
            theme === "light" ? "bg-gradient-to-br from-slate-100 to-gray-200" : "bg-gradient-to-br from-gray-800 to-gray-900"
          } border-teal-500/20 rounded-xl`}>
            <CardContent className="pt-6 text-center">
              <p className={`text-lg ${
                theme === "light" ? "text-slate-700" : "text-gray-200"
              }`}>No notifications available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`relative ${
                  theme === "light" ? "bg-gradient-to-br from-slate-100 to-gray-200" : "bg-gradient-to-br from-gray-800 to-gray-900"
                } border-teal-500/20 rounded-xl shadow-lg`}
              >
                <button
                  onClick={() => handleDeleteNotification(notification.id)}
                  className={`absolute top-2 right-2 bg-transparent ${
                    theme === "light" ? "text-slate-900 hover:text-teal-600" : "text-gray-200 hover:text-teal-300"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
                <CardContent className="p-4 flex items-center gap-3">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
