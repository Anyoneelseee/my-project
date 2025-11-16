// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.NEXT_PUBLIC_AI_DETECTOR_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const { codes } = await request.json();

    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return NextResponse.json(
        { error: "Provide 1-10 code snippets" },
        { status: 400 }
      );
    }

    const payload = codes.map((code: string) => ({ code }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    // Correct: Append endpoint here
    const response = await fetch(`${FASTAPI_URL}/api/bulk-ai-detector`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`FastAPI ${response.status}: ${txt}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI Detector error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;