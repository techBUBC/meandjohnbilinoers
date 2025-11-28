import dayjs from "dayjs";
import { listTasks } from "../tasks";
import { listEventsForRange } from "../calendar";

export interface PlannedBlock {
  start: string;
  end: string;
  label: string;
  kind: "event" | "task";
}

export async function buildDayPlan(userId: string, dateIso: string) {
  const date = dayjs(dateIso).startOf("day");
  const start = date.toISOString();
  const end = date.add(1, "day").toISOString();

  const [events, tasks] = await Promise.all([listEventsForRange(userId, start, end), listTasks()]);

  const dayTasks = tasks.filter((t) => t.due_date && dayjs(t.due_date).isSame(date, "day"));
  const backlogTasks = tasks.filter((t) => !t.due_date);

  backlogTasks.sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pa = a.priority ?? "medium";
    const pb = b.priority ?? "medium";
    return (order[pa] ?? 1) - (order[pb] ?? 1);
  });

  const blocks: PlannedBlock[] = [];

  for (const ev of events) {
    const endIso =
      ev.end_time && ev.end_time !== ev.start_time
        ? ev.end_time
        : dayjs(ev.start_time).add(1, "hour").toISOString();
    blocks.push({
      start: ev.start_time,
      end: endIso,
      label: ev.title,
      kind: "event",
    });
  }

  blocks.sort((a, b) => a.start.localeCompare(b.start));

  const allTasks = [...dayTasks, ...backlogTasks];
  let cursor = date.hour(8).toISOString();
  const workdayEnd = date.hour(18).toISOString();

  function addTaskBlock(task: any) {
    if (!task) return;
    const estMinutes = task.estimated_minutes || 60;
    const taskStart = dayjs(cursor);
    const taskEnd = taskStart.add(estMinutes, "minute");
    if (taskEnd.isAfter(workdayEnd)) return;
    blocks.push({
      start: taskStart.toISOString(),
      end: taskEnd.toISOString(),
      label: task.title,
      kind: "task",
    });
    cursor = taskEnd.toISOString();
  }

  const eventBlocks = blocks.filter((b) => b.kind === "event").sort((a, b) => a.start.localeCompare(b.start));
  cursor = date.hour(8).toISOString();
  for (const block of eventBlocks) {
    const gapEnd = block.start;
    while (dayjs(cursor).add(15, "minute").isBefore(gapEnd) && allTasks.length > 0) {
      const task = allTasks.shift();
      addTaskBlock(task);
    }
    cursor = block.end;
  }

  while (dayjs(cursor).add(15, "minute").isBefore(workdayEnd) && allTasks.length > 0) {
    const task = allTasks.shift();
    addTaskBlock(task);
  }

  return { blocks };
}
