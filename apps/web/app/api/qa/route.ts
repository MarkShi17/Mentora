import { NextResponse } from "next/server";

type QaRequest = {
  sessionId: string;
  prompt: string;
  highlights?: string[];
};

export async function POST(request: Request) {
  const payload = (await request.json()) as QaRequest;
  const trimmedPrompt = payload.prompt.trim();
  const highlightSummary =
    payload.highlights && payload.highlights.length > 0
      ? ` I considered highlights ${payload.highlights.join(", ")} while composing this response.`
      : "";
  const reply = `Here's a guided explanation building on your prompt: "${trimmedPrompt}".${highlightSummary}`;

  return NextResponse.json({
    reply,
    timelineEvent: {
      description: "Assistant provided synthesized guidance.",
      type: "response"
    }
  });
}
