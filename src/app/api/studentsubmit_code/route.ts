// src/app/api/studentsubmit_code/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { code, classId, language, fileName } = await request.json();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User data:", user);

    if (userError || !user) {
      console.error("Auth error details:", userError?.message || "No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate class
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("section")
      .eq("id", classId)
      .single();
    if (classError || !classData) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Generate file name and path
    const finalFileName = fileName || `code-${Date.now()}.${language}`;
    const filePath = `submissions/${classData.section}/${user.id}/${finalFileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, Buffer.from(code), {
        contentType: "text/plain",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: `Failed to upload file: ${uploadError.message}` }, { status: 500 });
    }

    // Store metadata in database
    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert({
        class_id: classId,
        student_id: user.id,
        file_name: finalFileName,
        file_path: filePath,
        language,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: `Failed to save submission: ${insertError.message}` }, { status: 500 });
    }

    // Placeholder for AI detection
    try {
      const aiResponse = await fetch("https://ai-detection-api.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      if (!aiResponse.ok) throw new Error("AI detection failed");
      const { isAiGenerated, confidence } = await aiResponse.json();

      await supabase.from("submission_analysis").insert({
        submission_id: submission.id,
        is_ai_generated: isAiGenerated,
        confidence_score: confidence,
      });
    } catch (aiError) {
      console.error("AI detection error:", aiError);
      // Continue even if AI detection fails
    }

    return NextResponse.json({ message: "File submitted successfully", fileName: finalFileName });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}