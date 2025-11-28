import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTasks, updateTasks, deleteTasks, deleteAllTasks } from "@/lib/tasks";
import type { AssistantTaskInput } from "@/lib/assistant/types";

export async function GET() {
  try {
    const tasks = await listTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("GET /api/tasks failed", err);
    return NextResponse.json({ tasks: [], error: "tasks_fetch_failed" }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };
    const userId: string = body?.userId || body?.userEmail || "local-dev-user";

    switch (action) {
      case "create": {
        const tasks = (body.tasks ?? []) as AssistantTaskInput[];
        const created = await createTasks(userId, tasks);
        return NextResponse.json({ ok: true, created });
      }
      case "update": {
        await updateTasks(body.updates ?? []);
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        if (body.all) {
          await deleteAllTasks(userId);
        } else if (Array.isArray(body.ids) && body.ids.length) {
          await deleteTasks(body.ids);
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (err) {
    console.error("POST /api/tasks failed", err);
    return NextResponse.json({ error: "tasks_failed" }, { status: 500 });
  }
}
