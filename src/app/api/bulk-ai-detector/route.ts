// src/app/api/bulk-ai-detector/route.ts
import { NextResponse } from "next/server";

const BULK_AI_URL = "http://localhost:8000/api/bulk-ai-detector";

export async function POST(request: Request) {
  try {
    const { codes } = await request.json();
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return NextResponse.json(
        { error: "Provide 1-10 code snippets" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      codes.map(async (code: string, index: number) => {
        const fileNum = index + 1;
        console.log(`AI check for file ${fileNum} (no cache)`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s

        const response = await fetch(BULK_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ code }]), // ← List[CodeInput]
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const txt = await response.text();
          throw new Error(`HTTP ${response.status}: ${txt}`);
        }

        const data = await response.json();
        const ai_percentage = Number(data[0]?.ai_percentage ?? 0);

        if (isNaN(ai_percentage)) {
          throw new Error("Invalid ai_percentage from detector");
        }

        return {
          ai_percentage,
          error: null,
          cached: false, // ← always false
        };
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

export const maxDuration = 30;