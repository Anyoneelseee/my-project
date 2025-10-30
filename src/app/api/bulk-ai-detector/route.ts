// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";
import { getCachedAI, setCachedAI } from "@/utils/cache";

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
        // Check cache
        const cached = await getCachedAI<{ ai_percentage: number }>(code);
        if (cached) {
          console.log(`Cache HIT for file ${index + 1}`);
          return { ai_percentage: cached.ai_percentage, error: null, cached: true };
        }

        console.log(`Cache MISS for file ${index + 1}`);

        // Call AI detector
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
          const ai_percentage = result.ai_percentage || 0;

          // Cache result
          await setCachedAI(code, { ai_percentage });

          return { ai_percentage, error: null, cached: false };
        } catch (err) {
          return {
            ai_percentage: null,
            error: err instanceof Error ? err.message : "Unknown error",
            cached: false,
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