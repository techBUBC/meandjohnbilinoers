import type { AssistantAction, AssistantResult, NormalizedTaskInput } from "./types";
import {
  updateTasks,
  deleteTasks,
  deleteAllTasks,
  listTasks,
  createTasks,
  listTasksWithFilter,
  TaskRecord,
} from "../tasks";
import { createEvents, deleteEvents, listEventsForRange, updateEventTime } from "../calendar";
import { sendEmail, draftEmailReply } from "../gmail";
import { buildDayPlan } from "./planner";
import dayjs from "dayjs";
import {
  archiveProject,
  createOrGetProject,
  moveTasksToProject,
  getProjectByName,
} from "@/app/lib/projects";
import { assignTasksToProjectByTitles, updateTaskTypeByTitle } from "../tasks";
import { createServerClient } from "@/lib/supabase/server";

export type TaskPriority = "low" | "medium" | "high" | null;
export type TaskType = "anytime" | "day_task";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  area?: string | null;
  focus?: string | null;
  priority?: TaskPriority;
  due_date_iso?: string | null;
  task_type?: TaskType;
  labels?: Record<string, any> | null;
}

export interface DispatchContext {
  userEmail: string | null;
  userId: string | null;
}

export async function executeActions(
  result: AssistantResult,
  ctx: DispatchContext
): Promise<string[]> {
  const logs: string[] = [];
  const actions: AssistantAction[] = result.actions ?? [];
  const supabaseClient = createServerClient();
  const userId = ctx.userId ?? process.env.ASSISTANT_USER_ID ?? null;

  for (const action of actions) {
    console.log("[dispatcher] executing action:", action.type, action);
    try {
      switch (action.type) {
        case "create_tasks": {
          if (!userId) {
            logs.push("[assistant] [error] Missing user for task creation.");
            break;
          }
          const tasks = (action.tasks ?? []) as NormalizedTaskInput[];
          try {
            const created = await createTasks(userId, tasks);
            logs.push(`[assistant] Added ${created.length} task(s).`);
          } catch (err: any) {
            logs.push(
              `[assistant] [error] Action create_tasks failed: ${err?.message ?? JSON.stringify(err)}`
            );
          }
          break;
        }
        case "update_task": {
          if (!action.task?.id) {
            logs.push("[warn] Missing task id for update_task action.");
            break;
          }
          const count = await updateTasks([
            {
              id: action.task.id,
              fields: action.task.fields,
            },
          ]);
          logs.push(`✅ Updated ${count} task(s).`);
          break;
        }
        case "delete_task": {
          if (action.all) {
            const deletedAll = await deleteAllTasks(ctx.userId ?? null);
            logs.push(`[assistant] Deleted all tasks for this user. (${deletedAll})`);
          } else if (action.taskId) {
            const count = await deleteTasks([action.taskId]);
            logs.push(`[assistant] Deleted ${count} task(s).`);
          } else {
            logs.push("[warn] delete_task action missing taskId or all flag.");
          }
          break;
        }
        case "update_tasks": {
          if (!userId) {
            logs.push("[assistant] [error] Missing user for update_tasks.");
            break;
          }
          const { where, patch } = action as any;
          const update: Record<string, any> = {};
          if (typeof patch?.title === "string") update.title = patch.title;
          if (typeof patch?.description === "string") update.description = patch.description;
          if (typeof patch?.area === "string") update.area = patch.area;
          if (typeof patch?.focus === "string") update.focus = patch.focus;
          if (typeof patch?.priority === "string") update.priority = patch.priority;
          if (typeof patch?.status === "string") update.status = patch.status;
          if (typeof patch?.task_type === "string") update.task_type = patch.task_type;
          if (typeof patch?.due_date_iso === "string") update.due_date = patch.due_date_iso;

          if (!Object.keys(update).length) {
            logs.push("[assistant] Unsupported action: update_tasks (empty patch)");
            break;
          }
          if (!where) {
            logs.push("[assistant] Unsupported action: update_tasks (no where)");
            break;
          }

          let query = supabaseClient.from("tasks").update(update).eq("user_id", userId);
          if (where.id) {
            query = query.eq("id", where.id);
          } else if (where.match_title) {
            query = query.ilike("title", `%${where.match_title}%`);
          } else if (where.area) {
            query = query.eq("area", where.area);
          } else {
            logs.push("[assistant] Unsupported action: update_tasks (unsupported where)");
            break;
          }

          const { error, data } = await query.select("id");
          if (error) {
            logs.push(`[assistant] [error] Action update_tasks failed: ${JSON.stringify(error)}`);
          } else {
            logs.push(`[assistant] Updated ${data?.length ?? 0} task(s) matching your request.`);
          }
          break;
        }
        case "delete_tasks": {
          if (!userId) {
            logs.push("[assistant] [error] Missing user for delete_tasks.");
            break;
          }
          const { where } = action as any;
          if (!where) {
            logs.push("[assistant] Unsupported action: delete_tasks (no where clause)");
            break;
          }
          let queryBuilder = supabaseClient.from("tasks").delete().eq("user_id", userId);
          if (where.id) {
            queryBuilder = queryBuilder.eq("id", where.id);
          } else if (where.match_title) {
            queryBuilder = queryBuilder.ilike("title", `%${where.match_title}%`);
          } else if (where.area) {
            queryBuilder = queryBuilder.eq("area", where.area);
          } else {
            logs.push("[assistant] Unsupported action: delete_tasks (unsupported where)");
            break;
          }
          const { error, data } = await queryBuilder.select("id");
          if (error) {
            logs.push(`[assistant] [error] Action delete_tasks failed: ${JSON.stringify(error)}`);
          } else {
            logs.push(`[assistant] Deleted ${data?.length ?? 0} task(s).`);
          }
          break;
        }
        case "list_tasks": {
          if (!userId) {
            logs.push("[assistant] Missing user for list_tasks.");
            break;
          }
          const q = (action as any).query ?? {};
          const filter: any = {
            focus: q.focus ?? null,
            status: q.status ?? null,
          };
          if (q.day === "today") {
            const today = dayjs().format("YYYY-MM-DD");
            filter.fromDate = today;
            filter.toDate = today;
          } else if (q.day === "tomorrow") {
            const date = dayjs().add(1, "day").format("YYYY-MM-DD");
            filter.fromDate = date;
            filter.toDate = date;
          }
          try {
            const tasks = await listTasksWithFilter(userId, filter);
            if (!tasks.length) {
              logs.push("[assistant] No tasks found for that filter.");
            } else {
              logs.push("[assistant] Here are your tasks:");
              tasks.slice(0, 5).forEach((t) => {
                const duePart = t.due_date ? ` (due ${t.due_date})` : "";
                const focusPart = t.focus ? ` [${t.focus}]` : "";
                logs.push(`• ${t.title}${focusPart}${duePart}`);
              });
              if (tasks.length > 5) {
                logs.push(`[assistant] ...and ${tasks.length - 5} more.`);
              }
            }
          } catch (err: any) {
            logs.push(
              `[assistant] [error] Failed to list tasks: ${err?.message ?? String(err)}`
            );
          }
          break;
        }
        case "create_events": {
          const count = await createEvents(action.events ?? []);
          logs.push(`🗓 Created ${count} event(s).`);
          break;
        }
        case "delete_event": {
          const count = await deleteEvents([action.eventId]);
          logs.push(`🗑️ Deleted ${count} event(s).`);
          break;
        }
        case "delete_events": {
          const { event_ids, query } = action;
          let deletedCount = 0;
          if (event_ids?.length) {
            deletedCount = await deleteEvents(event_ids);
          } else if (query) {
            const now = dayjs();
            const start = now.toISOString();
            const end = now.add(30, "day").toISOString();
            const events = await listEventsForRange(ctx.userId, start, end);
            const matches = events.filter((ev) =>
              (ev.title || "").toLowerCase().includes(query.toLowerCase())
            );
            if (matches.length) {
              deletedCount = await deleteEvents(matches.map((m) => m.id!).filter(Boolean));
            }
          }
          if (deletedCount === 0) {
            logs.push("I didn’t find any calendar events to delete.");
          } else if (deletedCount === 1) {
            logs.push("Deleted 1 calendar event.");
          } else {
            logs.push(`Deleted ${deletedCount} calendar events.`);
          }
          break;
        }
        case "move_event": {
          const { query, new_start_iso, shift_minutes } = action as any;
          if (!query) {
            logs.push("I need a description of which event to move.");
            break;
          }
          const now = dayjs();
          const startRange = now.subtract(1, "day").toISOString();
          const endRange = now.add(30, "day").toISOString();
          const events = await listEventsForRange(ctx.userId, startRange, endRange);
          const target = events.find((ev) =>
            (ev.title || "").toLowerCase().includes(String(query).toLowerCase())
          );
          if (!target || !target.id) {
            logs.push("I couldn’t find an event that matches that description.");
            break;
          }
          const oldStart = dayjs(target.start_time);
          const oldEnd = dayjs(target.end_time || target.start_time).add(1, "hour");
          let newStart = oldStart;
          let newEnd = oldEnd;
          if (new_start_iso) {
            newStart = dayjs(new_start_iso);
            const duration = oldEnd.diff(oldStart, "minute");
            newEnd = newStart.add(duration, "minute");
          } else if (typeof shift_minutes === "number") {
            newStart = oldStart.add(shift_minutes, "minute");
            newEnd = oldEnd.add(shift_minutes, "minute");
          }
          await updateEventTime({
            eventId: target.id,
            startIso: newStart.toISOString(),
            endIso: newEnd.toISOString(),
          });
          logs.push(
            `Moved "${target.title}" from ${oldStart.format("h:mm A")} to ${newStart.format(
              "h:mm A"
            )}.`
          );
          break;
        }
        case "display": {
          const rangeLabel = action.range
            ? ` (${action.range.startIso ?? "..."} → ${action.range.endIso ?? "..."})`
            : "";
          logs.push(`📋 Display: ${action.mode}${rangeLabel}`);
          break;
        }
        case "send_email": {
          const id = await sendEmail(action.email, ctx.userEmail ?? undefined);
          logs.push(`📧 Email sent (${id}).`);
          break;
        }
        case "draft_reply": {
          const draft = await draftEmailReply(action.email, ctx.userEmail ?? undefined);
          logs.push(`✏️ Draft reply:\n${draft}`);
          break;
        }
        case "plan_day": {
          const targetDate = action.date_iso ?? dayjs().format("YYYY-MM-DD");
          const day = dayjs(targetDate);
          const startIso = day.startOf("day").toISOString();
          const endIso = day.endOf("day").toISOString();

          const events = await listEventsForRange(ctx.userId, startIso, endIso);
          const tasks = await listTasksWithFilter(ctx.userId ?? "", {
            status: "todo",
            toDate: targetDate,
          });

          const eventLines = events.map((ev) => {
            const start = dayjs(ev.start_time).format("h:mm A");
            const end = dayjs(ev.end_time).format("h:mm A");
            return `[assistant] 📅 ${start}–${end}: ${ev.title}`;
          });

          const taskLines = (tasks as TaskRecord[])
            .slice(0, 4)
            .map((t) => {
              const est = t.estimated_minutes ? ` (~${t.estimated_minutes}m)` : "";
              return `[assistant] ✅ ${t.title}${est}`;
            });

          logs.push(`[assistant] Here is a draft plan for ${targetDate}:`);
          eventLines.forEach((l) => logs.push(l));
          taskLines.forEach((l) => logs.push(l));
          break;
        }
        case "plan_week": {
          const start = dayjs(action.start_date_iso ?? dayjs());
          const end = dayjs(action.end_date_iso ?? start.add(6, "day"));
          logs.push(
            `I can plan each day between ${start.format("MMM D")} and ${end.format(
              "MMM D"
            )}. For now, run "plan my day" on the specific days you care about.`
          );
          break;
        }
        case "list_events": {
          const targetDay = (action as any).day ?? "today";
          const date =
            targetDay === "tomorrow"
              ? dayjs().add(1, "day")
              : targetDay && /^\d{4}-\d{2}-\d{2}$/.test(targetDay)
                ? dayjs(targetDay)
                : dayjs();
          const startIso = date.startOf("day").toISOString();
          const endIso = date.endOf("day").toISOString();
          const events = await listEventsForRange(ctx.userId, startIso, endIso);
          if (!events.length) {
            logs.push("[assistant] No calendar events found for that time range.");
          } else {
            logs.push(`[assistant] Listing all calendar events for ${date.format("YYYY-MM-DD")}.`);
            events.forEach((ev) => {
              const start = dayjs(ev.start_time).format("h:mm A");
              const end = dayjs(ev.end_time).format("h:mm A");
              logs.push(`[assistant] - ${ev.title} (${start}–${end})`);
            });
          }
          break;
        }
        case "create_project": {
          if (!ctx.userId) {
            logs.push("[assistant] Missing user for project creation.");
            break;
          }
          const project = await createOrGetProject({
            userId: ctx.userId,
            name: action.name,
            area: action.area ?? null,
          });
          logs.push(
            `[assistant] Created project '${project.name}' in area '${project.area ?? "general"}'.`
          );
          break;
        }
        case "assign_tasks_to_project": {
          if (!ctx.userId) {
            logs.push("[assistant] Missing user for assigning tasks.");
            break;
          }
          const project = await createOrGetProject({
            userId: ctx.userId,
            name: action.project_name,
            area: action.area ?? null,
          });
          let moved = 0;
          if (action.task_titles?.length) {
            moved = await assignTasksToProjectByTitles({
              userId: ctx.userId,
              projectId: project.id,
              titles: action.task_titles,
            });
          } else if (action.area) {
            // Move tasks by area match if area provided and no titles
            const tasks = await listTasks();
            const matches = tasks.filter(
              (t) => (t.area ?? "").toLowerCase() === action.area!.toLowerCase()
            );
            const ids = matches.map((t) => t.id);
            if (ids.length) {
              const { data, error } = await createServerClient()
                .from("tasks")
                .update({ project_id: project.id })
                .in("id", ids)
                .select("id");
              if (error) {
                console.error("[assistant] assign tasks by area failed:", error);
                logs.push("[assistant] [error] Could not assign tasks by area.");
              } else {
                moved = data?.length ?? 0;
              }
            }
          }
          logs.push(`[assistant] Assigned ${moved} task(s) to project '${project.name}'.`);
          break;
        }
        case "archive_project": {
          if (!ctx.userId) {
            logs.push("[assistant] Missing user for project archive.");
            break;
          }
          const project = await getProjectByName({ userId: ctx.userId, name: action.name });
          if (!project) {
            logs.push("[assistant] Project not found to archive.");
            break;
          }
          await archiveProject({ userId: ctx.userId, projectId: project.id });
          logs.push(`[assistant] Archived project '${project.name}'.`);
          break;
        }
        case "update_task_type": {
          if (!ctx.userId) {
            logs.push("[assistant] Missing user for task update.");
            break;
          }
          const updated = await updateTaskTypeByTitle({
            userId: ctx.userId,
            title: action.task_title,
            taskType: action.task_type,
            dateIso: action.date_iso,
          });
          if (updated === 0) {
            logs.push("[assistant] No matching task found to update type.");
          } else {
            logs.push(
              `[assistant] Updated task '${action.task_title}' to ${action.task_type}${
                action.date_iso ? ` for ${action.date_iso}` : ""
              }.`
            );
          }
          break;
        }
        case "remember_info": {
          if (!userId) {
            logs.push("[assistant] Skipped remembering info (no user).");
            break;
          }
          for (const item of (action as any).items ?? []) {
            const saved = await (await import("@/app/lib/info")).rememberInfo({
              userId,
              label: item.label,
              value: item.value,
            });
            logs.push(`[assistant] Remembered "${saved.label}" as "${saved.value}".`);
          }
          break;
        }
        case "lookup_info": {
          if (!userId) {
            logs.push("[assistant] Cannot look up info without a user.");
            break;
          }
          for (const label of (action as any).labels ?? []) {
            const fact = await (await import("@/app/lib/info")).lookupInfo({ userId, label });
            if (fact) {
              logs.push(`"${label}" is "${fact.value}".`);
            } else {
              logs.push(`I don't have "${label}" saved yet.`);
            }
          }
          break;
        }
        default: {
          const actionName = String((action as any)?.type ?? "unknown");
          if (actionName === "check_availability") {
            logs.push(
              'I can’t yet automatically check your availability. Try: "What’s on my calendar tomorrow?"'
            );
          } else if (actionName === "list_events") {
            logs.push(
              'I don’t yet support listing events via an action. Try: "What’s on my calendar today?" instead.'
            );
          } else if (actionName === "list_tasks") {
            logs.push(
              "I don’t yet support listing tasks via an action. Try using the Tasks panel for now."
            );
          } else {
            console.log("[assistant] Unsupported action:", actionName);
          }
          break;
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
      console.error("[dispatcher] action failed:", action.type, err);
      logs.push(
        `[error] Action ${action.type} failed: ${message}`
      );
    }
  }

  return logs;
}
