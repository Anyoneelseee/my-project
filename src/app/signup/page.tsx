"use client";

import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

// Define Particle interface
interface Particle {
  draw(): unknown;
  update(): unknown;
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
        gradient.addColorStop(0, "#40C4FF"); // Teal-blue accent
        gradient.addColorStop(1, "#00ADB5"); // Darker teal
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
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Sign up with user_metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      setError(error.message);
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
    <div className="min-h-svh relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Header with Logo */}
      <header className="p-6 md:p-10 z-10 relative flex justify-center">
        <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-teal-400">
          <Image
            src="/carmalogo.png"
            alt="Carma Logo"
            width={32}
            height={32}
            className="rounded-full"
          />
          Carma
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] z-10 relative">
        <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-xl shadow-2xl border border-teal-500/20 w-full max-w-md">
          <h2 className="text-3xl font-extrabold text-center text-teal-400 mb-6">Create Account</h2>
          <p className="text-gray-400 text-center mb-8">
            Join Carma and start your journey with advanced AI tools.
          </p>

          <form className="my-8" onSubmit={handleSubmit}>
            <div className="mb-6 flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
              <LabelInputContainer>
                <Label htmlFor="firstname" className="text-sm text-gray-300">First Name</Label>
                <Input
                  id="firstname"
                  placeholder="Tyler"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500"
                  required
                />
              </LabelInputContainer>
              <LabelInputContainer>
                <Label htmlFor="lastname" className="text-sm text-gray-300">Last Name</Label>
                <Input
                  id="lastname"
                  placeholder="Durden"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500"
                  required
                />
              </LabelInputContainer>
            </div>
            <LabelInputContainer className="mb-6">
              <Label htmlFor="email" className="text-sm text-gray-300">Email Address</Label>
              <Input
                id="email"
                placeholder="projectmayhem@fc.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500"
                required
              />
            </LabelInputContainer>
            <LabelInputContainer className="mb-6">
              <Label htmlFor="password" className="text-sm text-gray-300">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500"
                required
              />
            </LabelInputContainer>
            <LabelInputContainer className="mb-6">
              <Label htmlFor="confirm-password" className="text-sm text-gray-300">Confirm Password</Label>
              <Input
                id="confirm-password"
                placeholder="••••••••"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500"
                required
              />
            </LabelInputContainer>

            {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
            {message && <p className="text-green-400 text-sm text-center mb-4">{message}</p>}

            <button
              className={cn(
                "group/btn relative flex h-12 w-full items-center justify-center rounded-xl font-medium text-white shadow-lg transition-all duration-200",
                loading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              )}
              type="submit"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Create Account →"}
            </button>

            <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-gray-600/30 to-transparent" />
            <div className="flex justify-center">
              <button
                className="group/btn flex h-10 items-center justify-start space-x-2 rounded-xl bg-gray-700/50 px-4 font-medium text-white transition-all duration-200 hover:bg-gray-600"
                type="button"
                onClick={() => router.push("/login")}
              >
                <ArrowLeft className="h-4 w-4 text-gray-300" />
                <span className="text-sm">Back to Login</span>
              </button>
            </div>
          </form>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="bg-gray-800/90 backdrop-blur-md border-teal-500/20 max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-teal-400">Verify Your Email</DialogTitle>
                <DialogDescription className="text-gray-300">
                  A confirmation email has been sent to <b className="text-white">{email}</b>. Please check your inbox and confirm your email before logging in.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                  onClick={() => router.push("/login")}
                >
                  Go to Login
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center z-10 relative text-gray-500 text-sm">
        © 2025 Carma. Powered by Anyone else. All rights reserved.
      </footer>

      {/* Custom Styles */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        .bg-gradient-to-br {
          background: linear-gradient(135deg, #1a202c, #2a4365, #1a202c);
        }
        .border-teal-500\/20 {
          border-color: rgba(20, 184, 166, 0.2);
        }
        .hover\:bg-teal-600:hover {
          background-color: #0d9488;
        }
        .shadow-lg {
          box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}

const LabelInputContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn("flex flex-col space-y-2 w-full", className)}>{children}</div>;
};