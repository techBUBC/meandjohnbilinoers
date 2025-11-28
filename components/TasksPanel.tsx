"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { formatDueDate } from "@/lib/date";
import type { TaskRecord } from "@/lib/tasks";

type DecoratedTask = TaskRecord & {
  category: string;
  subcategory: string;
  dueDate: string | null;
  estimatedDuration: number | null;
  createdByAI: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function TasksPanel() {
  const { data, error, isLoading } = useSWR("/api/tasks", fetcher, {
    refreshInterval: 30_000,
  });
  const rawTasks: TaskRecord[] = Array.isArray(data?.tasks) ? data.tasks : [];
  const tasks: DecoratedTask[] = useMemo(
    () =>
      rawTasks.map((task) => {
        const category = task.focus || "General";
        const subcategory = task.owner || "General";
        const dueDate = task.due_date ?? null;
        const estimatedDuration = task.estimated_minutes ?? null;
        const createdByAI = task.source === "ai";
        const priority = (task.priority as any) || "medium";
        return {
          ...task,
          category,
          subcategory,
          dueDate,
          estimatedDuration,
          createdByAI,
          priority,
        };
      }),
    [rawTasks]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const grouped = useMemo(() => {
        const result = new Map<string, Map<string, DecoratedTask[]>>();
        tasks.forEach((task) => {
          const categoryKey = task.category || "General";
          const subKey = task.subcategory || "General";
      if (!result.has(categoryKey)) {
        result.set(categoryKey, new Map());
      }
      const subMap = result.get(categoryKey)!;
      if (!subMap.has(subKey)) {
        subMap.set(subKey, []);
      }
      subMap.get(subKey)!.push(task);
    });
        for (const subMap of result.values()) {
          for (const [subKey, list] of subMap.entries()) {
            const sorted = [...list].sort((a, b) => {
              const priorityDiff =
                PRIORITY_ORDER[a.priority || "medium"] - PRIORITY_ORDER[b.priority || "medium"];
          if (priorityDiff !== 0) return priorityDiff;
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.title.localeCompare(b.title);
        });
        subMap.set(subKey, sorted);
      }
    }
    return result;
  }, [tasks]);

  const categories = useMemo(() => {
    const keys = Array.from(grouped.keys());
    keys.sort();
    return ["All", ...keys];
  }, [grouped]);

  const visibleCategories =
    selectedCategory === "All" ? grouped : new Map(
      [...grouped.entries()].filter(([category]) => category === selectedCategory)
    );

  const showSkeleton = isLoading && tasks.length === 0;

  return (
    <section className="card p-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="card-title text-base">Tasks</div>
          <p className="text-xs text-slate-400">
            Added via commands · grouped by focus
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 focus:outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-[#f5f7ff] px-3 py-1 font-semibold text-[#406cff]">
            {tasks.length} tasks
          </span>
        </div>
      </header>
      <div className="mt-5 space-y-4">
        {showSkeleton && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-xl bg-slate-100/80 px-4 py-3">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
            Failed to load tasks.
          </div>
        )}
        {!showSkeleton && !error && tasks.length === 0 && (
          <p className="text-sm text-slate-500">
            No tasks yet. Use the command console to add tasks like “Business:
            build the new PWA with Jasper”.
          </p>
        )}
        {[...visibleCategories.entries()].map(([category, subMap]) => (
          <div key={category} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-[#1b2b5c]">{category}</h3>
            <div className="mt-3 space-y-3">
              {[...subMap.entries()].map(([sub, list]) => (
                <div key={`${category}-${sub}`} className="rounded-2xl border border-slate-100/70 bg-white px-3 py-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {sub || "General"}
                    </span>
                    <span>{list.length} item{list.length === 1 ? "" : "s"}</span>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {list.map((task) => (
                      <li key={task.id} className="rounded-xl border border-slate-100 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#1b2b5c]">
                            {task.title}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              task.priority === "high"
                                ? "bg-rose-50 text-rose-600"
                                : task.priority === "medium"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          {task.dueDate && (
                            <span className="rounded-full border border-slate-200 px-2 py-0.5">
                              Due {formatDueDate(task.dueDate)}
                            </span>
                          )}
                          {typeof task.estimatedDuration === "number" && task.estimatedDuration > 0 && (
                            <span className="rounded-full border border-slate-200 px-2 py-0.5">
                              ~{task.estimatedDuration} min
                            </span>
                          )}
                          {task.createdByAI && (
                            <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-slate-400">
                              AI
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
