// components/StudentNavUser.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
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
import { subscriptionManager } from "@/lib/subscriptionManager";

interface Notification {
  id: string;
  student_id: string;
  class_id: string;
  activity_id: string;
  message: string;
  created_at: string;
}

export function StudentNavUser({
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
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  // Save theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Initialize subscription manager (NO session check)
  useEffect(() => {
    const initialize = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      await subscriptionManager.initialize(authUser.id);
      await subscriptionManager.syncNotifications(authUser.id);

      const unsubscribe = subscriptionManager.subscribe((updated) => {
        setNotifications(updated);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED" && session) {
          subscriptionManager.initialize(session.user.id);
        }
      });

      return () => {
        unsubscribe();
        authListener.subscription.unsubscribe();
      };
    };

    initialize();

    return () => {
      if (!user.email) {
        subscriptionManager.cleanup();
      }
    };
  }, [user.email, router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await subscriptionManager.cleanup();
      router.push("/login");
    } catch (error) {
      console.log(error)
      toast.error("Failed to log out.", {
        style: {
          background: theme === "light" ? "#f1f5f9" : "#1f2937",
          color: theme === "light" ? "#0f172a" : "#e5e7eb",
          border: `1px solid ${theme === "light" ? "#14b8a6" : "#2dd4bf"}`,
        },
      });
    }
  };

  const handleProfile = () => router.push("/profiles");
  const handleDeleteNotification = async (id: string) => {
    if (deletingId === id) return;
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from("student_notifications")
        .delete()
        .eq("id", id)
        .eq("student_id", subscriptionManager.currentUserId);

      if (error) throw error;

      subscriptionManager.currentNotifications = subscriptionManager.currentNotifications.filter(n => n.id !== id);
      subscriptionManager.notifySubscribers();
      toast.success("Deleted.");
    }catch (err: unknown) {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    toast.error(code === "42501" ? "Permission denied." : err.message || "Failed.");
  } else {
    toast.error("Failed.");
  }
}
 finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from("student_notifications")
        .delete()
        .eq("student_id", subscriptionManager.currentUserId);

      if (error) throw error;

      subscriptionManager.currentNotifications = [];
      subscriptionManager.notifySubscribers();
      toast.success("All deleted.");
      if (subscriptionManager.currentUserId) {
        await subscriptionManager.forceSyncAfterDelete(subscriptionManager.currentUserId);
      }
    } catch (err: unknown) {
  if (err instanceof Error) {
    toast.error(err.message || "Failed.");
  } else {
    toast.error("Failed.");
  }
}

  };

  return (
    <>
      <SidebarMenu className="bg-transparent">
        <SidebarMenuItem className="bg-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="bg-transparent data-[state=open]:bg-teal-500/20 data-[state=open]:text-teal-400">
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
              className="font-sans w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20"
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
                <DropdownMenuItem onClick={handleProfile} className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400">
                  <User className="mr-2" /> Profile
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setIsNotificationsDialogOpen(true)} className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400">
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
              <DropdownMenuItem onClick={() => setIsLogoutDialogOpen(true)} className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400">
                <LogOut className="mr-2" /> Log out
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
              Are you sure you want to log out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)} className="bg-gray-700/50 text-gray-200 border-gray-600 hover:bg-gray-600">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white">
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl max-w-lg p-6">
          <button onClick={() => setIsNotificationsDialogOpen(false)} className="absolute top-3 right-3 bg-transparent text-gray-200 hover:text-teal-300">
            <X className="w-6 h-6" />
          </button>
          <DialogHeader>
            <DialogTitle className="text-teal-400 text-2xl font-extrabold">Notifications</DialogTitle>
            <DialogDescription className="text-gray-200 mt-2">
              Click the &quot;X&quot; to delete.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-4 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center text-gray-200 text-sm md:text-base">No notifications.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="relative p-4 rounded-lg bg-gray-700/50 shadow-md">
                  <button
                    onClick={() => handleDeleteNotification(n.id)}
                    className="absolute top-2 right-2 bg-transparent text-gray-200 hover:text-teal-300"
                    disabled={deletingId === n.id}
                  >
                    <X className={`w-5 h-5 ${deletingId === n.id ? "opacity-50" : ""}`} />
                  </button>
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-teal-300" />
                    <div>
                      <p className="text-sm md:text-base text-gray-200">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
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
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2"
              disabled={notifications.length === 0}
            >
              Delete All
            </Button>
            <Button asChild className="bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white font-semibold rounded-lg px-4 py-2">
              <Link href="/notification/students">View All</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}