import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define a custom type for potential storage error properties
type SupabaseStorageError = Error & {
  details?: string;
  statusCode?: number;
};
type UploadedFile = {
  fileName: string;
  language: string;
  code: string;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    console.log("Auth Header:", authHeader ? "Present" : "Missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return NextResponse.json({ error: "Unauthorized: Missing or invalid Authorization header" }, { status: 401 });
    }

    const { files, classId, activityId, section, studentId, accessToken, refreshToken } = await request.json();
    console.log("Request body:", {
      files: files?.map((f: UploadedFile) => ({
        fileName: f.fileName,
        language: f.language,
        codeLength: f.code?.length,
      })),
      classId,
      activityId,
      section,
      studentId,
      accessToken: accessToken?.substring(0, 10) + "...",
      refreshToken: refreshToken?.substring(0, 10) + "...",
    });

    // Validate required fields
    if (!files || !Array.isArray(files) || files.length === 0 || !classId || !activityId || !section || !studentId || !accessToken || !refreshToken) {
      console.error("Missing fields:", {
        files: !!files,
        isArray: Array.isArray(files),
        filesLength: files?.length,
        classId,
        activityId,
        section,
        studentId,
        accessToken: !!accessToken,
        refreshToken: !!refreshToken,
      });
      return NextResponse.json({ error: "Missing required fields or invalid files array" }, { status: 400 });
    }

    // Validate each file object
    const validExtensions = ["py", "c", "cpp", "java"];
    for (const file of files) {
      if (!file.code || !file.fileName || !file.language) {
        console.error("Invalid file object:", file);
        return NextResponse.json({ error: "Each file must have code, fileName, and language" }, { status: 400 });
      }
      const fileExtension = file.fileName.split('.').pop()?.toLowerCase();
      if (!fileExtension || !validExtensions.includes(fileExtension)) {
        console.error("Unsupported file type:", file.fileName);
        return NextResponse.json({ error: `Unsupported file type for ${file.fileName}. Use .py, .c, .cpp, or .java.` }, { status: 400 });
      }
      if (typeof file.code !== "string" || !file.code.trim()) {
        console.error("Empty file content:", file.fileName);
        return NextResponse.json({ error: `File ${file.fileName} is empty` }, { status: 400 });
      }
    }

const fileNames = files.map((f: UploadedFile) => f.fileName);
const uniqueFileNames = new Set(fileNames);

if (uniqueFileNames.size !== fileNames.length) {
  console.error("Duplicate file names in request:", fileNames);
  return NextResponse.json(
    { error: "Duplicate file names detected in request" },
    { status: 400 }
  );
}

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Set the session
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

    // Check for existing submissions with the same file names
    const { data: existingSubmissions, error: existingError } = await supabase
      .from("submissions")
      .select("file_name")
      .eq("class_id", classId)
      .eq("activity_id", activityId)
      .eq("student_id", user.id);
    if (existingError) {
      console.error("Error checking existing submissions:", existingError.message);
      return NextResponse.json({ error: "Failed to check existing submissions", details: existingError.message }, { status: 500 });
    }
    const existingFileNames = existingSubmissions?.map((sub) => sub.file_name) || [];
    const duplicates = fileNames.filter((name) => existingFileNames.includes(name));
    if (duplicates.length > 0) {
      console.error("Files already submitted:", duplicates);
      return NextResponse.json({ error: `Files already submitted: ${duplicates.join(", ")}` }, { status: 400 });
    }

    // Upload files and insert submissions
    const languageMap: { [key: string]: string } = {
      py: "python",
      cpp: "cpp",
      c: "c",
      java: "java",
    };
    const submissionRecords = [];
    const uploadedFiles = [];

    for (const file of files) {
      const fileExtension = file.fileName.split('.').pop()?.toLowerCase();
      const fullLanguage = languageMap[fileExtension!] || fileExtension!;
      const timestamp = Date.now();
      const safeFileName = `${file.fileName.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".")}-${timestamp}.${fileExtension}`;
      const filePath = `submissions/${section}/${user.id}/${activityId}/${safeFileName}`;
      console.log("Storage upload path:", filePath, "User ID:", user.id);

      const codeString = typeof file.code === "string" ? file.code : JSON.stringify(file.code);
      const blob = new Blob([codeString], { type: "text/plain" });

      console.log("Attempting storage upload for:", filePath, "with Blob size:", blob.size);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(filePath, blob, { contentType: "text/plain", upsert: true });
      if (uploadError) {
        console.error("Storage upload error for:", file.fileName, uploadError.message, "Details:", (uploadError as SupabaseStorageError)?.details ?? "N/A");
        return NextResponse.json(
          {
            error: `Failed to upload file ${file.fileName} to storage`,
            details: uploadError.message,
            fullDetails: (uploadError as SupabaseStorageError)?.details ?? "N/A",
          },
          { status: 500 }
        );
      }

      console.log("Storage upload successful for:", uploadData.path);
      uploadedFiles.push(uploadData.path);

      submissionRecords.push({
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
      });
    }

    // Insert all submissions in a single transaction
    console.log("Attempting database insert for submissions:", submissionRecords);
    const { error: insertError, data: insertData } = await supabase.from("submissions").insert(submissionRecords).select();
    if (insertError) {
      console.error("Database insert error:", insertError.message, "Details:", insertError.details, "Code:", insertError.code);
      // Roll back uploaded files if database insert fails
      for (const filePath of uploadedFiles) {
        await supabase.storage.from("submissions").remove([filePath]);
        console.log("Rolled back file:", filePath);
      }
      return NextResponse.json(
        {
          error: "Failed to insert submissions into database",
          details: insertError.message,
          code: insertError.code,
          fullDetails: insertError.details,
        },
        { status: 500 }
      );
    }

    console.log("Submissions recorded successfully:", insertData);
    return NextResponse.json({ message: "All submissions uploaded and recorded", data: insertData }, { status: 200 });
  } catch (err) {
    console.error("API error:", err instanceof Error ? err.message : err, err instanceof Error ? err.stack : "");
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
