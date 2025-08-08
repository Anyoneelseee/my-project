import { supabase } from "./supabase";

export async function getUserRole() {
  try {
    // Ensure session exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("getUserRole - No session:", sessionError?.message);
      return null;
    }

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("getUserRole - User fetch error:", userError?.message);
      return null;
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("getUserRole - Profile query error:", profileError.message, profileError.details, profileError.hint);
      return null;
    }

    console.log("getUserRole - Profile fetched:", profile);
    return profile?.role || null;
  } catch (err) {
    console.error("getUserRole - Unexpected error:", err);
    return null;
  }
}
