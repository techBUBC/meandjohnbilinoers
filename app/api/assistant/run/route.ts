import { NextResponse } from "next/server";
import { runAssistantBrain } from "@/lib/assistant/brain";

export async function POST(req: Request) {
  const body = await req.json();
  const { inputText, timezone, userEmail } = body;

  const assistantUserId = process.env.ASSISTANT_USER_ID ?? null;
  const { logLines, actions } = await runAssistantBrain({
    text: inputText,
    timezone,
    userEmail,
    userId: assistantUserId,
    source: "console",
  });

  return NextResponse.json({ logLines, actions });
}
