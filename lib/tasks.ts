import { createServerClient } from "@/lib/supabase/server";
import type { AssistantTaskInput, NormalizedTaskInput, TaskPriority } from "./assistant/types";

export type TaskStatus = "open" | "done";

export interface TaskRecord {
  id: string;
  user_id?: string | null;
  title: string;
  description: string | null;
  focus: string | null;
  owner: string | null;
  priority: TaskPriority | null;
  estimated_minutes?: number | null;
  location?: string | null;
  due_date?: string | null;
  area?: string | null;
  project_id?: string | null;
  task_type?: "anytime" | "day_task" | string | null;
  source_capture_id?: string | null;
  source?: "ai" | "user";
  created_at: string;
  updated_at: string;
  status?: TaskStatus | string | null;
}

const TABLE = "tasks";

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function listTasks(): Promise<TaskRecord[]> {
  const supabase = createServerClient();
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      throw error;
    }
    return (data as TaskRecord[]) ?? [];
  } catch (err) {
    console.error("[tasks] error fetching tasks:", err);
    return [];
  }
}

export type TaskFilter = {
  focus?: string | null;
  fromDate?: string | null; // YYYY-MM-DD
  toDate?: string | null;   // YYYY-MM-DD
  status?: string | null;
};

export async function listTasksWithFilter(
  userId: string,
  filter: TaskFilter
): Promise<TaskRecord[]> {
  const supabase = createServerClient();
  let query = supabase.from(TABLE).select("*").eq("user_id", userId);

  if (filter.fromDate) {
    query = query.gte("due_date", filter.fromDate);
  }
  if (filter.toDate) {
    query = query.lte("due_date", filter.toDate);
  }
  if (filter.status) {
    query = query.eq("status", filter.status);
  }
  if (filter.focus) {
    query = query.eq("focus", filter.focus);
  }

  const { data, error } = await query.order("due_date", { ascending: true });
  if (error) {
    console.error("[tasks] listTasksWithFilter error:", error);
    throw error;
  }
  return (data as TaskRecord[]) ?? [];
}

export async function createTasks(
  userId: string | null,
  tasks: (AssistantTaskInput | NormalizedTaskInput)[]
): Promise<TaskRecord[]> {
  if (!tasks.length) return [];
  if (!isUuid(userId)) {
    throw new Error("Assistant userId is not configured (ASSISTANT_USER_ID missing or invalid).");
  }
  const supabase = createServerClient();
  const rows = tasks.map((t) => {
    const rawDue =
      (t as NormalizedTaskInput).due_date_iso ??
      (t as any).due_date ??
      (t as any).due ??
      null;
    const due_date = rawDue ? String(rawDue).slice(0, 10) : null;
    const task_type =
      (t as NormalizedTaskInput).task_type ??
      (due_date ? "day_task" : "anytime");
    return {
      user_id: userId,
      title: t.title,
      description: (t as any).notes ?? (t as NormalizedTaskInput).description ?? null,
      focus: (t as any).focus ?? "General",
      priority: (t.priority as TaskPriority | null) ?? "medium",
      due_date,
      task_type,
      status: "todo",
      area: (t as NormalizedTaskInput).area ?? null,
    };
  });
  console.log("[tasks] createTasks rows:", rows);
  const { data, error } = await supabase.from(TABLE).insert(rows).select("*");
  console.log("[tasks] createTasks result:", { data, error });
  if (error) {
    console.error("[tasks] createTasks:", error);
    throw error;
  }
  return (data as TaskRecord[]) ?? [];
}

export async function updateTasks(
  tasks: { id: string; fields: Partial<AssistantTaskInput> }[]
): Promise<number> {
  if (!tasks.length) return 0;
  const supabase = createServerClient();
  for (const task of tasks) {
    const updatePayload: Record<string, unknown> = {};
    if (task.fields.title !== undefined) updatePayload.title = task.fields.title;
    if (task.fields.notes !== undefined) updatePayload.description = task.fields.notes ?? null;
    if (task.fields.priority !== undefined) updatePayload.priority = task.fields.priority ?? null;
    if (task.fields.estimatedMinutes !== undefined) {
      updatePayload.estimated_minutes = task.fields.estimatedMinutes ?? null;
    }
    if ((task.fields as any).due_date_iso !== undefined) {
      updatePayload.due_date = (task.fields as any).due_date_iso ?? null;
    }
    if ((task.fields as any).area !== undefined) {
      updatePayload.area = (task.fields as any).area ?? null;
    }
    if (!Object.keys(updatePayload).length) {
      continue;
    }
    console.log("[tasks] updateTasks input:", { id: task.id, updatePayload });
    const { error } = await supabase
      .from(TABLE)
      .update(updatePayload)
      .eq("id", task.id);
    if (error) {
      console.error("[tasks] updateTasks:", task, error);
      throw error;
    }
  }
  console.log("[tasks] updateTasks result:", { updated: tasks.length });
  return tasks.length;
}

export async function deleteTasks(taskIds: string[]): Promise<number> {
  if (!taskIds?.length) return 0;
  const supabase = createServerClient();
  console.log("[tasks] deleteTasks input:", taskIds);
  const { error } = await supabase.from(TABLE).delete().in("id", taskIds);
  if (error) {
    console.error("[tasks] deleteTasks:", error);
    throw error;
  }
  console.log("[tasks] deleteTasks result:", { deleted: taskIds.length });
  return taskIds.length;
}

export async function deleteAllTasks(userId: string | null) {
  const supabase = createServerClient();
  const query = supabase.from(TABLE).delete();
  if (userId) {
    query.eq("user_id", userId);
  }
  const { error, count, data } = await query.select("id", { count: "exact" });
  if (error) throw error;
  return count ?? (data?.length ?? 0);
}

export async function updateTaskTypeByTitle(params: {
  userId: string;
  title: string;
  taskType: "anytime" | "day_task";
  dateIso?: string;
}): Promise<number> {
  const supabase = createServerClient();
  const updatePayload: Record<string, unknown> = {
    task_type: params.taskType,
  };
  if (params.taskType === "day_task") {
    updatePayload.due_date = params.dateIso ? new Date(params.dateIso).toISOString() : null;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq("user_id", params.userId)
    .ilike("title", `%${params.title}%`)
    .select("id");
  if (error) {
    console.error("[tasks] updateTaskTypeByTitle error:", error);
    throw error;
  }
  return data?.length ?? 0;
}

export async function assignTasksToProjectByTitles(params: {
  userId: string;
  projectId: string;
  titles?: string[];
}): Promise<number> {
  const supabase = createServerClient();
  if (!params.titles?.length) return 0;
  let total = 0;
  for (const title of params.titles) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ project_id: params.projectId })
      .eq("user_id", params.userId)
      .ilike("title", `%${title}%`)
      .select("id");
    if (error) {
      console.error("[tasks] assignTasksToProjectByTitles error:", error);
      throw error;
    }
    total += data?.length ?? 0;
  }
  return total;
}
