import os from "os";
import { NextResponse } from "next/server";
import { runAssistantBrain } from "@/lib/assistant/brain";

// NOTE: In local dev, this route is used by a macOS Shortcuts + Siri workflow
// pointing at http://localhost:3000/api/assistant/command.
// For production, add auth / secrets before exposing publicly.

type AssistantCommandRequest = {
  text: string;
  source?: "pwa" | "siri" | string;
  userId?: string;
  metadata?: Record<string, any>;
};

function stripEmojisForSiri(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
}

function stripIcons(line: string): string {
  return line
    .replace(/📅/g, "")
    .replace(/✅/g, "")
    .trim();
}

function buildSpeechReply(logLines: string[], source: string): string {
  if (!logLines || logLines.length === 0) {
    return "Okay, I processed that, but there was nothing to do.";
  }

  if (source === "siri") {
    const cleaned = logLines
      .filter(
        (line) =>
          !line.toLowerCase().includes("unsupported action") &&
          !line.toLowerCase().includes("[error]")
      )
      .slice(-3)
      .map((line) =>
        stripIcons(line.replace(/^> /, "").replace(/^\[assistant\]\s*/i, ""))
      )
      .filter((line) => line.length > 0);

    const reply = cleaned.join(". ");
    return reply || "Got it, I’ve updated your schedule.";
  }

  return logLines.join(os.EOL);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AssistantCommandRequest;
    const text = body.text?.trim();
    const source = body.source ?? "unknown";

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const assistantUserId = process.env.ASSISTANT_USER_ID ?? null;
    const { logLines, actions } = await runAssistantBrain({
      text,
      timezone: "America/New_York",
      userEmail: null,
      userId: assistantUserId,
      source,
    });

    const rawReply = buildSpeechReply(logLines, source);
    const reply = source === "siri" ? stripEmojisForSiri(rawReply) : rawReply;

    return NextResponse.json({
      reply,
      debug: {
        actions,
      },
    });
  } catch (err) {
    console.error("[assistant/command] error", err);
    return NextResponse.json({ error: "Assistant error" }, { status: 500 });
  }
}
