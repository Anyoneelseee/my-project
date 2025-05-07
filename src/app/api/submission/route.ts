import { NextResponse } from "next/server";

const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_HOST = "judge0-ce.p.rapidapi.com";

export async function POST(request: Request) {
  try {
    if (!JUDGE0_API_KEY) {
      throw new Error("Judge0 API key is not configured");
    }
    const { source_code, language_id, stdin } = await request.json();

    if (!source_code || !language_id) {
      throw new Error("Source code and language ID are required");
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
        language_id,
        stdin: stdin || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Judge0 submission failed: ${response.statusText}`);
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
  try {
    if (!JUDGE0_API_KEY) {
      throw new Error("Judge0 API key is not configured");
    }
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      throw new Error("Token is required");
    }

    const response = await fetch(`https://${JUDGE0_HOST}/submissions/${token}?base64_encoded=false`, {
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_HOST,
      },
    });

    if (!response.ok) {
      throw new Error(`Judge0 polling failed: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}