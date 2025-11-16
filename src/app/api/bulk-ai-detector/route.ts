// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";

const FASTAPI_URL = "http://localhost:8000/api/bulk-ai-detector";

export async function POST(request: Request) {
  try {
    const { codes } = await request.json();

    // Validate: must be array of strings
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return NextResponse.json(
        { error: "Provide 1-10 code snippets" },
        { status: 400 }
      );
    }

    // Transform: [{ code: "..." }, ...] → FastAPI expects this
    const payload = codes.map((code: string) => ({ code }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(FASTAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // ← CORRECT
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`FastAPI ${response.status}: ${txt}`);
    }

    const data = await response.json();
    return NextResponse.json(data.results); // ← Return results array
  } catch (error) {
    console.error("Bulk AI Detector error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;