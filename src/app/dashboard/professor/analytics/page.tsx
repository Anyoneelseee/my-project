// src/app/dashboard/professor/analytics/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the professor dashboard
    router.push("/dashboard/professor");
  }, [router]);

  return <div className="flex items-center justify-center h-screen">Redirecting to dashboard...</div>;
}