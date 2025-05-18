import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!token) {
      console.error("No token provided");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: "",
    });
    if (sessionError) {
      console.error("Session error:", sessionError.message);
      return NextResponse.json({ error: "Failed to set session" }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User data:", user);
    if (userError || !user) {
      console.error("Auth error details:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, classId, language, fileName } = await request.json();
    console.log("Received classId:", classId);

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, code")
      .eq("id", classId)
      .single();

    if (classError || !classData) {
      console.error("Class query error:", classError?.message);
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const filePath = `submissions/${classData.code}/${user.id}/${fileName || `submission-${Date.now()}.${language}`}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, code, { contentType: "text/plain" });

    if (uploadError) {
      console.error("Upload error details:", uploadError.message);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("submissions").insert([
      {
        user_id: user.id,
        class_id: classId,
        file_path: filePath,
        language,
        submitted_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error("Insert error details:", insertError.message);
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
    }

    return NextResponse.json({ message: "Submission successful" }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}