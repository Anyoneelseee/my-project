"use client";

import { useState } from "react";
import Link from "next/link";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-center">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 py-4 bg-white shadow-md">
        <h1 className="text-2xl font-bold text-blue-600">CARMA</h1>
        <div className="flex gap-6"></div>
      </nav>

      {/* Hero Section */}
      <header className="py-20 px-10">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
          <TextGenerateEffect
            duration={2}
            filter={false}
            words="CARMA: CODE SIMILARITY DETECTION, AI-GENERATED CODE IDENTIFICATION, REAL-TIME STUDENT ACTIVITY MONITORING FOR ACADEMIC INTEGRITY"
            className="text-4xl font-bold text-gray-900 dark:text-white"
          />
        </h2>

        <p className="text-gray-600 text-lg mt-4">
          Ensuring integrity in programming education with advanced AI-driven tools.
        </p>

        <div className="flex justify-center mt-6">
  <Link href="/login">
    <button
      onClick={handleClick}
      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-md text-lg shadow-md disabled:opacity-50 w-40 h-12"
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <span>Get Started</span>
      )}
    </button>
  </Link>
</div>

      </header>
    </div>
  );
}
