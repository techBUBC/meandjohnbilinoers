import { createServerClient } from "@/lib/supabase/server";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType = "anytime" | "day_task" | null;

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  due_date_iso?: string | null;
  estimatedMinutes?: number | null;
  priority?: TaskPriority | null;
  area?: string | null;
  task_type?: TaskType;
  project_id?: string | null;
};

export async function createTasks(opts: { userId: string; tasks: CreateTaskInput[] }) {
  const supabase = createServerClient();
  const rows = opts.tasks.map((t) => ({
    user_id: opts.userId,
    title: t.title,
    description: t.description ?? null,
    due_date: t.due_date_iso ? t.due_date_iso.slice(0, 10) : null,
    estimated_minutes: t.estimatedMinutes ?? null,
    priority: t.priority ?? "medium",
    status: "todo",
    area: t.area ?? null,
    task_type: t.task_type ?? null,
    project_id: t.project_id ?? null,
  }));

  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function listTasks(opts: {
  userId: string;
  status?: TaskStatus | "any";
  area?: string | null;
  dueOnOrBefore?: string | null;
}) {
  const supabase = createServerClient();
  let query = supabase.from("tasks").select("*").eq("user_id", opts.userId);
  if (opts.status && opts.status !== "any") {
    query = query.eq("status", opts.status);
  }
  if (opts.area) {
    query = query.eq("area", opts.area);
  }
  if (opts.dueOnOrBefore) {
    query = query.lte("due_date", opts.dueOnOrBefore);
  }
  const { data, error } = await query.order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTasks(opts: {
  userId: string;
  ids: string[];
  patch: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus | null;
    priority: TaskPriority | null;
    area: string | null;
    due_date_iso: string | null;
    task_type: TaskType;
    project_id: string | null;
  }>;
}) {
  const supabase = createServerClient();
  const patch: any = {};
  if (opts.patch.title !== undefined) patch.title = opts.patch.title;
  if (opts.patch.description !== undefined) patch.description = opts.patch.description;
  if (opts.patch.status !== undefined) patch.status = opts.patch.status;
  if (opts.patch.priority !== undefined) patch.priority = opts.patch.priority;
  if (opts.patch.area !== undefined) patch.area = opts.patch.area;
  if (opts.patch.task_type !== undefined) patch.task_type = opts.patch.task_type;
  if (opts.patch.project_id !== undefined) patch.project_id = opts.patch.project_id;
  if (opts.patch.due_date_iso !== undefined) {
    patch.due_date = opts.patch.due_date_iso ? opts.patch.due_date_iso.slice(0, 10) : null;
  }
  if (Object.keys(patch).length === 0) return [];

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("user_id", opts.userId)
    .in("id", opts.ids)
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function deleteTasks(opts: { userId: string; ids: string[] }) {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("user_id", opts.userId)
    .in("id", opts.ids);
  if (error) throw error;
  return count ?? 0;
}
