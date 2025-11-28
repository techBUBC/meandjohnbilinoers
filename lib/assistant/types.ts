export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled" | string | null;
export type TaskKind = "backlog" | "day";
export type TaskType = "anytime" | "day_task" | string | null;

export interface NormalizedTaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority | null;
  due_date_iso?: string | null;
  kind?: TaskKind;
  estimated_minutes?: number | null;
  labels?: Record<string, unknown>;
  location?: string | null;
  area?: string | null;
  project_name?: string | null;
  task_type?: TaskType;
}

export interface AssistantTaskInput {
  title: string;
  notes?: string;
  focus?: string | null;
  owner?: string | null;
  priority?: TaskPriority;
  due?: string | null;
  estimatedMinutes?: number | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_date_iso?: string | null;
  estimatedMinutes?: number | null;
  priority?: TaskPriority | null;
  area?: string | null;
  task_type?: TaskType;
  project_name?: string | null;
}

export interface UpdateTasksInput {
  ids?: string[];
  match_title?: string | null;
  area?: string | null;
  project_name?: string | null;
  set?: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority | null;
    status?: TaskStatus | null;
    due_date_iso?: string | null;
    area?: string | null;
    task_type?: TaskType | null;
    project_name?: string | null;
  };
}

export interface ListTasksInput {
  day?: "today" | "tomorrow" | string;
  area?: string | null;
  status?: TaskStatus | null;
  priority?: TaskPriority | null;
  task_type?: TaskType | null;
  project_name?: string | null;
  limit?: number | null;
}

export interface ListedTask {
  id: string;
  title: string;
  description: string | null;
  due_date_iso: string | null;
  priority: TaskPriority | null;
  status: TaskStatus | null;
  area: string | null;
  task_type: TaskType;
  project_name: string | null;
}

export interface AssistantEventInput {
  title: string;
  startIso: string;
  endIso: string;
  location?: string;
  description?: string;
  assumptions?: Record<string, string>;
}

export interface AssistantEmailInput {
  to?: string;
  subject?: string;
  body?: string;
  instructions?: string;
  threadId?: string;
  messageId?: string;
}

export type AssistantAction =
  | { type: "create_tasks"; tasks: NormalizedTaskInput[] }
  | { type: "update_tasks"; updates: UpdateTasksInput }
  | { type: "list_tasks"; query: ListTasksInput }
  | { type: "list_events"; day?: string; range?: { startIso?: string; endIso?: string } }
  | {
      type: "update_task";
      task: { id: string; fields: Partial<AssistantTaskInput> };
    }
  | { type: "delete_task"; taskId?: string; all?: boolean }
  | { type: "delete_tasks"; task_ids?: string[]; query?: string; delete_all?: boolean }
  | { type: "create_events"; events: AssistantEventInput[] }
  | { type: "delete_event"; eventId: string }
  | { type: "delete_events"; event_ids?: string[]; query?: string }
  | { type: "move_event"; query: string; new_start_iso?: string; shift_minutes?: number }
  | {
      type: "create_project";
      name: string;
      area?: string | null;
    }
  | {
      type: "assign_tasks_to_project";
      project_name: string;
      task_titles?: string[];
      area?: string;
    }
  | {
      type: "archive_project";
      name: string;
    }
  | {
      type: "update_task_type";
      task_title: string;
      task_type: "anytime" | "day_task";
      date_iso?: string;
    }
  | {
      type: "display";
      mode: "day" | "week" | "now";
      range?: { startIso?: string; endIso?: string };
    }
  | { type: "send_email"; email: AssistantEmailInput }
  | { type: "draft_reply"; email: AssistantEmailInput }
  | { type: "plan_day"; date_iso?: string }
  | { type: "plan_week"; start_date_iso?: string; end_date_iso?: string };

export interface AssistantContext {
  timezone: string;
  todayIso: string;
  nowIso: string;
}

export interface AssistantResult {
  actions: AssistantAction[];
  logLines: string[];
  actionOutputs?: Record<string, unknown>;
}
