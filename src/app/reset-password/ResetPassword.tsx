"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Reusing your exact Particle Background
const ParticleBackground = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();

    // ---- FIXED HERE ----
    class Particle {
      x: number; y: number; size: number; speedX: number; speedY: number;
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
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          const force = (100 - dist) / 100;
          this.x += (dx / dist) * force * 3;
          this.y += (dy / dist) * force * 3;
        }
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      }
      draw() {
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grad.addColorStop(0, "#40C4FF");
        grad.addColorStop(1, "#00ADB5");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = []; // <-- FIXED TYPE
    const count = Math.min(100, Math.floor(window.innerWidth / 10));
    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    for (let i = 0; i < count; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener("resize", () => {
      updateSize();
      particles.length = 0;
      for (let i = 0; i < count; i++) particles.push(new Particle());
    });

return () => cancelAnimationFrame(0);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
};

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Password strength
  const [strength, setStrength] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  });
  const [score, setScore] = useState(0);

  const validatePassword = (pwd: string) => {
    const checks = {
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /\d/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    setStrength(checks);

    let s = 0;
    if (checks.minLength) s += 20;
    if (checks.hasUppercase) s += 20;
    if (checks.hasLowercase) s += 20;
    if (checks.hasNumber) s += 20;
    if (checks.hasSpecial) s += 20;
    if (pwd.length > 12) s += 10;
    setScore(Math.min(s, 100));
  };

  useEffect(() => {
    if (newPassword) validatePassword(newPassword);
    else {
      setScore(0);
      setStrength({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
      });
    }
  }, [newPassword]);

  const isStrong = score >= 80;

  useEffect(() => {
    const token = searchParams.get("access_token");
    const refresh = searchParams.get("refresh_token");
    if (token && refresh) {
      supabase.auth.setSession({ access_token: token, refresh_token: refresh });
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isStrong) {
      setError("Please choose a stronger password (80+ score).");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 3000);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white">
      <ParticleBackground />

      <main className="flex items-center justify-center min-h-screen relative z-10 px-4">
        <div className="bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-teal-500/20 p-6 sm:p-10 w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/favicon-512-v3.png"
                alt="CARMA"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="text-3xl font-bold text-teal-400">CARMA</span>
            </Link>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-teal-400 mb-2">
            Reset Password
          </h1>
          <p className="text-center text-gray-400 mb-8 text-sm sm:text-base">
            Create a strong new password for your account
          </p>

          <form onSubmit={handleResetPassword} className="space-y-6">
            {/* New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e: {
                  target: { value: React.SetStateAction<string> };
                }) => setNewPassword(e.target.value)}
                className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e: {
                  target: { value: React.SetStateAction<string> };
                }) => setConfirmPassword(e.target.value)}
                className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </div>

            {/* Password Strength */}
            {newPassword && (
              <div className="space-y-3 bg-gray-900/40 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Password Strength</span>
                  <span
                    className={cn(
                      "font-bold",
                      score >= 80
                        ? "text-emerald-400"
                        : score >= 60
                        ? "text-yellow-400"
                        : score >= 40
                        ? "text-orange-400"
                        : "text-red-400"
                    )}
                  >
                    {score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      score >= 80
                        ? "bg-emerald-500"
                        : score >= 60
                        ? "bg-yellow-500"
                        : score >= 40
                        ? "bg-orange-500"
                        : "bg-red-500"
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: "8+ characters", met: strength.minLength },
                    { label: "Uppercase", met: strength.hasUppercase },
                    { label: "Lowercase", met: strength.hasLowercase },
                    { label: "Number", met: strength.hasNumber },
                    { label: "Special char", met: strength.hasSpecial },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex items-center gap-2",
                        item.met ? "text-emerald-400" : "text-gray-500"
                      )}
                    >
                      {item.met ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-center text-sm">{error}</p>
            )}
            {message && (
              <p className="text-green-400 text-center font-medium">
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !isStrong}
              className={cn(
                "w-full h-14 text-lg font-semibold rounded-xl transition-all",
                loading || !isStrong
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-xl"
              )}
            >
              {loading ? (
                <Loader2 className="animate-spin h-6 w-6" />
              ) : (
                "Update Password →"
              )}
            </Button>

            <div className="text-center pt-4">
              <Link
                href="/login"
                className="text-gray-400 hover:text-teal-400 text-sm transition-colors"
              >
                ← Back to Login
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
