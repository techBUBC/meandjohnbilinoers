import OpenAI from "openai";
import type { AssistantAction, AssistantContext, AssistantResult } from "./assistant/types";

const hasKey = !!process.env.OPENAI_API_KEY;
const openai = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const DEBUG_ASSISTANT = process.env.NODE_ENV !== "production";

type RawAssistantJson = any;

function coerceString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeAssistantResult(raw: RawAssistantJson): AssistantResult {
  if (DEBUG_ASSISTANT) {
    console.log("[normalizeAssistantResult] raw:", raw);
  }
  const logLines = Array.isArray(raw?.logLines)
    ? raw.logLines.filter((line: unknown) => typeof line === "string")
    : [];

  const actions: AssistantAction[] = [];
  let rawActions: any[] = [];

  if (Array.isArray(raw?.actions) && raw.actions.length > 0) {
    rawActions = raw.actions;
  } else if (raw?.action) {
    rawActions = [{ action: raw.action, parameters: raw.parameters ?? raw.params ?? {} }];
  } else if (raw?.create_tasks) {
    rawActions = [{ action: "create_tasks", parameters: raw.create_tasks }];
  } else if (raw?.create_events) {
    rawActions = [{ action: "create_events", parameters: raw.create_events }];
  }

  for (const item of rawActions) {
    if (!item) continue;
    const actionName = (item.action ?? item.type) as string | undefined;
    const params = item.parameters ?? item.params ?? item;
    switch (actionName) {
      case "create_task":
      case "create_tasks": {
        const tasksInput = Array.isArray(params?.tasks)
          ? params.tasks
          : params?.title
            ? [params]
            : [];
        const normalizedTasks = tasksInput
          .filter((t: any) => t && t.title)
          .map((t: any) => ({
            title: String(t.title),
            notes:
              coerceString(t.notes) ??
              coerceString(t.description) ??
              undefined,
            focus: t.focus ?? t.category ?? null,
            owner: t.owner ?? t.assignee ?? null,
            priority: t.priority ?? null,
            due_date_iso:
              t.due_date_iso ??
              t.due_date ??
              t.due ??
              t.dueAt ??
              null,
            estimatedMinutes: t.estimatedMinutes ?? t.estimated_minutes ?? null,
            area: t.area ?? t.category ?? null,
            project_name: t.project_name ?? t.project ?? null,
            task_type: t.task_type ?? null,
          }));
        if (normalizedTasks.length) {
          actions.push({ type: "create_tasks", tasks: normalizedTasks });
        }
        break;
      }
      case "create_event":
      case "create_events": {
        const eventsInput = Array.isArray(params?.events)
          ? params.events
          : params?.title || params?.summary
            ? [params]
            : [];
        const normalizedEvents = eventsInput
          .filter((e: any) => e && (e.title || e.summary))
          .map((e: any) => ({
            title: String(e.title ?? e.summary),
            description: coerceString(e.description),
            location: coerceString(e.location),
            startIso:
              e.startIso ??
              e.start_iso ??
              e.start ??
              e.start_time ??
              e.startTime ??
              e.start?.dateTime ??
              "",
            endIso:
              e.endIso ??
              e.end_iso ??
              e.end ??
              e.end_time ??
              e.endTime ??
              e.end?.dateTime ??
              "",
            assumptions: typeof e.assumptions === "object" ? e.assumptions : undefined,
          }))
          .filter((evt: any) => evt.startIso && evt.endIso);
        if (normalizedEvents.length) {
          actions.push({ type: "create_events", events: normalizedEvents });
        }
        break;
      }
      case "delete_tasks": {
        actions.push({
          type: "delete_tasks",
          task_ids: params?.task_ids ?? params?.ids,
          query: params?.query ?? params?.title ?? params?.name,
        });
        break;
      }
      case "delete_events": {
        actions.push({
          type: "delete_events",
          event_ids: params?.event_ids ?? params?.ids,
          query: params?.query ?? params?.title ?? params?.name,
        });
        break;
      }
      case "move_event": {
        actions.push({
          type: "move_event",
          query: params?.query ?? params?.title ?? params?.name,
          new_start_iso: params?.new_start_iso ?? params?.start ?? params?.start_time,
          shift_minutes: params?.shift_minutes,
        });
        break;
      }
      case "plan_day": {
        actions.push({ type: "plan_day", date_iso: params?.date_iso ?? params?.date });
        break;
      }
      case "plan_week": {
        actions.push({
          type: "plan_week",
          start_date_iso: params?.start_date_iso ?? params?.start,
          end_date_iso: params?.end_date_iso ?? params?.end,
        });
        break;
      }
      case "update_tasks": {
        actions.push({
          type: "update_tasks",
          where: params?.where,
          patch: params?.patch,
        } as any);
        break;
      }
      case "create_project": {
        actions.push({
          type: "create_project",
          name: params?.name ?? params?.title ?? "",
          area: params?.area ?? null,
        });
        break;
      }
      case "assign_tasks_to_project": {
        actions.push({
          type: "assign_tasks_to_project",
          project_name: params?.project_name ?? params?.project ?? "",
          task_titles: params?.task_titles ?? params?.titles ?? params?.tasks ?? [],
          area: params?.area,
        });
        break;
      }
      case "archive_project": {
        actions.push({
          type: "archive_project",
          name: params?.name ?? params?.project ?? "",
        });
        break;
      }
      case "update_task_type": {
        actions.push({
          type: "update_task_type",
          task_title: params?.task_title ?? params?.title ?? "",
          task_type: params?.task_type ?? params?.type,
          date_iso: params?.date_iso ?? params?.date,
        });
        break;
      }
      default: {
        // Ignore unsupported actions here; dispatcher will log a friendly message.
      }
    }
  }

  if (!actions.length && !logLines.length) {
    logLines.push("Done.");
  }

  if (DEBUG_ASSISTANT) {
    console.log("[normalizeAssistantResult] actions:", actions);
  }

  return { actions, logLines };
}

