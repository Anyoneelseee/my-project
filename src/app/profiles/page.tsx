// src/app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Edit,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
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
  const [isDeleting, setIsDeleting] = useState(false);

  // === FETCH PROFILE ===
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

  // === SAVE PROFILE ===
  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ first_name: editForm.first_name, last_name: editForm.last_name })
        .eq("id", user.id);

      if (error) throw error;
      setUser({ ...user, ...editForm });
      setIsEditDialogOpen(false);
      toast.success("Profile updated successfully.", {
        icon: <Save className="w-5 h-5 text-emerald-400" />,
        className: "border border-emerald-500/30",
        style: {
          background: "rgba(16, 185, 129, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#ecfdf5",
          maxWidth: "320px",
        },
      });
    } catch {
      toast.error("Failed to update profile.", {
        icon: <AlertCircle className="w-5 h-5 text-red-400" />,
        className: "border border-red-500/30",
        style: {
          background: "rgba(239, 68, 68, 0.15)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#fee2e2",
          maxWidth: "320px",
        },
      });
    }
  };

  // === UPDATE PASSWORD ===
  const handlePasswordUpdate = async () => {
    if (!user) return;
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
      if (error) throw error;
      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordError(null);
      toast.success("Password updated successfully.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    }
  };

  // === DELETE ACCOUNT ===
  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("delete_user_account", {
        p_user_id: authUser.id,
      });
      if (error) throw error;

      await supabase.auth.signOut();
      toast.success("Account deleted permanently.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleBackToDashboard = () => {
    if (user?.role === "professor") router.push("/dashboard/professor");
    else if (user?.role === "student") router.push("/dashboard/student");
    else router.push("/login");
  };

  // === LOADING SKELETON ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-6 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-40 rounded-full bg-gray-800" />
          </div>

          {/* Profile Card Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <Skeleton className="h-20 w-20 rounded-xl bg-gray-800" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-8 w-64 rounded-lg bg-gray-800" />
                <Skeleton className="h-5 w-48 rounded-lg bg-gray-800" />
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20 rounded bg-gray-800" />
                  <Skeleton className="h-6 w-48 rounded bg-gray-800" />
                </div>
              ))}
            </div>
          </div>

          {/* Settings Card Skeleton */}
          <div className="space-y-6">
            <Skeleton className="h-6 w-48 rounded bg-gray-800" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl bg-gray-800" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "User not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-6 sm:p-8">
      {/* === HEADER === */}
      <header className="max-w-7xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <Button
            variant="ghost"
            onClick={handleBackToDashboard}
            className="text-teal-400 hover:bg-teal-500/10 rounded-full px-5 py-2.5 font-medium transition-all hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </Button>
        </motion.div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* === PROFILE CARD === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-gray-800/95 via-slate-900/90 to-gray-800/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <CardHeader className="p-8 bg-gradient-to-r from-teal-600/10 via-transparent to-purple-600/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24 rounded-2xl ring-4 ring-teal-500/30 shadow-xl">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-3xl font-bold rounded-2xl">
                      {user.first_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-3xl font-extrabold text-white drop-shadow-md">
                      {user.first_name} {user.last_name}
                    </CardTitle>
                    <CardDescription className="text-teal-300 font-medium text-lg mt-1">
                      {user.email} • {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={() => setIsEditDialogOpen(true)}
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-full px-6 py-3 font-bold shadow-lg shadow-teal-500/30 transition-all hover:scale-105"
                >
                  <Edit className="w-5 h-5 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-6">
              {[
                { label: "Full Name", value: `${user.first_name} ${user.last_name}` },
                { label: "Email", value: user.email },
                { label: "Role", value: user.role.charAt(0).toUpperCase() + user.role.slice(1) },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-teal-400 font-semibold text-sm w-24">{item.label}</span>
                  <span className="text-white font-medium text-lg">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* === SETTINGS CARD === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-gray-800/95 via-slate-900/90 to-gray-800/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl">
            <CardHeader className="p-8 bg-gradient-to-r from-teal-600/10 via-transparent to-purple-600/10">
              <CardTitle className="text-xl font-bold text-teal-300">Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Change Password */}
              <div className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
                <Label className="text-teal-300 font-semibold">Change Password</Label>
                <div className="grid gap-3">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.current}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="bg-gray-800/50 border-teal-500/30 text-white placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-teal-400"
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    value={passwordForm.new}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="bg-gray-800/50 border-teal-500/30 text-white placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-teal-400"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="bg-gray-800/50 border-teal-500/30 text-white placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-teal-400"
                  />
                  <Button
                    onClick={handlePasswordUpdate}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-full px-6 py-2.5 font-bold shadow-lg shadow-teal-500/30 transition-all hover:scale-105 w-fit"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Password
                  </Button>
                </div>
              </div>

              {/* Delete Account */}
              <div className="pt-6 border-t border-teal-500/20">
                <Label className="text-teal-300 font-semibold">Danger Zone</Label>
                <p className="text-gray-400 text-sm mt-1 mb-4">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full px-6 py-2.5 font-bold shadow-lg shadow-red-500/30 transition-all hover:scale-105"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* === EDIT DIALOG === */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800/95 via-slate-900/90 to-gray-800/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-teal-300">Edit Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your name below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="first-name" className="text-teal-300 font-semibold">First Name</Label>
              <Input
                id="first-name"
                value={editForm.first_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="bg-gray-800/50 border-teal-500/30 text-white rounded-xl focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last-name" className="text-teal-300 font-semibold">Last Name</Label>
              <Input
                id="last-name"
                value={editForm.last_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="bg-gray-800/50 border-teal-500/30 text-white rounded-xl focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
          <Button
  onClick={() => setIsEditDialogOpen(false)}
  className="bg-gray-900/80 border border-gray-700 text-gray-300 
             hover:bg-gray-800 rounded-full backdrop-blur-sm"
>
  Cancel
</Button>

            <Button
              onClick={handleSaveProfile}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-full font-bold"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE DIALOG === */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800/95 via-red-950/90 to-gray-800/95 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-400 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              Delete Data?
            </DialogTitle>
            <DialogDescription className="text-red-200 text-xl">
              This will <strong>permanently delete</strong> your all data. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6">
          <Button
  onClick={() => setIsDeleteDialogOpen(false)}
  className="bg-gray-900/80 border border-gray-700 text-gray-300 
             hover:bg-gray-800 rounded-full backdrop-blur-sm"
  disabled={isDeleting}
>
  Cancel
</Button>

            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full font-bold flex items-center"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}