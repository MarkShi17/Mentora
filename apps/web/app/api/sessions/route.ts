import { NextResponse } from "next/server";
import { mockSessions, mockTimeline } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    sessions: mockSessions,
    timeline: mockTimeline
  });
}
