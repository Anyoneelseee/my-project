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
      return NextResponse.json({ error: "Unauthorized: Missing or invalid Authorization header" }, { status: 401 });
    }

    const { code, classId, language, fileName, activityId, section, studentId, accessToken, refreshToken } = await request.json();
    console.log("Request body:", { code, classId, language, fileName, activityId, section, studentId, accessToken: accessToken?.substring(0, 10) + "...", refreshToken: refreshToken?.substring(0, 10) + "..." });
    if (!code || !classId || !language || !fileName || !activityId || !section || !accessToken || !refreshToken) {
      console.error("Missing fields:", { code, classId, language, fileName, activityId, section, studentId, accessToken: !!accessToken, refreshToken: !!refreshToken });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Set the session using both access_token and refresh_token
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) {
      console.error("Session set error:", sessionError.message);
      return NextResponse.json({ error: "Unauthorized: Failed to set session", details: sessionError.message }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User ID from auth:", user ? user.id : "Not found", "User Error:", userError?.message);
    if (userError || !user) {
      console.error("User fetch error:", userError?.message);
      return NextResponse.json({ error: "Unauthorized: Invalid or expired token" }, { status: 401 });
    }

    if (user.id !== studentId) {
      console.error("Student ID mismatch:", { authUserId: user.id, providedStudentId: studentId });
      return NextResponse.json({ error: "Unauthorized: Student ID does not match authenticated user" }, { status: 403 });
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

    if (result.section !== section) {
      console.error("Section mismatch:", { expected: result.section, received: section });
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    const filePath = `submissions/${section}/${user.id}/${activityId}/${fileName}`;
    console.log("Storage upload path:", filePath, "User ID:", user.id);

    const codeString = typeof code === "string" ? code : JSON.stringify(code);
    const blob = new Blob([codeString], { type: "text/plain" });

    console.log("Attempting storage upload to:", filePath, "with Blob size:", blob.size);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, blob, { contentType: "text/plain", upsert: true });
    if (uploadError) {
      console.error("Storage upload error:", uploadError.message, "Details:", (uploadError as SupabaseStorageError)?.details ?? "N/A", "Status:", (uploadError as SupabaseStorageError)?.statusCode ?? "N/A");
      return NextResponse.json(
        { 
          error: "Failed to upload to storage", 
          details: uploadError.message, 
          fullDetails: (uploadError as SupabaseStorageError)?.details ?? "N/A" 
        }, 
        { status: 500 }
      );
    }

    console.log("Storage upload successful:", uploadData.path);
    const languageMap: { [key: string]: string } = {
      "py": "python",
      "cpp": "cpp",
      "c": "c",
      "java": "java",
    };
    const fullLanguage = languageMap[language] || language;

    console.log("Attempting database insert for submission:", { classId, studentId: user.id, fileName, filePath, activityId });
    const { error: insertError, data } = await supabase.from("submissions").insert({
      class_id: classId,
      student_id: user.id,
      file_name: fileName,
      file_path: filePath,
      language: fullLanguage,
      activity_id: activityId,
      submitted_at: new Date().toISOString(),
      ai_percentage: 0,
      similarity_percentage: 0,
      status: "pending",
    }).select();
    if (insertError) {
      console.error("Database insert error:", insertError.message, "Details:", insertError.details, "Code:", insertError.code);
      return NextResponse.json(
        { 
          error: "Failed to insert submission into database", 
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