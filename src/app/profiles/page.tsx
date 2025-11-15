"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Edit,
  X,
  Sun,
  Moon,
  Save,
  Trash2,
  AlertCircle,
  Loader2, // ← NEW IMPORT
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDeleting, setIsDeleting] = useState(false); // ← NEW STATE

  // Load theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  // Save theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push("/login");
          return;
        }

        const { data: userData, error: userError } = await supabase
          .rpc("get_user_profile", { user_id_input: authUser.id });

        if (userError || !userData?.length) {
          throw new Error("Unable to fetch user profile.");
        }

        const userProfile = userData[0];
        setUser(userProfile);
        setEditForm({ first_name: userProfile.first_name, last_name: userProfile.last_name });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ first_name: editForm.first_name, last_name: editForm.last_name })
        .eq("id", user.id);

      if (error) throw new Error(`Failed to update profile: ${error.message}`);
      setUser({ ...user, ...editForm });
      setIsEditDialogOpen(false);
      toast.success("Profile updated successfully.");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    }
  };

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

  // ← REPLACED: Now uses delete_user_account() function
  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);

    try {
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authUser) {
        toast.error("You are not logged in.");
        setIsDeleting(false);
        return;
      }

      const { error } = await supabase.rpc("delete_user_account", {
        p_user_id: authUser.id,
      });
        //console.log("RPC ERROR:", error); // ← THIS IS THE KEY
      if (error) throw error;

      await supabase.auth.signOut();
      toast.success("Your account and all data have been permanently deleted.");
      router.push("/login");
    }catch (err: unknown) {
  console.error("Account deletion error:", err);

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Failed to delete account.";

  toast.error(message);
}
finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  const handleBackToDashboard = () => {
    if (user?.role === "professor") router.push("/dashboard/professor");
    else if (user?.role === "student") router.push("/dashboard/student");
    else router.push("/login");
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen font-sans ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} flex items-center justify-center p-6`}>
        <Skeleton className="w-80 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen font-sans ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} flex items-center justify-center p-6`}>
        <div className="text-xl font-semibold text-red-500 flex items-center gap-2">
          <X className="w-6 h-6" />
          {error}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen font-sans ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} flex items-center justify-center p-6`}>
        <div className="text-xl font-semibold text-red-500 flex items-center gap-2">
          <X className="w-6 h-6" />
          User data not found
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans ${theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"} p-6 sm:p-8 transition-colors duration-300`}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-opacity-90 backdrop-blur-lg mb-8">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Button
              variant="ghost"
              onClick={handleBackToDashboard}
              className={`${theme === "light" ? "text-teal-600 hover:bg-teal-100" : "text-teal-400"} rounded-full px-4 py-2 transition-transform hover:scale-105 font-medium text-sm`}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Button
              onClick={toggleTheme}
              className={`${theme === "light" ? "bg-slate-200 hover:bg-slate-300 text-slate-800" : "bg-slate-700 hover:bg-slate-600 text-slate-100"} rounded-full p-2 transition-transform hover:scale-105`}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </motion.div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className={`${theme === "light" ? "bg-white" : "bg-slate-800/90"} shadow-lg border border-teal-500/20 rounded-2xl overflow-hidden`}>
            <CardHeader className="p-8 bg-gradient-to-r from-teal-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 rounded-xl bg-slate-700 ring-2 ring-teal-400/50">
                    <AvatarImage src={user.avatar_url || ""} alt={`${user.first_name} ${user.last_name}`} />
                    <AvatarFallback className="rounded-xl text-slate-200 text-3xl font-semibold">
                      {user.first_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className={`${theme === "light" ? "text-slate-900" : "text-slate-100"} text-3xl font-bold tracking-tight`}>
                      {user.first_name} {user.last_name}
                    </CardTitle>
                    <CardDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium mt-1`}>
                      {user.email} | {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={() => setIsEditDialogOpen(true)}
                  className={`${theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"} text-white rounded-full px-6 py-2 transition-transform hover:scale-105 font-medium text-sm`}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-8">
              <div className="grid gap-6">
                <div className="flex items-center gap-4">
                  <p className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-sm font-semibold w-24`}>Full Name</p>
                  <p className={`${theme === "light" ? "text-slate-900" : "text-slate-100"} text-lg font-medium`}>{user.first_name} {user.last_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-sm font-semibold w-24`}>Email</p>
                  <p className={`${theme === "light" ? "text-slate-900" : "text-slate-100"} text-lg font-medium`}>{user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-sm font-semibold w-24`}>Role</p>
                  <p className={`${theme === "light" ? "text-slate-900" : "text-slate-100"} text-lg font-medium`}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Settings Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className={`${theme === "light" ? "bg-white" : "bg-slate-800/90"} shadow-lg border border-teal-500/20 rounded-2xl overflow-hidden`}>
            <CardHeader className="p-8 bg-gradient-to-r from-teal-500/10 to-transparent">
              <CardDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium`}>
                Manage your account preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid gap-8">
                {/* Change Password */}
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
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      value={passwordForm.new}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      className={`${theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-600 text-slate-100"} rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400`}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordForm.confirm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      className={`${theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-600 text-slate-100"} rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400`}
                    />
                    <Button
                      onClick={handlePasswordUpdate}
                      className={`${theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"} text-white rounded-full px-4 py-1 text-sm font-medium transition-transform hover:scale-105 w-fit`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Password
                    </Button>
                  </div>
                </div>

                {/* Delete Account */}
                <div>
                  <Label className={`${theme === "light" ? "text-slate-700" : "text-slate-100"} text-sm font-semibold`}>Delete Account</Label>
                  <p className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-sm mb-2`}>Permanently delete your account and all associated data</p>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {isEditDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
            <DialogContent className={`${theme === "light" ? "bg-white/90" : "bg-slate-800/90"} border-teal-500/20 rounded-2xl max-w-lg font-sans shadow-xl backdrop-blur-xl z-50`}>
              <DialogHeader className="p-6">
                <DialogTitle className={`${theme === "light" ? "text-slate-900" : "text-teal-400"} text-xl font-bold`}>Edit Profile</DialogTitle>
                <DialogDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium`}>
                  Update your profile information below.
                </DialogDescription>
              </DialogHeader>
              <div className="p-6 pt-0 grid gap-6">
                <div className="grid gap-2">
                  <label className={`${theme === "light" ? "text-slate-700" : "text-slate-100"} text-sm font-semibold`} htmlFor="first-name">First Name</label>
                  <Input
                    id="first-name"
                    value={editForm.first_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="bg-slate-800 border-slate-600 text-slate-100 rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div className="grid gap-2">
                  <label className={`${theme === "light" ? "text-slate-700" : "text-slate-100"} text-sm font-semibold`} htmlFor="last-name">Last Name</label>
                  <Input
                    id="last-name"
                    value={editForm.last_name}
                    onChange={(e:React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="bg-slate-800 border-slate-600 text-slate-100 rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
              <DialogFooter className="p-6 pt-0 flex justify-end gap-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className={`${theme === "light" ? "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200" : "bg-slate-700/50 text-slate-100 border-slate-600 hover:bg-slate-600"} rounded-full px-6 py-2 text-sm font-medium`}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} className={`${theme === "light" ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-500 hover:bg-teal-600"} text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105`}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </div>
        )}
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className={`${theme === "light" ? "bg-white" : "bg-slate-800/90"} border-teal-500/20 rounded-2xl max-w-lg`}>
          <DialogHeader className="p-6">
            <DialogTitle className={`${theme === "light" ? "text-slate-900" : "text-teal-400"} text-xl font-bold font-sans`}>Delete Account</DialogTitle>
            <DialogDescription className={`${theme === "light" ? "text-slate-600" : "text-slate-400"} text-base font-medium`}>
              Are you sure you want to delete your account? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0 flex justify-end gap-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className={`${theme === "light" ? "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200" : "bg-slate-700/50 text-slate-100 border-slate-600 hover:bg-slate-600"} rounded-full px-6 py-2 text-sm font-medium`}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105 flex items-center"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}