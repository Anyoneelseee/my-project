// src/lib/supabase-server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient(request?: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log("Server cookies:", allCookies);

  let authHeader: string | null = null;
  if (request) {
    const headers = Object.fromEntries(request.headers.entries());
    console.log("All request headers:", headers);
    authHeader = request.headers.get("Authorization")?.replace("Bearer ", "") ?? null;
    console.log("Auth header received:", authHeader || "not found");
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        get(name: string): string | null {
          const cookieValue = cookieStore.get(name)?.value ?? null;
          const value = cookieValue || authHeader;
          console.log(`Getting ${name}:`, value || "not found");
          return value;
        },
        set(name: string, value: string, options: CookieOptions) {
          console.log(`Setting ${name}:`, value, options);
          cookieStore.set({ name, value, ...options, sameSite: "lax", secure: true });
        },
        remove(name: string, options: CookieOptions) {
          console.log(`Removing ${name}:`, options);
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
}