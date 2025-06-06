import { NextResponse } from "next/server";

const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_HOST = "judge0-ce.p.rapidapi.com";

// Supported language IDs (optional, for validation)
const SUPPORTED_LANGUAGE_IDS = new Set([50, 54, 62, 71]); // C, C++, Java, Python 3

export async function POST(request: Request) {
  if (!JUDGE0_API_KEY) {
    return NextResponse.json({ error: "Judge0 API key is not configured" }, { status: 500 });
  }

  try {
    const { source_code, language_id, stdin } = await request.json();

    if (!source_code || !language_id) {
      return NextResponse.json({ error: "Source code and language ID are required" }, { status: 400 });
    }

    if (!SUPPORTED_LANGUAGE_IDS.has(Number(language_id))) {
      return NextResponse.json({ error: "Unsupported language ID" }, { status: 400 });
    }

    const response = await fetch(`https://${JUDGE0_HOST}/submissions?base64_encoded=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_HOST,
      },
      body: JSON.stringify({
        source_code,
        language_id: Number(language_id),
        stdin: stdin || "",
      }),
      signal: AbortSignal.timeout(10000), // 10-second timeout
    });

    if (!response.ok) {
      // Pass through 429 status for rate limiting
      return NextResponse.json(await response.json(), { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!JUDGE0_API_KEY) {
    return NextResponse.json({ error: "Judge0 API key is not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const response = await fetch(`https://${JUDGE0_HOST}/submissions/${token}?base64_encoded=false`, {
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_HOST,
      },
      signal: AbortSignal.timeout(10000), // 10-second timeout
    });

    if (!response.ok) {
      return NextResponse.json(await response.json(), { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}