export async function runAssistant(
  userText: string,
  ctx: AssistantContext,
  extraContextText: string = ""
): Promise<AssistantResult> {
  if (!userText.trim()) {
    return { actions: [], logLines: ["[error] Empty command."] };
  }

  if (!hasKey || !openai) {
    return {
      actions: [],
      logLines: ["[error] Missing OPENAI_API_KEY – assistant is not configured."],
    };
  }

const prompt = `
You are a structured assistant. Reply ONLY with JSON that matches:
{
  "actions": [
    {
      "action": "create_tasks" | "create_events" | "send_email" | "draft_reply" | "plan_day" | "plan_week",
      "parameters": { ... }
    }
  ],
  "logLines": ["string", "string"]
}

You manage three kinds of work:
1) Backlog tasks (flexible day): use create_tasks with kind="backlog" and no due_date_iso.
2) Day tasks (must happen on a specific day, flexible time): use create_tasks with kind="day" and set due_date_iso (e.g., today, tomorrow, next Thursday).
3) Calendar events (fixed time): use create_events with precise start and end times. Do NOT move events unless the user explicitly asks you to.

You can organize tasks by area and project:
- Areas are high-level categories like "business", "personal", "school".
- Projects are folders. Use create_project to create/reuse one, and assign_tasks_to_project to move tasks into it.
- You can archive projects with archive_project.

You can update task types:
- Use update_task_type with "day_task" when the user mentions a specific day; include date_iso.
- Use update_task_type with "anytime" when the task can happen on any day.

You can also delete and move things:
- "delete all tasks" -> use delete_tasks with query="all".
- "delete the task 'X'" -> delete_tasks with a fuzzy query or specific ids.
- "delete dinner with Jasper" -> delete_events with a matching title.
- "move dinner one hour up" or "move my 7pm dinner to 8pm" -> move_event with query and either shift_minutes or new_start_iso.

Planning:
- Use plan_day for "plan my day" or "what's my day look like" (default to today if no date).
- Use plan_week for "plan my week" or "what's next week look like".

Examples:
- "add a task to build admin panel" -> create_tasks backlog.
- "today I need to send payroll" -> create_tasks kind="day" with due_date_iso=today.
- "next Thursday I have to file taxes" -> create_tasks kind="day" with due_date_iso=that date.
- "lunch with Jeremy tomorrow at 12" -> create_events with start/end times.
- "plan my day" -> plan_day action.
- "plan my week" -> plan_week action.

The "source" field tells you where the request came from.
- If source is "pwa", you can return detailed logLines for a text console.
- If source is "siri", keep responses short and speech-friendly (one or two concise sentences).

Do not invent other top-level keys.
Default timezone: ${ctx.timezone}. Default event duration: 60 minutes.
Today is ${ctx.todayIso}. Current time is ${ctx.nowIso}.
Extra context: ${extraContextText || "(none)"}.

User command: ${userText}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a JSON-only command dispatcher for Gmail/Calendar/Tasks. Always return valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });
    if (DEBUG_ASSISTANT) {
      console.log("[assistant] completion summary:", {
        id: completion.id,
        model: completion.model,
        content: completion.choices?.[0]?.message?.content,
      });
    }
    const content = completion.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error("Assistant: unexpected completion shape", completion);
      throw new Error("Assistant response in unexpected format (no string content)");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("Assistant JSON.parse failed:", content);
      throw new Error("Assistant returned non-JSON content");
    }

    return normalizeAssistantResult(parsed);
  } catch (err: any) {
    console.error("[assistant] OpenAI call failed:", err);
    const msg = err?.message ?? String(err);
    return { actions: [], logLines: [`[error] Assistant failed: ${msg}`] };
  }
}
