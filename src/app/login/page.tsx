/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import LoginForm from "@/components/login-form";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent, setLoading: (loading: boolean) => void) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Login error:", signInError.message);
        // Customize error message for email confirmation
        if (signInError.message === "Email not confirmed") {
          setError("Please confirm your email address before logging in. Check your inbox for the confirmation link.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.session) {
        console.error("No session returned after login");
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // Verify session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("Session verification failed:", sessionError?.message);
        setError("Session verification failed. Please try again.");
        setLoading(false);
        return;
      }

      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Error fetching user:", userError?.message);
        setError("Failed to verify user. Please try again.");
        setLoading(false);
        return;
      }

      // Fetch role
      const role = await getUserRole();
      if (!role) {
        // Since the signup trigger creates the users table row, assume it exists
        // Redirect to choose-role if no role is set
        router.push("/choose-role");
      } else {
        router.push(`/dashboard/${role}`);
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Image
              src="/carmalogo.png"
              alt="Logo"
              width={24}
              height={24}
              className="rounded-md"
              priority
            />
            Carma
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm 
              email={email} 
              setEmail={setEmail} 
              password={password} 
              setPassword={setPassword} 
              handleSubmit={handleSubmit} 
              error={error} 
            />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src="/carmalogo.png"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          width={300}
          height={300}
          priority
        />
      </div>
    </div>
  );
}