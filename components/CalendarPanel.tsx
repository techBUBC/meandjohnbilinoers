"use client";

import Link from "next/link";
import useSWR from "swr";
import { formatEventRange } from "@/lib/date";

type Event = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CalendarPanel() {
  const { data, error, isLoading } = useSWR("/api/calendar/list", fetcher, {
    refreshInterval: 60_000,
  });

  const events: Event[] = data?.events ?? [];

  return (
    <section className="card flex h-[600px] flex-col">
      <header className="card-header px-5 pt-5">
        <div>
          <div className="card-title text-base">Calendar</div>
          <p className="text-xs text-slate-400">Today + next 7 days</p>
        </div>
        <span className="text-xs text-slate-400">Live sync</span>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-2xl border border-slate-100/80 bg-slate-100/60 px-4 py-3"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            Failed to load calendar. {error.message ?? ""}
          </div>
        )}
        {!isLoading && !error && events.length === 0 && (
          <div className="text-sm text-slate-500">No upcoming events.</div>
        )}
        <ul className="mt-3 space-y-3">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/calendar/${ev.id}`}
                className="block rounded-2xl border border-slate-100/70 bg-white/70 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200"
              >
                <p className="text-sm font-semibold text-[#1b2b5c]">
                  {ev.summary || "(no title)"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatEventRange(ev.start, ev.end)}
                </p>
                {ev.location && (
                  <p className="mt-1 text-xs text-slate-400 truncate">{ev.location}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
