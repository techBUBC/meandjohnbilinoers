"use client";

import { useState } from "react";

type MessageDetails = {
  id: string;
  threadId?: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
};

type Props = {
  message: MessageDetails;
};

export default function EmailReplyPanel({ message }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState<"manual" | "auto" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  async function submit(autoDraft: boolean) {
    if (!message.id || !message.threadId) {
      setStatus({ type: "error", message: "Missing Gmail thread context." });
      return;
    }
    if (autoDraft && !body.trim()) {
      setStatus({ type: "error", message: "Add instructions before drafting with AI." });
      return;
    }

    setSending(autoDraft ? "auto" : "manual");
    setStatus(null);
    try {
      const payload = autoDraft
        ? {
            emailId: message.id,
            threadId: message.threadId,
            instructions: body.trim(),
            originalMessage:
              message.bodyText || message.bodyHtml || message.snippet || "",
            mode: "ai-draft",
          }
        : {
            emailId: message.id,
            threadId: message.threadId,
            body: body.trim(),
            mode: "send_raw",
          };

      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reply");
      }
      setStatus({
        type: "success",
        message: autoDraft ? "Drafted with AI and sent." : "Reply sent.",
      });
      setBody("");
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err?.message ?? "Failed to send reply",
      });
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-[#1b2b5c]">Reply</h2>
        <p className="text-sm text-slate-500">
          Use the textarea for full replies or AI drafting instructions.
        </p>
      </header>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply or describe how the assistant should respond…"
        className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-[#406cff] focus:outline-none"
        disabled={!!sending}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => submit(false)}
          disabled={!!sending || !body.trim()}
          className="rounded-full bg-[#406cff] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2d4eea] disabled:opacity-50"
        >
          {sending === "manual" ? "Sending…" : "Send reply"}
        </button>
        <button
          onClick={() => submit(true)}
          disabled={!!sending}
          className="rounded-full border border-[#406cff] px-5 py-2 text-sm font-semibold text-[#1b2b5c] transition hover:bg-[#406cff]/10 disabled:opacity-50"
        >
          {sending === "auto" ? "Drafting…" : "Draft with AI & send"}
        </button>
        <span className="text-xs text-slate-500">
          Output arrives in your Gmail Sent folder.
        </span>
      </div>
      {status && (
        <p
          className={`mt-3 text-sm ${
            status.type === "success" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
