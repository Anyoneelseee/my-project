// src/lib/auth.ts
import { supabase } from "./supabase";

export const getUserRole = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) return null;

  return profile?.role ?? null;
};