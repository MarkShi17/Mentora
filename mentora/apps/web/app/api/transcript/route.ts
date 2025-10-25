import { NextResponse } from "next/server";
import { mockTranscripts } from "@/lib/mock-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const transcript = (sessionId && mockTranscripts[sessionId]) ?? "";

  return NextResponse.json({
    sessionId,
    transcript
  });
}
