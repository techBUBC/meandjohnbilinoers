"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTimeLabel } from "@/lib/date";

type Message = {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
};

type GmailResponse = {
  messages: Message[];
  nextPageToken?: string | null;
  error?: string;
};

export default function GmailPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages(pageToken?: string) {
    try {
      if (pageToken) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const params = new URLSearchParams();
      params.set("pageSize", "20");
      if (pageToken) {
        params.set("pageToken", pageToken);
      }
      const url = `/api/gmail/list?${params.toString()}`;
      const res = await fetch(url);
      const data: GmailResponse = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Gmail");
      }
      setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
      setNextPageToken(data.nextPageToken ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Gmail");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const showSkeleton = loading && messages.length === 0;

  return (
    <section className="card flex h-[600px] flex-col">
      <header className="card-header px-5 pt-5">
        <div>
          <div className="card-title text-base">Gmail</div>
          <p className="text-xs text-slate-400">Inbox preview · auto-filtered</p>
        </div>
        <span className="text-xs text-slate-400">Updated live</span>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-5">
        {showSkeleton && (
          <SkeletonList />
        )}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="text-sm text-slate-500">Inbox looks clear for now.</div>
        )}
        <ul className="space-y-2">
          {messages.map((message) => (
            <li key={message.id}>
              <Link
                href={`/email/${message.id}`}
                className="block rounded-2xl border border-slate-100/70 bg-slate-50/60 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1b2b5c] line-clamp-2">
                    {message.subject}
                  </p>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTimeLabel(message.date)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500 truncate">
                  {message.from}
                </p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {message.snippet}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {nextPageToken && (
        <div className="border-t border-slate-100 px-5 py-3">
          <button
            onClick={() => loadMessages(nextPageToken)}
            disabled={loadingMore}
            className="w-full rounded-full bg-[#406cff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2d4eea] disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-slate-100/80 bg-slate-100/70 px-3 py-2"
        >
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
