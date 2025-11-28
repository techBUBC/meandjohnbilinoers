import { NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { runAssistant } from "@/lib/ai";
import { executeActions } from "@/lib/assistant/dispatcher";
import type { AssistantContext } from "@/lib/assistant/types";

dayjs.extend(utc);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input: string = (body.input || "").trim();
    if (!input) {
      return NextResponse.json({ success: false, messages: ["[x] Empty command."] });
    }
    const now = dayjs();
    const ctx: AssistantContext = {
      timezone: body?.timezone || "America/New_York",
      todayIso: now.startOf("day").toISOString(),
      nowIso: now.toISOString(),
    };
    const assistantResponse = await runAssistant(input, ctx, "");
    const assistantUserId = process.env.ASSISTANT_USER_ID ?? null;
    await executeActions(assistantResponse, {
      userEmail: body?.userEmail ?? null,
      userId: assistantUserId,
    });

    const messages = [`> ${input}`, `Actions executed: ${(assistantResponse.actions ?? []).length}`];
    return NextResponse.json({ success: true, messages, actions: assistantResponse.actions ?? [] });
  } catch (err: any) {
    console.error("Command handler error", err);
    return NextResponse.json(
      { success: false, messages: [err?.message ?? "unknown error"] },
      { status: 500 }
    );
  }
}
