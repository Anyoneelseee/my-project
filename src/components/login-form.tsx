"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react"; // Spinner Icon

interface LoginFormProps extends React.ComponentProps<"form"> {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  handleSubmit: (
    event: React.FormEvent,
    setLoading: (loading: boolean) => void
  ) => Promise<void>; // Ensure handleSubmit is async
  error: string;
}

export default function LoginForm({
  className,
  email,
  setEmail,
  password,
  setPassword,
  handleSubmit,
  error,
  ...props
}: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false); // Loading State

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission behavior
    setIsLoading(true);
    try {
      await handleSubmit(event, setIsLoading); // Ensure the function runs asynchronously
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false); // Reset loading state on failure
    }
  };

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Login to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email below to login to your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="m@example.com" 
            required 
            value={email} 
onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a href="/forgot-password" className="ml-auto text-sm underline-offset-4 hover:underline">
              Forgot your password?
            </a>
          </div>
          <Input 
            id="password" 
            type="password" 
            required 
            value={password} 
onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="animate-spin w-5 h-5 mx-auto" />
          ) : (
            "Login"
          )}
        </Button>
      </div>
    </form>
  );
}
