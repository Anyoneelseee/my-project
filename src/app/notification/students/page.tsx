"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bell, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { subscriptionManager } from "@/lib/subscriptionManager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Notification {
  id: string;
  student_id: string;
  class_id: string;
  activity_id: string;
  message: string;
  created_at: string;
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined"
      ? (localStorage.getItem("theme") as "light" | "dark") || "dark"
      : "dark"
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error("No session found:", sessionError?.message);
          router.push("/login");
          return;
        }

        await subscriptionManager.initialize(session.user.id);
        const unsubscribe = subscriptionManager.subscribe(
          (updatedNotifications) => {
            setNotifications(updatedNotifications);
          }
        );

        setIsLoading(false);
        return () => unsubscribe();
      } catch (error) {
        console.error("Error loading notifications:", error);
        setIsLoading(false);
      }
    };

    initialize();
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

      if (error) throw error;

      subscriptionManager.currentNotifications =
        subscriptionManager.currentNotifications.filter(
          (notif) => notif.id !== notificationId
        );
      subscriptionManager.notifySubscribers();

      toast.success("Notification deleted successfully.");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete notification.");
    } finally {
      setDeletingId(null);
    }
  };

  // ✅ Skeleton Loader
  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${
          theme === "light"
            ? "bg-slate-100"
            : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
        } text-gray-200 p-6 font-sans`}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-64 bg-gray-700/40" />
            <Skeleton className="h-10 w-40 rounded-md bg-gray-700/40" />
          </div>

          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className={`${
                theme === "light"
                  ? "bg-gradient-to-br from-slate-100 to-gray-200"
                  : "bg-gradient-to-br from-gray-800 to-gray-900"
              } border-teal-500/20 rounded-xl shadow-md`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded-full bg-gray-700/40" />
                <div className="flex flex-col gap-2 w-full">
                  <Skeleton className="h-4 w-3/4 bg-gray-700/40" />
                  <Skeleton className="h-3 w-1/4 bg-gray-700/40" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ✅ Actual Page Content
  return (
    <div
      className={`min-h-screen ${
        theme === "light"
          ? "bg-slate-100"
          : "bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900"
      } text-gray-200 p-6 font-sans`}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1
            className={`text-2xl md:text-3xl font-extrabold ${
              theme === "light" ? "text-slate-900" : "text-teal-400"
            }`}
          >
            Student Notifications
          </h1>

          <Button
            onClick={() => router.push("/dashboard/student")}
            className={`${
              theme === "light"
                ? "bg-teal-600 hover:bg-teal-700"
                : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            } text-white font-semibold rounded-lg px-6 py-2 transition-all duration-200`}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card
            className={`${
              theme === "light"
                ? "bg-gradient-to-br from-slate-100 to-gray-200"
                : "bg-gradient-to-br from-gray-800 to-gray-900"
            } border-teal-500/20 rounded-xl`}
          >
            <CardContent className="pt-6 text-center">
              <p
                className={`text-lg ${
                  theme === "light" ? "text-slate-700" : "text-gray-200"
                }`}
              >
                No notifications available.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`relative ${
                  theme === "light"
                    ? "bg-gradient-to-br from-slate-100 to-gray-200"
                    : "bg-gradient-to-br from-gray-800 to-gray-900"
                } border-teal-500/20 rounded-xl shadow-lg`}
              >
                <button
                  onClick={() => handleDeleteNotification(notification.id)}
                  className={`absolute top-2 right-2 bg-transparent ${
                    theme === "light"
                      ? "text-slate-900 hover:text-teal-600"
                      : "text-gray-200 hover:text-teal-300"
                  }`}
                  disabled={deletingId === notification.id}
                >
                  <X
                    className={`w-5 h-5 ${
                      deletingId === notification.id ? "opacity-50" : ""
                    }`}
                  />
                </button>
                <CardContent className="p-4 flex items-center gap-3">
                  <Bell
                    className={`w-5 h-5 ${
                      theme === "light" ? "text-teal-600" : "text-teal-300"
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm md:text-base ${
                        theme === "light" ? "text-slate-900" : "text-gray-200"
                      }`}
                    >
                      {notification.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        theme === "light" ? "text-slate-500" : "text-gray-400"
                      }`}
                    >
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
