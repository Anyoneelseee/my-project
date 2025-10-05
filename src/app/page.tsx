"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Loader2 } from "lucide-react";

// Define Particle type
interface Particle {
  draw(): unknown;
  update(): unknown;
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

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const heroRef = useRef<HTMLElement>(null); // Ref for the hero section

  const handleClick = () => {
    setLoading(true);
  };

  // Force the text color of the hero section after rendering
  useEffect(() => {
    const fixTextColor = () => {
      if (heroRef.current) {
        // Select all text-containing elements within the h2
        const textElements = heroRef.current.querySelectorAll('h2, h2 *');
        textElements.forEach((element) => {
          (element as HTMLElement).style.color = '#D1D5DB'; // Force text-gray-300
        });
      }
    };

    // Run immediately after mount
    fixTextColor();

    // Set up a mutation observer to handle dynamic changes (e.g., TextGenerateEffect rendering)
    const observer = new MutationObserver(() => {
      fixTextColor();
    });

    if (heroRef.current) {
      observer.observe(heroRef.current, { childList: true, subtree: true });
    }

    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-950 via-gray-900 to-blue-950 text-white">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Website Name Above Hero Section */}
      <div className="text-center pt-10 z-10 relative">
        <h1 className="text-6xl md:text-8xl font-extrabold text-teal-400 tracking-wide">
          CARMA
        </h1>
      </div>

      {/* Hero Section */}
      <header ref={heroRef} className="py-16 px-10 relative z-10 flex flex-col items-center">
        {/* Overlay for Better Text Visibility */}
        <div className="absolute inset-0  from-blue-950/40 z-[-1]"></div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-gray-300 animate-fade-in leading-tight max-w-4xl text-center">
          <TextGenerateEffect
            duration={2}
            filter={false}
            words="CARMA: CODE SIMILARITY DETECTION, AI-GENERATED CODE IDENTIFICATION, REAL-TIME STUDENT ACTIVITY MONITORING FOR ACADEMIC INTEGRITY"
            className="text-3xl md:text-5xl font-extrabold text-gray-300 !text-gray-300"
          />
        </h2>

        <p className="text-gray-300 text-lg md:text-xl mt-6 max-w-2xl leading-relaxed text-center">
          Ensuring integrity in programming education with advanced AI-driven tools.
        </p>

        <div className="flex justify-center mt-10">
          <Link href="/login">
            <button
              onClick={handleClick}
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white py-3 px-8 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 w-48 h-14 animate-glow"
              disabled={loading}
              aria-label={loading ? "Loading" : "Get Started"}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <span>Get Started</span>
              )}
            </button>
          </Link>
        </div>
      </header>

 
      {/* Custom Styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 1.5s ease-in-out;
        }
        @keyframes glow {
          0% { box-shadow: 0 0 5px #00ADB5, 0 0 10px #00ADB5; }
          50% { box-shadow: 0 0 10px #00ADB5, 0 0 20px #40C4FF; }
          100% { box-shadow: 0 0 5px #00ADB5, 0 0 10px #00ADB5; }
        }
        .animate-glow {
          animation: glow 2s infinite;
        }
        /* Fallback CSS for hero section text */
        header h2,
        header p,
        header h2 > *,
        header p > * {
          color: #D1D5DB !important; /* Tailwind's text-gray-300 */
        }
        header:hover h2,
        header:hover p,
        header:hover h2 > *,
        header:hover p > * {
          color: #D1D5DB !important; /* Prevent hover changes */
        }
      `}</style>
    </div>
  );
}