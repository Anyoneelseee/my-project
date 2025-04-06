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
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      console.log("Login successful!");

      const role = await getUserRole();

      if (!role) {
        const { data: authData } = await supabase.auth.getUser();

        if (authData?.user) {
          const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("id", authData.user.id)
            .single();

          if (!existingUser) {
            await supabase.from("users").insert([{ id: authData.user.id, role: null }]);
          }
        }
        router.push("/choose-role");
      } else {
        router.push(`/dashboard/${role}`);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
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
        />
      </div>
    </div>
  );
}
