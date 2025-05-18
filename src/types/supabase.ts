// src/types/supabase.ts
export {};

declare global {
  interface Window {
    __supabaseSession?: {
      access_token: string;
      refresh_token: string;
      expires_at?: number; // Make optional
    };
  }
}