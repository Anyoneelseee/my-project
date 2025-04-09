import { BlobServiceClient } from "@azure/storage-blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, classId, language } = await req.json();
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
      return NextResponse.json({ error: "Azure configuration missing" }, { status: 500 });
    }

    const containerName = "student-submissions";
    const extension = language === "javascript" ? "js" : language === "python" ? "py" : "cpp";
    const fileName = `submissions/${classId}/${Date.now()}-${language}.${extension}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(Buffer.from(code));

    return NextResponse.json({ message: "Code submitted successfully", fileName }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}