"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          console.error("Session error:", error);
          setSession(null);
          return;
        }

        const sess = data.session;
        setSession(sess);

        const isPublic = ["/", "/login", "/landing"].includes(pathname);
        const isDashboard = pathname.startsWith("/dashboard");

        if (sess && isPublic) {
          const role = sess.user.user_metadata?.role;
          if (!role) return router.replace("/login");
          const target = role === "professor" ? "/dashboard/professor" : "/dashboard/student";
          if (pathname !== target) router.replace(target);
          return;
        }

        if (!sess && isDashboard) {
          router.replace("/login");
          return;
        }

        if (sess && isDashboard) {
          const role = sess.user.user_metadata?.role;
          const isProfPath = pathname.startsWith("/dashboard/professor");
          const isStudentPath = pathname.startsWith("/dashboard/student");
          if (role === "professor" && !isProfPath) router.replace("/dashboard/professor");
          if (role === "student" && !isStudentPath) router.replace("/dashboard/student");
        }
      } catch (err) {
        console.error("Auth check error:", err);
        setSession(null);
        router.replace("/login");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        localStorage.clear();
        sessionStorage.clear();
        setSession(null);
        window.location.href = "/login"; // FULL RELOAD
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(sess);
        checkSession();
      }
    });

    const handleFocus = () => checkSession();
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname, router]);

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-300">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}