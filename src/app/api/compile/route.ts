/*import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const COMPILER_SERVER_URL = process.env.NEXT_PUBLIC_COMPILER_SERVER_URL || 'http://172.207.80.45:3001';

export async function POST(req: NextRequest) {
  try {
    const { code, language, input } = await req.json(); // Extract input from the request
    const response = await axios.post(`${COMPILER_SERVER_URL}/compile`, {
      code,
      language,
      input, // Pass input to the compiler server
    });
    return NextResponse.json(response.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Compilation failed', "details": errorMessage },
      { status: 500 }
    );
  }
}*/