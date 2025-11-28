import { formatDateTimeLabel, formatEventRange } from "@/lib/date";
import { listEvents } from "@/lib/google";
import { listTasks, TaskRecord } from "@/lib/tasks";

type ScheduleItem =
  | {
      kind: "event";
      id: string;
      title: string;
      detail: string;
      location?: string;
      time: number;
    }
  | {
      kind: "task";
      id: string;
      title: string;
      category: string;
      detail: string;
      time: number;
    };

export default async function OverviewPage() {
  const [tasks, events] = await Promise.all([listTasks(), listEvents()]);
  const { todaySchedule, weekEvents, weekTasks } = buildOverviewData(tasks, events);

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Assistant</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1b2b5c]">Overview</h1>
        <p className="text-sm text-slate-500">
          “My Day / My Week” combines your calendar and tasks into one glanceable plan.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1b2b5c]">Today</h2>
              <p className="text-xs text-slate-400">Timeline of tasks + events</p>
            </div>
            <span className="rounded-full bg-[#f5f7ff] px-3 py-1 text-xs font-semibold text-[#406cff]">
              {todaySchedule.length} items
            </span>
          </header>
          <ul className="space-y-3">
            {todaySchedule.length === 0 && (
              <li className="text-sm text-slate-500">You’re clear for today.</li>
            )}
            {todaySchedule.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-2xl border border-slate-100/70 bg-white px-4 py-3 shadow-sm"
              >
                <div
                  className={`mt-1 h-2 w-2 rounded-full ${
                    item.kind === "event" ? "bg-[#406cff]" : "bg-emerald-500"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1b2b5c]">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                  {"location" in item && item.location && (
                    <p className="text-xs text-slate-400">{item.location}</p>
                  )}
                  {item.kind === "task" && (
                    <p className="text-xs text-slate-400">{item.category || "General"}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1b2b5c]">This week</h2>
              <p className="text-xs text-slate-400">Next 7 days</p>
            </div>
            <span className="rounded-full bg-[#f5f7ff] px-3 py-1 text-xs font-semibold text-[#406cff]">
              {weekEvents.length} events · {weekTasks.length} tasks
            </span>
          </header>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-400">Events</h3>
              <ul className="mt-2 space-y-2">
                {weekEvents.length === 0 && (
                  <li className="text-sm text-slate-500">No events on the horizon.</li>
                )}
                {weekEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-2xl border border-slate-100/80 bg-white px-4 py-3 text-sm text-slate-600"
                  >
                    <p className="font-semibold text-[#1b2b5c]">
                      {event.summary || "(untitled)"}
                    </p>
                    <p className="text-xs text-slate-500">{event.range}</p>
                    {event.location && (
                      <p className="text-xs text-slate-400">{event.location}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-400">Tasks due</h3>
              <ul className="mt-2 space-y-2">
                {weekTasks.length === 0 && (
                  <li className="text-sm text-slate-500">No deadlines this week.</li>
                )}
                {weekTasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600"
                  >
                    <p className="font-semibold text-[#1b2b5c]">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      Category: {task.category || "General"}
                    </p>
                    <p className="text-xs">Added {formatDateTimeLabel(task.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildOverviewData(tasks: TaskRecord[], events: Awaited<ReturnType<typeof listEvents>>) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const todayEvents = events
    .filter((event) => {
      const start = new Date(event.start);
      return start >= startOfToday && start < endOfToday;
    })
    .map<ScheduleItem>((event) => ({
      kind: "event",
      id: event.id!,
      title: event.summary || "(untitled)",
      detail: formatEventRange(event.start, event.end),
      location: event.location,
      time: new Date(event.start).getTime(),
    }));

  const todayTasks = tasks
    .filter((task) => {
      if (!task.due_date) return false;
      const due = new Date(task.due_date);
      return due >= startOfToday && due < endOfToday;
    })
    .map<ScheduleItem>((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      category: task.focus || "General",
      detail: task.due_date ? `Due ${formatDateTimeLabel(task.due_date)}` : "Due soon",
      time: new Date(task.due_date ?? task.created_at).getTime(),
    }));

  const todaySchedule = [...todayEvents, ...todayTasks].sort((a, b) => a.time - b.time);

  const weekEvents = events
    .filter((event) => {
      const start = new Date(event.start);
      return start >= endOfToday && start <= endOfWeek;
    })
    .map((event) => ({
      id: event.id!,
      summary: event.summary,
      range: formatEventRange(event.start, event.end),
      location: event.location,
    }));

  const weekTasks = tasks
    .filter((task) => {
      if (!task.due_date) return false;
      const due = new Date(task.due_date);
      return due >= startOfToday && due <= endOfWeek;
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      category: task.focus || "General",
      created_at: task.created_at,
    }));

  return { todaySchedule, weekEvents, weekTasks };
}
