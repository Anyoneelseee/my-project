import { BlobServiceClient, BlobDownloadResponseParsed } from "@azure/storage-blob";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream"; // Node.js Readable stream

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString || !fileName) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const containerName = "student-submissions";
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    const downloadResponse: BlobDownloadResponseParsed = await blockBlobClient.download(0);
    // Explicitly assert the type as Readable | undefined since this is Node.js
    const content = await streamToBuffer(downloadResponse.readableStreamBody as Readable | undefined);

    return NextResponse.json({ code: content.toString("utf8") }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

async function streamToBuffer(readable: Readable | undefined): Promise<Buffer> {
  if (!readable) return Buffer.from(""); // Handle undefined case

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", (err) => reject(err));
  });
}