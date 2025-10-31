// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";
import { getCachedAI, setCachedAI } from "@/utils/cache";

const AI_DETECTOR_URL = process.env.NEXT_PUBLIC_AI_DETECTOR_URL;

export async function POST(request: Request) {
  if (!AI_DETECTOR_URL) {
    return NextResponse.json(
      { error: "AI detector URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const { codes } = await request.json();
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return NextResponse.json(
        { error: "Invalid input: Provide 1-10 code snippets" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      codes.map(async (code: string, index: number) => {
        const fileNum = index + 1;
        const cached = await getCachedAI<{ ai_percentage: number }>(code);
        if (cached) {
          console.log(`Cache HIT for file ${fileNum}`);
          return { ai_percentage: cached.ai_percentage, error: null, cached: true };
        }

        console.log(`Cache MISS for file ${fileNum}`);

        try {
          const response = await fetch(AI_DETECTOR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
            signal: AbortSignal.timeout?.(15000),
          });

          if (!response.ok) {
            const txt = await response.text();
            throw new Error(`HTTP ${response.status}: ${txt}`);
          }

          const data = await response.json();
          const ai_percentage = Number(data.ai_percentage ?? 0);

          if (isNaN(ai_percentage)) throw new Error("Invalid ai_percentage");

          await setCachedAI(code, { ai_percentage });

          return { ai_percentage, error: null, cached: false };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.warn(`AI detection failed for file ${fileNum}:`, msg);
          return {
            ai_percentage: null,
            error: `AI check failed: ${msg}`,
            cached: false,
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Bulk AI Detector error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// This line is optional but RECOMMENDED
export const maxDuration = 30; // 30 seconds