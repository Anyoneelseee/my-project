"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Trash2, AlertCircle, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface User {
  id: string;
  role: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "dark" : "dark"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Fetch user
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          toast.error("Authentication failed. Please log in.");
          router.push("/login");
          return;
        }

        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .rpc("get_user_profile", { user_id_input: session.user.id });
        if (userError || !userData || userData.length === 0) {
          toast.error(`Failed to fetch user profile: ${userError?.message || "No user data found"}`);
          router.push("/login");
          return;
        }
        setUser(userData[0]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [router]);

  // Handle password update
  const handlePasswordUpdate = async () => {
    if (!user) return;
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
      if (error) throw new Error(`Failed to update password: ${error.message}`);
      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordError(null);
      toast.success("Password updated successfully.");
    } catch (err) {
      console.error("Error updating password:", err);
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);
      if (error) throw new Error(`Failed to delete account: ${error.message}`);
      await supabase.auth.signOut();
      toast.success("Account deleted successfully.");
      router.push("/login");
    } catch (err) {
      console.error("Error deleting account:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete account.");
    }
  };

  // Dynamic dashboard navigation
  const handleBackToDashboard = () => {
    if (user?.role === "professor") {
      router.push("/dashboard/professor");
    } else if (user?.role === "student") {
      router.push("/dashboard/student");
    } else {
      router.push("/login");
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} flex items-center justify-center p-6`}>
        <Skeleton className="w-80 h-10 rounded-lg bg-slate-700" />
      </div>
    );
  }

  if (!user) {
    return null; // Errors are handled via toasts
  }

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} font-['Poppins'] p-6 sm:p-8`}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-opacity-90 backdrop-blur-lg mb-8">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              onClick={handleBackToDashboard}
              className={`${theme === "light" ? "text-teal-600 hover:bg-teal-100" : "text-teal-400 hover:bg-teal-500/20"} rounded-full px-4 py-2 transition-transform hover:scale-105 font-medium text-sm`}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              onClick={toggleTheme}
              className={`${theme === "light" ? "bg-slate-200 hover:bg-slate-300 text-slate-800" : "bg-slate-700 hover:bg-slate-600 text-slate-100"} rounded-full p-2 transition-transform hover:scale-105`}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Settings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <Card className={`${theme === "light" ? "bg-white" : "bg-slate-800/90"} shadow-lg border border-teal-500/20 rounded-2xl overflow-hidden`}>
          <CardHeader className="p-8 bg-gradient-to-r from-teal-500/10 to-transparent">
            <CardTitle className={`${theme === "light" ? "text-slate-900" : "text-slate-100"} text-3xl font-bold tracking-tight font-['Poppins']`}>
              Settings
            </CardTitle>
            <CardDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium`}>
              Manage your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid gap-8">
              {/* Password Update */}
              <div>
                {passwordError && (
                  <Alert variant="destructive" className="mb-4 bg-red-500/20 border-red-500/30 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
                <Label className={`${theme === "light" ? "text-slate-700" : "text-slate-100"} text-sm font-semibold`}>Change Password</Label>
                <div className="grid gap-4 mt-2">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.current}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className={`${theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-600 text-slate-100"} rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400`}
                    aria-label="Current password"
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    value={passwordForm.new}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className={`${theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-600 text-slate-100"} rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400`}
                    aria-label="New password"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className={`${theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-600 text-slate-100"} rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400`}
                    aria-label="Confirm new password"
                  />
                  <Button
                    onClick={handlePasswordUpdate}
                    className={`${theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"} text-white rounded-full px-4 py-1 text-sm font-medium transition-transform hover:scale-105 w-fit`}
                    aria-label="Save password"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Password
                  </Button>
                </div>
              </div>
              {/* Account Deletion */}
              <div>
                <Label className={`${theme === "light" ? "text-slate-700" : "text-slate-100"} text-sm font-semibold`}>Delete Account</Label>
                <p className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-sm mb-2`}>Permanently delete your account and all associated data</p>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105"
                  aria-label="Delete account"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className={`${theme === "light" ? "bg-white" : "bg-slate-800/90"} border-teal-500/20 rounded-2xl max-w-lg`}>
          <DialogHeader className="p-6">
            <DialogTitle className={`${theme === "light" ? "text-slate-900" : "text-teal-400"} text-xl font-bold font-['Poppins']`}>Delete Account</DialogTitle>
            <DialogDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium`}>
              Are you sure you want to delete your account? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className={`${theme === "light" ? "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200" : "bg-slate-700/50 text-slate-100 border-slate-600 hover:bg-slate-600"} rounded-full px-6 py-2 text-sm font-medium`}
              aria-label="Cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105"
              aria-label="Confirm delete account"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
