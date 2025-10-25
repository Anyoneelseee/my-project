"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView, Variants } from "framer-motion";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Loader2, Code, Shield, Clock } from "lucide-react";

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
    let scrollY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);

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

        const scrollFactor = Math.min(scrollY / 1000, 2);
        this.x += this.speedX * (1 + scrollFactor);
        this.y += this.speedY * (1 + scrollFactor);

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
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />;
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  const isHeroInView = useInView(heroRef, { margin: "-100px", once: false });
  const isFeaturesInView = useInView(featuresRef, { margin: "-100px", once: false });
  const isHowItWorksInView = useInView(howItWorksRef, { margin: "-100px", once: false });
  const isFooterInView = useInView(footerRef, { margin: "-100px", once: false });

  const fadeInVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 1.5, ease: "easeOut" as const } },
  };

  const handleClick = () => {
    setLoading(true);
  };

  useEffect(() => {
    const fixTextColor = () => {
      if (heroRef.current) {
        const textElements = heroRef.current.querySelectorAll('h2, h2 *, p, p *');
        textElements.forEach((element) => {
          (element as HTMLElement).style.color = '#D1D5DB';
        });
      }
    };

    fixTextColor();

    const observer = new MutationObserver(() => {
      fixTextColor();
    });

    if (heroRef.current) {
      observer.observe(heroRef.current, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-950 via-gray-900 to-blue-950 text-white">
      <ParticleBackground />

      <div className="text-center pt-10 z-10 relative">
        <motion.h1
          initial="hidden"
          animate={isHeroInView ? "visible" : "hidden"}
          variants={fadeInVariants}
          className="text-6xl md:text-8xl font-extrabold text-teal-400 tracking-wide"
        >
          CARMA
        </motion.h1>
      </div>

      <header ref={heroRef} className="py-16 px-10 relative z-10 flex flex-col items-center">
        <div className="absolute inset-0 from-blue-950/40 z-[-1]"></div>
        <h2 className="text-3xl md:text-5xl font-extrabold text-gray-300 animate-fade-in leading-tight max-w-4xl text-center">
          <TextGenerateEffect
            duration={2}
            filter={false}
            words="CARMA: CODE SIMILARITY DETECTION, AI-GENERATED CODE IDENTIFICATION, REAL-TIME STUDENT ACTIVITY MONITORING FOR ACADEMIC INTEGRITY"
            className="text-3xl md:text-5xl font-extrabold text-gray-300 !text-gray-300"
          />
        </h2>
        <motion.p
          initial="hidden"
          animate={isHeroInView ? "visible" : "hidden"}
          variants={fadeInVariants}
          className="text-gray-300 text-lg md:text-xl mt-6 max-w-2xl leading-relaxed text-center"
        >
          Ensuring integrity in programming education with advanced AI-driven tools.
        </motion.p>
        <motion.div
          initial="hidden"
          animate={isHeroInView ? "visible" : "hidden"}
          variants={fadeInVariants}
          className="flex justify-center mt-10"
        >
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
        </motion.div>
      </header>

      <section ref={featuresRef} className="py-16 px-10 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.h3
            initial="hidden"
            animate={isFeaturesInView ? "visible" : "hidden"}
            variants={fadeInVariants}
            className="text-4xl font-extrabold text-teal-400 text-center mb-12"
          >
            Why Choose CARMA?
          </motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial="hidden"
              animate={isFeaturesInView ? "visible" : "hidden"}
              variants={fadeInVariants}
              className="bg-gray-800/50 p-6 rounded-xl shadow-lg border border-teal-500/20 hover:bg-gray-700/50 transition-all duration-300"
            >
              <Code className="h-12 w-12 text-teal-400 mb-4 mx-auto" />
              <h4 className="text-xl font-extrabold text-gray-300 text-center">Code Similarity Detection</h4>
              <p className="text-gray-300 mt-2 text-center">
                Instantly identify similarities between student submissions to ensure originality and prevent plagiarism.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              animate={isFeaturesInView ? "visible" : "hidden"}
              variants={fadeInVariants}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/50 p-6 rounded-xl shadow-lg border border-teal-500/20 hover:bg-gray-700/50 transition-all duration-300"
            >
              <Shield className="h-12 w-12 text-teal-400 mb-4 mx-auto" />
              <h4 className="text-xl font-extrabold text-gray-300 text-center">AI-Generated Code Detection</h4>
              <p className="text-gray-300 mt-2 text-center">
                Detect AI-generated code with advanced machine learning to uphold academic integrity.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              animate={isFeaturesInView ? "visible" : "hidden"}
              variants={fadeInVariants}
              transition={{ delay: 0.4 }}
              className="bg-gray-800/50 p-6 rounded-xl shadow-lg border border-teal-500/20 hover:bg-gray-700/50 transition-all duration-300"
            >
              <Clock className="h-12 w-12 text-teal-400 mb-4 mx-auto" />
              <h4 className="text-xl font-extrabold text-gray-300 text-center">Real-Time Monitoring</h4>
              <p className="text-gray-300 mt-2 text-center">
                Track student coding activity in real-time to provide insights and support fair evaluation.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section ref={howItWorksRef} className="py-16 px-10 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.h3
            initial="hidden"
            animate={isHowItWorksInView ? "visible" : "hidden"}
            variants={fadeInVariants}
            className="text-4xl font-extrabold text-teal-400 text-center mb-12"
          >
            How CARMA Works
          </motion.h3>
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: "Submit Your Code",
                description: "Students or professors upload code via our intuitive interface.",
              },
              {
                step: 2,
                title: "Analyze with AI",
                description: "Our AI analyzes code for similarity and AI-generated content.",
              },
              {
                step: 3,
                title: "Get Results",
                description: "Receive detailed reports on code originality and activity insights.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial="hidden"
                animate={isHowItWorksInView ? "visible" : "hidden"}
                variants={fadeInVariants}
                transition={{ delay: index * 0.3 }}
                className="flex items-center space-x-4 bg-gray-800/50 p-6 rounded-xl border border-teal-500/20 hover:bg-gray-700/50 transition-all duration-300"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-extrabold">
                  {item.step}
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-gray-300">{item.title}</h4>
                  <p className="text-gray-300 mt-1">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer ref={footerRef} className="py-12 px-10 bg-gray-900/80 relative z-10">
        <motion.div
          initial="hidden"
          animate={isFooterInView ? "visible" : "hidden"}
          variants={fadeInVariants}
          className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center"
        >
          <div className="mb-6 md:mb-0">
            <h3 className="text-2xl font-extrabold text-teal-400">CARMA</h3>
            <p className="text-gray-300 text-sm mt-2">
              Empowering academic integrity through AI-driven code analysis.
            </p>
          </div>
       
        </motion.div>
        <motion.div
          initial="hidden"
          animate={isFooterInView ? "visible" : "hidden"}
          variants={fadeInVariants}
          className="text-center text-gray-400 text-sm mt-6"
        >
          &copy; {new Date().getFullYear()} CARMA. All rights reserved.
        </motion.div>
      </footer>

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
        header h2,
        header p,
        header h2 > *,
        header p > *,
        section h3,
        section h4,
        section p,
        footer h3,
        footer p,
        footer a {
          color: #D1D5DB !important;
        }
        header:hover h2,
        header:hover p,
        header:hover h2 > *,
        header:hover p > *,
        section:hover h3,
        section:hover h4,
        section:hover p,
        footer:hover h3,
        footer:hover p,
        footer:hover a {
          color: #D1D5DB !important;
        }
        footer a:hover {
          color: #2DD4BF !important;
        }
        button:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
