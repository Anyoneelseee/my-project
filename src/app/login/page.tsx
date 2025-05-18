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
        setError(signInError.message);
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
        // Check if user exists in users table
        const { data: existingUser, error: userError } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (userError && userError.code !== "PGRST116") { // PGRST116: no rows found
          console.error("Error fetching user profile:", userError.message, userError.details, userError.hint);
          setError("Failed to verify user profile. Please try again.");
          setLoading(false);
          return;
        }

        if (!existingUser) {
          // Insert new user profile
          const { error: insertError } = await supabase
            .from("users")
            .insert([{ id: user.id, role: null }]);
          if (insertError) {
            console.error("Error inserting user profile:", insertError.message, insertError.details, insertError.hint);
            setError("Failed to create user profile. Please try again.");
            setLoading(false);
            return;
          }
        }

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