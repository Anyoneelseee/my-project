import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Get Authorization header
    const authHeader = request.headers.get("Authorization");
    console.log("Auth Header:", authHeader ? "Present" : "Missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = authHeader.split(" ")[1];

    // Initialize Supabase client with access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    // Verify session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User:", user ? user.id : "Not found", "User Error:", userError?.message);
    if (userError || !user) {
      console.error("User fetch error:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { code, classId, language, fileName } = await request.json();
    console.log("Request body:", { code: code ? "Present" : "Missing", classId, language, fileName });
    if (!code || !classId || !language) {
      console.error("Missing fields:", { code, classId, language, fileName });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Define type for section query result
    type SectionResult = {
      section: string | null;
      error_message: string | null;
    };

    // Fetch section using RPC
    const { data: sectionData, error: sectionError } = await supabase
      .rpc("get_student_class_section", {
        class_id_input: classId,
        student_id_input: user.id,
      });

    console.log("Section RPC result:", sectionData, "Error:", sectionError, "Class ID:", classId, "User ID:", user.id);

    if (sectionError) {
      console.error("Section fetch error:", sectionError.message);
      return NextResponse.json({ error: "Failed to fetch class information" }, { status: 500 });
    }

    const result: SectionResult = Array.isArray(sectionData) && sectionData.length > 0
      ? sectionData[0]
      : { section: null, error_message: "No data returned" };

    if (!result.section || result.error_message) {
      console.error("No section found for class:", classId, "Error:", result.error_message);
      return NextResponse.json({ error: result.error_message || "Not enrolled in class" }, { status: 403 });
    }

    const section = result.section;

    // Generate file path
    const timestamp = Date.now();
    const extension = language;
    const safeFileName = fileName
      ? fileName.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".")
      : `submission-${timestamp}.${extension}`;
    const filePath = `submissions/${section}/${user.id}/${safeFileName}`;

    console.log("Uploading to:", filePath, "User ID:", user.id, "Section:", section);

    // Ensure code is a string and create Blob
    const codeString = typeof code === "string" ? code : JSON.stringify(code);
    const blob = new Blob([codeString], { type: "text/plain" });

    // Upload code to submissions bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, blob, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError.message, "Details:", JSON.stringify(uploadError, null, 2));
      return NextResponse.json(
        { error: "Failed to upload submission", details: uploadError.message },
        { status: 500 }
      );
    }

    console.log("Upload successful:", uploadData, "Path:", filePath);
    return NextResponse.json({ message: "Submission uploaded successfully" }, { status: 200 });
  } catch (err) {
    console.error("API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}