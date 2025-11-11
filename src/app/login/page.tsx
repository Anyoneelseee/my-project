// app/login/page.tsx
"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoginForm from "@/components/login-form";
import Image from "next/image";
import Link from "next/link";

// Particle Background (unchanged)
interface Particle {
  draw(): void;
  update(): void;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
}

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
      // 1. SIGN IN
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !user) {
        setError(
          signInError?.message === "Email not confirmed"
            ? "Please confirm your email address before logging in. Check your inbox for the confirmation link."
            : signInError?.message || "Invalid credentials."
        );
        setLoading(false);
        return;
      }

      // Inside handleSubmit, after fetching role from `users` table
const { data: profile, error: profileError } = await supabase
  .from("users")
  .select("role")
  .eq("id", user.id)
  .single();

if (profileError || !profile?.role) {
  setError("Profile not found. Contact support.");
  setLoading(false);
  return;
}

const role = profile.role as "professor" | "student";

// SYNC ROLE TO user_metadata (THIS IS THE KEY)
await supabase.auth.updateUser({
  data: { role }
});

// Now redirect
router.push(`/dashboard/${role}`);

    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white font-sans">
      <ParticleBackground />

      <main className="flex items-center justify-center h-screen relative z-10 px-4">
        <div className="flex flex-col md:flex-row w-full max-w-5xl rounded-2xl overflow-hidden shadow-xl border border-teal-500/20 backdrop-blur-md">
          
          <div className="w-full md:w-1/2 bg-gray-800/90 p-8 flex flex-col items-center justify-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-teal-400 mb-6">
              <Image src="/carmalogo.png" alt="Carma Logo" width={40} height={40} className="rounded-full" />
              CARMA
            </Link>

            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              handleSubmit={handleSubmit}
              error={error}
            />

            <p className="mt-6 text-sm text-gray-400">
              Don’t have an account?{" "}
              <Link href="/signup" className="text-teal-400 hover:text-teal-300 underline transition-colors">
                Sign up
              </Link>
            </p>
          </div>

          <div className="w-full md:w-1/2 bg-gradient-to-br from-teal-500 to-blue-600 flex flex-col items-center justify-center p-8 text-center relative">
            <div className="absolute inset-0 bg-black/20" />
            <Image
              src="/illustration_login.png"
              alt="Welcome Illustration"
              width={180}
              height={180}
              className="mb-6 z-10"
            />
            <h2 className="text-2xl font-bold mb-3 z-10">Welcome to CARMA</h2>
            <p className="text-sm text-teal-100 max-w-sm z-10">
              Discover CARMA, your intelligent workspace for managing courses,
              checking AI-generated content, and collaborating with ease.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}