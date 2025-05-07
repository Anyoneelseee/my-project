import { BlobServiceClient } from "@azure/storage-blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, classId, language } = await req.json();
    console.log("Request body:", { codeLength: code.length, classId, language });

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    console.log("Connection string:", connectionString ? "Set" : "Not set");

    if (!connectionString) {
      console.error("Azure configuration missing");
      return NextResponse.json({ error: "Azure configuration missing" }, { status: 500 });
    }

    const containerName = "student-submissions";
    const extension = language === "javascript" ? "js" : language === "python" ? "py" : "cpp";
    const fileName = `submissions/${classId}/${Date.now()}-${language}.${extension}`;
    console.log("Generated fileName:", fileName);

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    console.log("Attempting to create container if not exists:", containerName);
    await containerClient.createIfNotExists();
    console.log("Container ready");

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    console.log("Uploading to Azure:", fileName);
    await blockBlobClient.uploadData(Buffer.from(code));
    console.log("Upload complete");

    return NextResponse.json({ message: "Code submitted successfully", fileName }, { status: 200 });
  } catch (error) {
    console.error("Submit API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}