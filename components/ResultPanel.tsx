"use client";

import type { ResultPanelData } from "@/types/resultPanel";

type Props = {
  data: ResultPanelData;
};

export default function ResultPanel({ data }: Props) {
  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-[#1b2b5c]">{data.heading}</h3>
          {data.subtitle && (
            <p className="text-xs text-slate-400">{data.subtitle}</p>
          )}
        </div>
        <span className="rounded-full bg-[#f5f7ff] px-3 py-1 text-xs font-semibold text-[#406cff]">
          Result panel
        </span>
      </header>
      <div className="mt-4 space-y-4">
        {data.sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </h4>
            <ul className="mt-2 space-y-2">
              {section.items.length === 0 && (
                <li className="text-sm text-slate-400">Nothing to display.</li>
              )}
              {section.items.map((item, idx) => (
                <li
                  key={`${item.primary}-${idx}`}
                  className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#1b2b5c]">
                      {item.primary}
                    </span>
                    {item.meta && (
                      <span className="text-xs text-slate-400">{item.meta}</span>
                    )}
                  </div>
                  {item.secondary && (
                    <p className="text-xs text-slate-500">{item.secondary}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
