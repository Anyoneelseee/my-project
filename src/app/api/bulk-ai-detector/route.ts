// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_AI_DETECTOR_URL) {
    return NextResponse.json({ error: "AI detector URL is not configured" }, { status: 500 });
  }

  try {
    const { codes } = await request.json();
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return NextResponse.json({ error: "Invalid input: Provide 1-10 code snippets" }, { status: 400 });
    }

    const results = await Promise.all(
      codes.map(async (code: string, index: number) => {
        try {
          const response = await fetch(process.env.NEXT_PUBLIC_AI_DETECTOR_URL!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            throw new Error(`AI detection failed for file ${index + 1}: ${response.statusText}`);
          }

          const result = await response.json();
          return { ai_percentage: result.ai_percentage || 0, error: null };
        } catch (err) {
          return {
            ai_percentage: null,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Bulk AI Detector error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}