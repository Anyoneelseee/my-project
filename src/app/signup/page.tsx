"use client";

import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Check, X } from "lucide-react";
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
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particlesArray: Particle[] = [];
    const numberOfParticles = Math.min(100, Math.floor(window.innerWidth / 10)); // Scale particles by screen size
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
      updateCanvasSize();
      // Optional: Regenerate particles on resize for better distribution
      particlesArray.length = 0;
      for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new ParticleClass());
      }
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

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
    minLength: false,
  });

  const [passwordScore, setPasswordScore] = useState(0);

  const validatePassword = (pwd: string) => {
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const minLength = pwd.length >= 8;

    setPasswordStrength({
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      minLength,
    });

    // Calculate score (0-100): 20 points each criterion
    let score = 0;
    if (minLength) score += 20;
    if (hasUppercase) score += 20;
    if (hasLowercase) score += 20;
    if (hasNumber) score += 20;
    if (hasSpecial) score += 20;

    // Bonus for length beyond 8
    if (pwd.length > 12) score += 10;

    setPasswordScore(Math.min(score, 100));
  };

  const isPasswordStrong = () => passwordScore >= 80;

  useEffect(() => {
    if (password) {
      validatePassword(password);
    } else {
      setPasswordScore(0);
      setPasswordStrength({
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
        minLength: false,
      });
    }
  }, [password]);

  const getStrengthColor = () => {
    if (passwordScore >= 80) return "text-emerald-400";
    if (passwordScore >= 60) return "text-yellow-400";
    if (passwordScore >= 40) return "text-orange-400";
    return "text-red-400";
  };

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

    if (!isPasswordStrong()) {
      setError("Password is too weak. Aim for a score of 80+.");
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white font-sans">
      <ParticleBackground />

      <main className="flex items-center justify-center min-h-screen z-10 relative px-2 sm:px-4 md:px-6 py-4">
        <div className="bg-gray-800/90 backdrop-blur-md p-4 sm:p-6 md:p-8 lg:p-10 rounded-xl shadow-xl border border-teal-500/20 w-full max-w-sm sm:max-w-md md:max-w-lg">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 font-bold text-xl sm:text-2xl text-teal-400 mb-4 sm:mb-6">
            <Image src="/favicon-512-v3.png" alt="Carma Logo" width={32} height={32} className="rounded-full sm:w-10 sm:h-10" />
            CARMA
          </Link>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center text-teal-400 mb-2 leading-tight">
            Create Account
          </h2>
          <p className="text-gray-400 text-center mb-6 sm:mb-8 text-xs sm:text-sm md:text-base">
            Join CARMA and start your journey with advanced AI tools.
          </p>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Row 1: First and Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <LabelInputContainer>
                <Label htmlFor="firstname" className="text-sm font-medium">First Name</Label>
                <Input
                  id="firstname"
                  placeholder="Tyler"
                  value={firstName}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setFirstName(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500 h-10 sm:h-12"
                  required
                />
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="lastname" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="lastname"
                  placeholder="Durden"
                  value={lastName}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setLastName(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500 h-10 sm:h-12"
                  required
                />
              </LabelInputContainer>
            </div>

            {/* Email */}
            <LabelInputContainer className="w-full">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setEmail(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500 h-10 sm:h-12 w-full"
                required
              />
            </LabelInputContainer>

            {/* Password Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <LabelInputContainer>
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setPassword(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500 h-10 sm:h-12"
                  required
                />
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  placeholder="••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setConfirmPassword(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500 h-10 sm:h-12"
                  required
                />
              </LabelInputContainer>
            </div>

            {/* Password Strength Indicators & Score */}
            {/* Password Strength Indicators & Score - FIXED & FULLY RESPONSIVE */}
{password && (
  <div className="space-y-3">
    {/* Score Header */}
    <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400">
      <span className="font-medium">Password Strength</span>
      <span className={cn("font-bold", getStrengthColor())}>{passwordScore}/100</span>
    </div>

    {/* Progress Bar */}
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          passwordScore >= 80
            ? "bg-emerald-500"
            : passwordScore >= 60
            ? "bg-yellow-500"
            : passwordScore >= 40
            ? "bg-orange-500"
            : "bg-red-500"
        )}
        style={{ width: `${passwordScore}%` }}
      />
    </div>

    {/* Requirements List - Responsive Grid */}
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
      <div className={cn("flex items-center gap-2", passwordStrength.minLength ? "text-emerald-400" : "text-gray-500")}>
        {passwordStrength.minLength ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span>8+ characters</span>
      </div>
      <div className={cn("flex items-center gap-2", passwordStrength.hasUppercase ? "text-emerald-400" : "text-gray-500")}>
        {passwordStrength.hasUppercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span>Uppercase</span>
      </div>
      <div className={cn("flex items-center gap-2", passwordStrength.hasLowercase ? "text-emerald-400" : "text-gray-500")}>
        {passwordStrength.hasLowercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span>Lowercase</span>
      </div>
      <div className={cn("flex items-center gap-2", passwordStrength.hasNumber ? "text-emerald-400" : "text-gray-500")}>
        {passwordStrength.hasNumber ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span>Number</span>
      </div>
      <div className={cn("flex items-center gap-2 col-span-2 sm:col-span-1", passwordStrength.hasSpecial ? "text-emerald-400" : "text-gray-500")}>
        {passwordStrength.hasSpecial ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span>Special character</span>
      </div>
    </div>
  </div>
)}
            {/* Role Selection */}
            <LabelInputContainer className="w-full">
              <Label className="text-sm font-medium mb-3 block">Select Role</Label>
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
                {["student", "professor"].map((r) => (
                  <div
                    key={r}
                    className={cn(
                      "flex items-center justify-center space-x-2 p-3 rounded-lg cursor-pointer transition-all duration-200 shadow-md w-full sm:w-auto min-w-0",
                      role === r
                        ? "bg-gradient-to-br from-teal-500 to-blue-600 text-white"
                        : "bg-gray-700/50 hover:bg-gray-600/70 text-slate-200"
                    )}
                    onClick={() => setRole(r as "student" | "professor")}
                    role="radio"
                    aria-checked={role === r}
                    tabIndex={0}
                  >
                    <input type="radio" name="role" value={r} checked={role === r} readOnly className="hidden" />
                    <span className="text-xs sm:text-sm capitalize font-medium text-center">{r}</span>
                  </div>
                ))}
              </div>
            </LabelInputContainer>

            {error && <p className="text-red-400 text-xs sm:text-sm text-center">{error}</p>}
            {message && <p className="text-green-400 text-xs sm:text-sm text-center">{message}</p>}

            <Button
              type="submit"
              disabled={loading || !isPasswordStrong()}
              className={cn(
                "w-full h-12 sm:h-auto font-semibold text-white rounded-xl shadow-xl transition-all duration-200 text-base sm:text-lg py-3",
                loading || !isPasswordStrong()
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              )}
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Create Account →"}
            </Button>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-600/30 to-transparent my-4 sm:my-6" />

            <div className="flex justify-center">
              <Button
                variant="secondary"
                type="button"
                onClick={() => router.push("/login")}
                className="flex items-center gap-2 bg-gray-700/50 hover:bg-gray-600 text-white px-4 py-2 rounded-xl shadow-md transition-all duration-200 text-sm w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4 text-gray-300" />
                <span>Back to Login</span>
              </Button>
            </div>
          </form>

          {/* Confirmation Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="bg-gray-800/90 backdrop-blur-md border border-teal-500/20 max-w-sm sm:max-w-md mx-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-teal-400 text-xl sm:text-2xl">Verify Your Email</DialogTitle>
                <DialogDescription className="text-gray-300 text-sm">
                  A confirmation email has been sent to{" "}
                  <b className="text-white">{email}</b>. Please check your inbox to confirm your email.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white text-base px-6 py-2 rounded-lg"
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