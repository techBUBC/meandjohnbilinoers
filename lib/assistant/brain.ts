import dayjs from "dayjs";
import { runAssistant } from "../ai";
import { executeActions } from "./dispatcher";
import type { AssistantAction } from "./types";

export type BrainInput = {
  text: string;
  timezone?: string;
  userEmail?: string | null;
  userId?: string | null;
  source?: string;
};

export type BrainOutput = {
  actions: AssistantAction[];
  logLines: string[];
};

export async function runAssistantBrain(input: BrainInput): Promise<BrainOutput> {
  const { text, timezone = "America/New_York", userEmail, userId, source } = input;

  const now = dayjs();
  const context = {
    timezone,
    todayIso: now.format("YYYY-MM-DD"),
    nowIso: now.toISOString(),
  };

  const result = await runAssistant(text, context, source);

  const logLines = await executeActions(result, {
    userEmail: userEmail ?? null,
    userId: userId ?? null,
  });

  return {
    actions: result.actions,
    logLines,
  };
}
