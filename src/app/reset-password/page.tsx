"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react"; // ✅ Import Spinner Icon
import Link from "next/link";

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // ✅ Added loading state

  useEffect(() => {
    const token = searchParams.get("access_token");
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: "" });
    }
  }, [searchParams]);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true); // ✅ Start loading

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(false); // ✅ Stop loading

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => router.push("/"), 3000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {message && <p className="text-green-500">{message}</p>}
          {error && <p className="text-red-500">{error}</p>}
          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Update Password"}
            </Button>
          </form>
          <p className="text-center mt-2 text-sm">
            <Link href="/login" className="text-blue-600">Back to Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
