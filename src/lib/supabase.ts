// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables");
}

if (!supabaseKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_KEY is not defined in environment variables");
}

// In-memory storage
const memoryStorage: { [key: string]: string } = {};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        console.log("Storage getItem:", key, memoryStorage[key]);
        return memoryStorage[key] || null;
      },
      setItem: (key, value) => {
        console.log("Storage setItem:", key, value);
        memoryStorage[key] = value;
      },
      removeItem: (key) => {
        console.log("Storage removeItem:", key);
        delete memoryStorage[key];
      },
    },
    storageKey: "sb-kmgrxzkiuhsguukcayxr-auth-token",
  },
});