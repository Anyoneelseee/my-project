"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Particle type
interface IParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  update: () => void;
  draw: () => void;
}

// Particle Background Component
const ParticleBackground = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();

    const particles: IParticle[] = [];
    const count = Math.min(100, Math.floor(window.innerWidth / 10));
    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    class Particle implements IParticle {
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
        const grad = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.size
        );
        grad.addColorStop(0, "#40C4FF");
        grad.addColorStop(1, "#00ADB5");
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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

    const handleResize = () => {
      updateSize();
      particles.length = 0;
      for (let i = 0; i < count; i++) particles.push(new Particle());
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
};

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a password reset link.");
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
            Forgot Password
          </h1>
          <p className="text-center text-gray-400 mb-8 text-sm sm:text-base">
            Enter your email and we&apos;ll send you a reset link
          </p>

          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>

              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-center text-sm">{error}</p>
            )}

            {message && (
              <p className="text-emerald-400 text-center font-medium">
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-14 text-lg font-semibold rounded-xl transition-all",
                loading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-br from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-xl"
              )}
            >
              {loading ? (
                <Loader2 className="animate-spin h-6 w-6" />
              ) : (
                "Send Reset Link"
              )}
            </Button>

            <div className="text-center pt-4">
              <Link
                href="/login"
                className="text-gray-400 hover:text-teal-400 text-sm transition-colors"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
