"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Edit, Save, X, Sun, Moon } from "lucide-react";
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
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "" });
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.push("/login");
          return;
        }

        const { data: userData, error: userError } = await supabase
          .rpc("get_user_profile", { user_id_input: session.user.id });

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
      setUser({ ...user, first_name: editForm.first_name, last_name: editForm.last_name });
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    }
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleBackToDashboard = () => {
    if (user?.role === "professor") router.push("/dashboard/professor");
    else if (user?.role === "student") router.push("/dashboard/student");
    else router.push("/login");
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-screen font-sans ${
          theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"
        } flex items-center justify-center p-6`}
      >
        <Skeleton className="w-80 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen font-sans ${
          theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"
        } flex items-center justify-center p-6`}
      >
        <div className="text-xl font-semibold text-red-500 flex items-center gap-2">
          <X className="w-6 h-6" />
          {error}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`min-h-screen font-sans ${
          theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"
        } flex items-center justify-center p-6`}
      >
        <div className="text-xl font-semibold text-red-500 flex items-center gap-2">
          <X className="w-6 h-6" />
          User data not found
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans ${
        theme === "light" ? "bg-slate-100" : "bg-gradient-to-br from-slate-900 to-gray-800"
      } p-6 sm:p-8 transition-colors duration-300`}
    >
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
              className={`${
                theme === "light"
                  ? "text-teal-600 hover:bg-teal-100"
                  : "text-teal-400"
              } rounded-full px-4 py-2 transition-transform hover:scale-105 font-medium text-sm`}
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
              className={`${
                theme === "light"
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-100"
              } rounded-full p-2 transition-transform hover:scale-105`}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <Card
          className={`${
            theme === "light" ? "bg-white" : "bg-slate-800/90"
          } shadow-lg border border-teal-500/20 rounded-2xl overflow-hidden`}
        >
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
                  <CardTitle
                    className={`${
                      theme === "light" ? "text-slate-900" : "text-slate-100"
                    } text-3xl font-bold tracking-tight`}
                  >
                    {user.first_name} {user.last_name}
                  </CardTitle>
                  <CardDescription
                    className={`${
                      theme === "light" ? "text-slate-600" : "text-slate-400"
                    } text-base font-medium mt-1`}
                  >
                    {user.email} | {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={() => setIsEditDialogOpen(true)}
                className={`${
                  theme === "light"
                    ? "bg-teal-600 hover:bg-teal-700"
                    : "bg-teal-500 hover:bg-teal-600"
                } text-white rounded-full px-6 py-2 transition-transform hover:scale-105 font-medium text-sm`}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <div className="grid gap-6">
              <div className="flex items-center gap-4">
                <p
                  className={`${
                    theme === "light" ? "text-slate-600" : "text-slate-400"
                  } text-sm font-semibold w-24`}
                >
                  Full Name
                </p>
                <p
                  className={`${
                    theme === "light" ? "text-slate-900" : "text-slate-100"
                  } text-lg font-medium`}
                >
                  {user.first_name} {user.last_name}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <p
                  className={`${
                    theme === "light" ? "text-slate-600" : "text-slate-400"
                  } text-sm font-semibold w-24`}
                >
                  Email
                </p>
                <p
                  className={`${
                    theme === "light" ? "text-slate-900" : "text-slate-100"
                  } text-lg font-medium`}
                >
                  {user.email}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <p
                  className={`${
                    theme === "light" ? "text-slate-600" : "text-slate-400"
                  } text-sm font-semibold w-24`}
                >
                  Role
                </p>
                <p
                  className={`${
                    theme === "light" ? "text-slate-900" : "text-slate-100"
                  } text-lg font-medium`}
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className={`${
            theme === "light" ? "bg-white" : "bg-slate-800/90"
          } border-teal-500/20 rounded-2xl max-w-lg font-sans`}
        >
          <DialogHeader className="p-6">
            <DialogTitle
              className={`${
                theme === "light" ? "text-slate-900" : "text-teal-400"
              } text-xl font-bold`}
            >
              Edit Profile
            </DialogTitle>
            <DialogDescription
              className={`${
                theme === "light" ? "text-slate-600" : "text-slate-400"
              } text-base font-medium`}
            >
              Update your profile information below.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-0 grid gap-6">
            <div className="grid gap-2">
              <label
                className={`${
                  theme === "light" ? "text-slate-700" : "text-slate-100"
                } text-sm font-semibold`}
                htmlFor="first-name"
              >
                First Name
              </label>
            <Input
  id="first-name"
  value={editForm.first_name}
  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm({ ...editForm, first_name: e.target.value })
  }
  className="bg-slate-800 border-slate-600 text-slate-100 rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400"
/>
            </div>
            <div className="grid gap-2">
              <label
                className={`${
                  theme === "light" ? "text-slate-700" : "text-slate-100"
                } text-sm font-semibold`}
                htmlFor="last-name"
              >
                Last Name
              </label>
            <Input
  id="last-name"
  value={editForm.last_name}
  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm({ ...editForm, last_name: e.target.value })
  }
  className="bg-slate-800 border-slate-600 text-slate-100 rounded-xl h-10 text-base font-medium focus:ring-2 focus:ring-teal-400"
/>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className={`${
                theme === "light"
                  ? "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200"
                  : "bg-slate-700/50 text-slate-100 border-slate-600 hover:bg-slate-600"
              } rounded-full px-6 py-2 text-sm font-medium`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              className={`${
                theme === "light"
                  ? "bg-teal-600 hover:bg-teal-700"
                  : "bg-teal-500 hover:bg-teal-600"
              } text-white rounded-full px-6 py-2 text-sm font-medium transition-transform hover:scale-105`}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
