"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MonitoringRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard/professor");
  }, [router]);

  return <div>Redirecting to dashboard...</div>;
}