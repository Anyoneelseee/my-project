"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Settings2,
  User,
  X,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { RealtimeChannel } from "@supabase/supabase-js";

interface Notification {
  id: string;
  professor_id: string;
  class_id: string;
  message: string;
  created_at: string;
}

// Singleton to manage global subscription
const subscriptionManager = {
  subscription: null as RealtimeChannel | null,
  subscribers: new Set<(notifications: Notification[]) => void>(),
  currentNotifications: [] as Notification[],
  currentUserId: null as string | null,
  isRetrying: false,

  async initialize(userId: string) {
    if (this.currentUserId === userId && this.subscription) {
      console.log("Subscription already initialized for user:", userId);
      return;
    }

    if (this.subscription && this.currentUserId !== userId) {
      await this.cleanup();
    }

    this.currentUserId = userId;
    console.log("Initializing subscription for user:", userId);

    // Fetch initial notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("id, professor_id, class_id, message, created_at")
      .eq("professor_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching initial notifications:", error.message);
      this.currentNotifications = [];
    } else {
      this.currentNotifications = data as Notification[];
    }
    this.notifySubscribers();

    this.subscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `professor_id=eq.${userId}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          const newNotification = payload.new as Notification;
          this.currentNotifications = [
            newNotification,
            ...this.currentNotifications,
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          this.notifySubscribers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `professor_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Notification deleted:", payload);
          this.currentNotifications = this.currentNotifications.filter(
            (notif) => notif.id !== payload.old.id
          );
          this.notifySubscribers();
        }
      )
      .subscribe((status, err) => {
        console.log("Global subscription status:", status, err ? `Error: ${err.message}` : "");
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to notifications channel");
          this.isRetrying = false;
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.error("Global subscription error or closed:", status, err ? err.message : "");
          this.handleRetry(userId);
        }
      });
  },

  async handleRetry(userId: string, retryCount = 0, maxRetries = 10) {
    if (this.isRetrying) {
      console.log("Retry already in progress, skipping...");
      return;
    }
    if (retryCount >= maxRetries) {
      console.error("Max retries reached for global subscription");
      toast.error("Failed to reconnect to notifications. Please refresh the page.", {
        style: {
          background: "#1f2937",
          color: "#e5e7eb",
          border: "1px solid #2dd4bf",
        },
      });
      this.isRetrying = false;
      return;
    }
    this.isRetrying = true;
    console.log(`Retrying global subscription (${retryCount + 1}/${maxRetries})...`);
    if (this.subscription) {
      try {
        await this.subscription.unsubscribe();
        console.log("Unsubscribed successfully");
      } catch (error) {
        console.error("Error during unsubscribe:", error);
      }
    }
    this.subscription = null;
    // Exponential backoff: 6s, 12s, 18s, ..., 60s
    setTimeout(() => {
      this.initialize(userId);
      this.isRetrying = false;
    }, 6000 * (retryCount + 1));
  },

  subscribe(callback: (notifications: Notification[]) => void) {
    this.subscribers.add(callback);
    callback(this.currentNotifications);
    return () => this.subscribers.delete(callback);
  },

  notifySubscribers() {
    console.log("Notifying subscribers with notifications:", this.currentNotifications.length);
    this.subscribers.forEach((callback) => callback(this.currentNotifications));
  },

  async cleanup() {
    if (this.subscription) {
      try {
        await this.subscription.unsubscribe();
        console.log("Global subscription unsubscribed");
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
      this.subscription = null;
      this.currentNotifications = [];
      this.currentUserId = null;
      this.isRetrying = false;
      this.subscribers.clear();
    }
  },
};

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "dark" : "dark"
  );

  // Log component mount for debugging
  useEffect(() => {
    console.log("NavUser mounted for user:", user.email);
    return () => {
      console.log("NavUser unmounted for user:", user.email);
    };
  }, [user.email]);

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

      // Initialize subscription
      await subscriptionManager.initialize(session.user.id);

      // Subscribe to updates
      const unsubscribe = subscriptionManager.subscribe((updatedNotifications) => {
        console.log("Updating notifications state:", updatedNotifications.length);
        setNotifications(updatedNotifications);
      });

      return () => {
        unsubscribe();
      };
    };

    initialize();

    return () => {
      // Cleanup only on logout or user change
    };
  }, [user.email, router]); // Added router to dependencies

  useEffect(() => {
    // Cleanup on logout
    return () => {
      if (!user.email) {
        subscriptionManager.cleanup();
      }
    };
  }, []); // Removed dependencies for cleanup effect

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    subscriptionManager.cleanup();
    router.push("/login");
  };

  const handleProfile = () => {
    router.push("/profiles");
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) {
        console.error("Error deleting notification:", error.message);
        toast.error("Failed to delete notification.", {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
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
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("No session found:", sessionError?.message);
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("professor_id", session.user.id);

      if (error) {
        console.error("Error deleting all notifications:", error.message);
        toast.error("Failed to delete all notifications.", {
          style: {
            background: theme === "light" ? "#f1f5f9" : "#1f2937",
            color: theme === "light" ? "#0f172a" : "#e5e7eb",
            border: theme === "light" ? "1px solid #14b8a6" : "1px solid #2dd4bf",
          },
        });
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

  return (
    <>
      <SidebarMenu className="bg-transparent">
        <SidebarMenuItem className="bg-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="bg-transparent data-[state=open]:bg-teal-500/20 data-[state=open]:text-teal-400"
              >
                <Avatar className="h-8 w-8 rounded-lg bg-gray-700">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg text-gray-200">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-gray-200">{user.name}</span>
                  <span className="truncate text-xs text-gray-400">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-gray-400" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg bg-gray-700">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg text-gray-200">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-gray-200">{user.name}</span>
                    <span className="truncate text-xs text-gray-400">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={handleProfile}
                  className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                >
                  <User className="mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-600/30" />
                <DropdownMenuItem
                  onClick={handleSettings}
                  className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                >
                  <Settings2 className="mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setIsNotificationsDialogOpen(true)}
                  className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                >
                  <div className="relative flex items-center">
                    <Bell className="mr-2" />
                    <span>Notifications</span>
                    {notifications.length > 0 && (
<span className="absolute left-[7px] top-[-5px] bg-teal-500 text-white text-xs font-bold rounded-full w-3 h-3 flex items-center justify-center">
  {notifications.length}
</span>
                    )}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuItem
                onClick={() => setIsLogoutDialogOpen(true)}
                className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
              >
                <LogOut className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Logout Dialog */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-400">Confirm Logout</DialogTitle>
            <DialogDescription className="text-gray-200">
              Are you sure you want to log out? You will need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLogoutDialogOpen(false)}
              className="bg-gray-700/50 text-gray-200 border-gray-600 hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl max-w-lg p-6">
          <button
            onClick={() => setIsNotificationsDialogOpen(false)}
            className={`absolute top-3 right-3 bg-transparent ${
              theme === "light" ? "text-slate-900 hover:text-teal-600" : "text-gray-200 hover:text-teal-300"
            }`}
          >
            <X className="w-6 h-6" />
          </button>
          <DialogHeader>
            <DialogTitle className="text-teal-400 text-2xl font-extrabold">Notifications</DialogTitle>
            <DialogDescription className="text-gray-200 mt-2">
              View your recent notifications. Click the &ldquo;X&quot; to delete.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-4 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center text-gray-200 text-sm md:text-base">
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
                  >
                    <X className="w-5 h-5" />
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
          <DialogFooter className="mt-4">
            <Button
              onClick={handleDeleteAllNotifications}
              className={`${
                theme === "light" ? "bg-red-600 hover:bg-red-700" : "bg-red-600 hover:bg-red-700"
              } text-white font-semibold rounded-lg px-4 py-2 transition-all duration-200`}
            >
              Delete All
            </Button>
            <Button
              asChild
              className={`${
                theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              } text-white font-semibold rounded-lg px-4 py-2 transition-all duration-200`}
            >
              <Link href="/notification/professor">View All</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
