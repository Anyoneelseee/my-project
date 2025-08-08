import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define a custom type for potential storage error properties
type SupabaseStorageError = Error & {
  details?: string;
  statusCode?: number;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    console.log("Auth Header:", authHeader ? "Present" : "Missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = authHeader.split(" ")[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User ID from auth:", user ? user.id : "Not found", "User Error:", userError?.message);
    if (userError || !user) {
      console.error("User fetch error:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, classId, language, fileName, activityId } = await request.json();
    console.log("Request body:", { code, classId, language, fileName, activityId });
    if (!code || !classId || !language || !activityId) {
      console.error("Missing fields:", { code, classId, language, fileName, activityId });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(classId) || !uuidRegex.test(activityId)) {
      console.error("Invalid UUID format:", { classId, activityId });
      return NextResponse.json({ error: "Invalid classId or activityId format" }, { status: 400 });
    }

    type SectionResult = { section: string | null; error_message: string | null };
    const { data: sectionData, error: sectionError } = await supabase
      .rpc("get_student_class_section", { class_id_input: classId, student_id_input: user.id });

    console.log("Section RPC result:", sectionData, "Error:", sectionError);
    if (sectionError) {
      console.error("Section fetch error:", sectionError.message);
      return NextResponse.json({ error: "Failed to fetch class information", details: sectionError.message }, { status: 500 });
    }

    const result: SectionResult = Array.isArray(sectionData) && sectionData.length > 0
      ? sectionData[0]
      : { section: null, error_message: "No data returned" };
    if (!result.section || result.error_message) {
      console.error("No section found:", result.error_message);
      return NextResponse.json({ error: result.error_message || "Not enrolled" }, { status: 403 });
    }

    const section = result.section;
    const timestamp = Date.now();
    const safeFileName = fileName?.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".") || `submission-${timestamp}.${language}`;
    const filePath = `submissions/${section}/${user.id}/${activityId}/${safeFileName}`;

    console.log("Attempting upload to:", filePath, "with Blob size:", new Blob([typeof code === "string" ? code : JSON.stringify(code)]).size);
    const codeString = typeof code === "string" ? code : JSON.stringify(code);
    const blob = new Blob([codeString], { type: "text/plain" });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, blob, { contentType: "text/plain", upsert: true });
    if (uploadError) {
      console.error("Upload error:", uploadError.message, "Details:", (uploadError as SupabaseStorageError)?.details ?? "N/A", "Status:", (uploadError as SupabaseStorageError)?.statusCode ?? "N/A");
      return NextResponse.json({ error: "Upload failed", details: uploadError.message }, { status: 500 });
    }

    console.log("Upload successful:", uploadData.path);
    const languageMap: { [key: string]: string } = {
      "py": "python",
      "cpp": "cpp",
      "c": "c",
      "java": "java",
    };
    const fullLanguage = languageMap[language] || language;

    const { error: insertError, data } = await supabase.from("submissions").insert({
      class_id: classId,
      student_id: user.id,
      file_name: safeFileName,
      file_path: filePath,
      language: fullLanguage,
      activity_id: activityId,
      submitted_at: new Date().toISOString(),
      ai_percentage: 0,
      similarity_percentage: 0,
      status: "pending",
    }).select();
    if (insertError) {
      console.error("Insert error:", insertError.message, insertError.details, insertError.code);
      return NextResponse.json(
        { 
          error: "Insert failed", 
          details: insertError.message, 
          code: insertError.code,
          fullDetails: insertError.details 
        }, 
        { status: 500 }
      );
    }

    console.log("Submission recorded successfully:", data);
    return NextResponse.json({ message: "Submission uploaded and recorded", data }, { status: 200 });
  } catch (err) {
    console.error("API error:", err instanceof Error ? err.message : err, err instanceof Error ? err.stack : "");
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}