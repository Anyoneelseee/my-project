/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import LoginForm from "@/components/login-form";
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
      if (role) {
        router.push(`/dashboard/${role}`);
      } else {
        setError("Role not found. Please contact support to resolve this issue.");
        console.error("Role not found for user:", user.id);
        // Optionally redirect to an error page
        // router.push("/error");
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
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
            width={50}
            height={50}
            className="rounded-full"
          />
          Carma
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] z-10 relative">
        <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-xl shadow-2xl border border-teal-500/20 w-full max-w-md">
          <h1 className="text-3xl font-extrabold text-center text-teal-400 mb-6">
            Welcome Back
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Enter your credentials to access your account
          </p>
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            handleSubmit={handleSubmit}
            error={error}
          />
          {/* Styled Sign-Up Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Don’t have an account?{" "}
              <Link href="/signup" className="text-teal-400 hover:text-teal-300 underline transition-colors duration-200">
                Sign up
              </Link>
            </p>
          </div>
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
        .hover\:text-teal-300:hover {
          color: #5eead4;
        }
        .shadow-2xl {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
}