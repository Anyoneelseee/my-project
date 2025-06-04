// src/lib/supabase.ts
import { createClient, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables");
}

if (!supabaseKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_KEY is not defined in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use default localStorage for session persistence
  },
});

export { REALTIME_SUBSCRIBE_STATES };