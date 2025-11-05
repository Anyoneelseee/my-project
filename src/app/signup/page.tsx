"use client";

import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

// Particle interface
interface Particle {
  draw(): void;
  update(): void;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
}

// Particle Background Component
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particlesArray: Particle[] = [];
    const numberOfParticles = 100;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    class ParticleClass implements Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
      }

      update() {
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 100;
        if (distance < maxDistance) {
          const force = (maxDistance - distance) / maxDistance;
          this.x += (dx / distance) * force * 3;
          this.y += (dy / distance) * force * 3;
        }

        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      }

      draw() {
        if (!ctx) return;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, "#40C4FF");
        gradient.addColorStop(1, "#00ADB5");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < numberOfParticles; i++) {
      particlesArray.push(new ParticleClass());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesArray.forEach((p) => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />;
};

export default function SignupFormDemo() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"student" | "professor" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!firstName || !lastName || !email || !password || !confirmPassword || !role) {
      setError("All fields are required, including role selection.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, role },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Signup failed. Please try again.");
      setLoading(false);
      return;
    }

    setShowDialog(true);
    setLoading(false);
  };

  return (
    <div className="min-h-svh relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white font-sans">
      <ParticleBackground />

      <main className="flex items-center justify-center min-h-screen z-10 relative px-4 sm:px-6">
        <div className="bg-gray-800/90 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-xl shadow-xl border border-teal-500/20 w-full max-w-lg">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 font-bold text-2xl text-teal-400 mb-6">
            <Image src="/carmalogo.png" alt="Carma Logo" width={40} height={40} className="rounded-full" />
            CARMA
          </Link>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-teal-400 mb-2">
            Create Account
          </h2>
          <p className="text-gray-400 text-center mb-8 text-sm sm:text-base">
            Join CARMA and start your journey with advanced AI tools.
          </p>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <LabelInputContainer>
              <Label htmlFor="firstname">First Name</Label>
              <Input
                id="firstname"
                placeholder="Tyler"
                value={firstName}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setFirstName(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <Label htmlFor="lastname">Last Name</Label>
              <Input
                id="lastname"
                placeholder="Durden"
                value={lastName}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setLastName(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setEmail(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setPassword(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                placeholder="••••••••"
                type="password"
                value={confirmPassword}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setConfirmPassword(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <Label>Select Role</Label>
              <div className="flex justify-center gap-4">
                {["student", "professor"].map((r) => (
                  <div
                    key={r}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 shadow-md",
                      role === r
                        ? "bg-gradient-to-br from-teal-500 to-blue-600"
                        : "bg-gray-700/50 hover:bg-gray-600/70"
                    )}
                    onClick={() => setRole(r as "student" | "professor")}
                    role="radio"
                    aria-checked={role === r}
                    tabIndex={0}
                  >
                    <input type="radio" name="role" value={r} checked={role === r} readOnly className="hidden" />
                    <span className="text-white capitalize">{r}</span>
                  </div>
                ))}
              </div>
            </LabelInputContainer>

            {error && <p className="text-red-400 text-sm text-center col-span-2">{error}</p>}
            {message && <p className="text-green-400 text-sm text-center col-span-2">{message}</p>}

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "col-span-2 h-12 font-semibold text-white rounded-xl shadow-xl transition-all duration-200",
                loading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              )}
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Create Account →"}
            </Button>

            <div className="col-span-2 h-px bg-gradient-to-r from-transparent via-gray-600/30 to-transparent my-4" />

            <div className="flex justify-center col-span-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => router.push("/login")}
                className="flex items-center gap-2 bg-gray-700/50 hover:bg-gray-600 text-white px-4 py-2 rounded-xl shadow-md transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 text-gray-300" />
                <span className="text-sm">Back to Login</span>
              </Button>
            </div>
          </form>

          {/* Confirmation Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="bg-gray-800/90 backdrop-blur-md border border-teal-500/20 max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-teal-400 text-2xl">Verify Your Email</DialogTitle>
                <DialogDescription className="text-gray-300 text-sm">
                  A confirmation email has been sent to{" "}
                  <b className="text-white">{email}</b>. Please check your inbox to confirm your email.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => router.push("/login")}
                  className="bg-teal-500 hover:bg-teal-600 text-white text-base px-6 py-2 rounded-lg"
                >
                  Go to Login
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col space-y-2 w-full", className)}>{children}</div>
);
