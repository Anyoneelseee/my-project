import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Notification {
  id: string;
  student_id: string;
  class_id: string;
  activity_id: string;
  message: string;
  created_at: string;
}

export const subscriptionManager = {
  subscription: null as RealtimeChannel | null,
  subscribers: new Set<(notifications: Notification[]) => void>(),
  currentNotifications: [] as Notification[],
  currentUserId: null as string | null,
  lastSync: 0,

  async initialize(userId: string) {
    if (!userId) {
      console.error("No userId provided for subscription initialization");
      toast.error("Failed to initialize notifications: No user ID provided.", {
        style: {
          background: "#1f2937",
          color: "#e5e7eb",
          border: "1px solid #2dd4bf",
        },
      });
      return;
    }

    if (this.currentUserId === userId && this.subscription && Date.now() - this.lastSync < 1 * 60 * 1000) {
      if (process.env.NODE_ENV === "development") {
        console.log("Subscription already initialized for user:", userId);
      }
      return;
    }

    if (this.subscription) {
      await this.cleanup();
    }

    this.currentUserId = userId;
    if (process.env.NODE_ENV === "development") {
      console.log("Initializing subscription for user:", userId);
    }

    // Force initial sync
    await this.syncNotifications(userId);

    this.subscription = supabase
      .channel(`student_notifications:${userId}`) // Revert to original channel name
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "student_notifications",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.log("New notification received:", payload);
          }
          const newNotification = payload.new as Notification;
          if (newNotification.student_id !== userId) {
            console.warn("Received notification for unexpected user:", newNotification.student_id);
            return;
          }
          if (!this.currentNotifications.some((n) => n.id === newNotification.id)) {
            this.currentNotifications = [
              newNotification,
              ...this.currentNotifications,
            ].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            this.notifySubscribers();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "student_notifications",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.log("Notification deleted:", payload);
          }
          const oldId = payload.old?.id;
          if (oldId) {
            this.currentNotifications = this.currentNotifications.filter(
              (notif) => notif.id !== oldId
            );
            this.notifySubscribers();
          }
        }
      )
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Subscription status:", status, err ? `Error: ${err.message}` : "");
        }
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to notifications channel for user:", userId);
          // Force sync after subscription to catch any missed notifications
          this.syncNotifications(userId);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.error("Subscription error or closed:", status, err ? err.message : "");
          toast.error(`Failed to connect to notifications: ${err?.message || status}. Retrying...`, {
            style: {
              background: "#1f2937",
              color: "#e5e7eb",
              border: "1px solid #2dd4bf",
            },
          });
          setTimeout(() => {
            if (this.currentUserId) {
              this.initialize(this.currentUserId);
            }
          }, 5000);
        }
      });
  },

  subscribe(callback: (notifications: Notification[]) => void) {
    this.subscribers.add(callback);
    callback([...this.currentNotifications]);
    return () => this.subscribers.delete(callback);
  },

  notifySubscribers() {
    if (process.env.NODE_ENV === "development") {
      console.log("Notifying subscribers with notifications:", this.currentNotifications.length, this.currentNotifications);
    }
    this.subscribers.forEach((callback) => callback([...this.currentNotifications]));
  },

  async cleanup() {
    if (this.subscription) {
      try {
        await supabase.removeChannel(this.subscription);
        if (process.env.NODE_ENV === "development") {
          console.log("Subscription unsubscribed");
        }
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
      this.subscription = null;
      this.currentNotifications = [];
      this.currentUserId = null;
      this.lastSync = 0;
      this.subscribers.clear();
    }
  },

  async syncNotifications(userId: string) {
    if (!userId) {
      console.error("No userId provided for syncNotifications");
      toast.error("Failed to sync notifications: No user ID provided.", {
        style: {
          background: "#1f2937",
          color: "#e5e7eb",
          border: "1px solid #2dd4bf",
        },
      });
      return;
    }
    const { data, error } = await supabase
      .from("student_notifications")
      .select("id, student_id, class_id, activity_id, message, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error syncing notifications:", error.message, error.details, error.hint);
      toast.error(`Failed to sync notifications: ${error.message}`, {
        style: {
          background: "#1f2937",
          color: "#e5e7eb",
          border: "1px solid #2dd4bf",
        },
      });
      return;
    }

    this.currentNotifications = Array.from(
      new Map(
        (data as Notification[]).map((n) => [n.id, n])
      ).values()
    ).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    this.lastSync = Date.now();
    this.notifySubscribers();
  },

  async forceSyncAfterDelete(userId: string) {
    this.lastSync = 0;
    await this.syncNotifications(userId);
  },
};