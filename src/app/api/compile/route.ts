import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json();
    const response = await axios.post('https://1985-172-207-80-45.ngrok-free.app/compile', {
      code,
      language,
    });
    return NextResponse.json(response.data);
  } catch (error) {
    // Assert error as an Error type to access .message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Compilation failed', details: errorMessage },
      { status: 500 }
    );
  }
}