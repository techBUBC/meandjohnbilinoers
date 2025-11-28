import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/google";
import { formatEventRange } from "@/lib/date";

type Props = {
  params: { id: string };
};

export default async function CalendarDetailPage({ params }: Props) {
  try {
    const event = await getEvent(params.id);
    return (
      <div className="space-y-6">
        <section className="card p-6">
          <div className="mb-4 text-sm">
            <Link href="/" className="text-[#406cff] hover:underline">
              ← Back to Home
            </Link>
          </div>
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Event</p>
            <h1 className="text-2xl font-semibold text-[#1b2b5c]">{event.summary}</h1>
            <p className="text-sm font-medium text-slate-600">
              {formatEventRange(event.start, event.end)}
            </p>
          </header>
          {event.location && (
            <p className="mt-3 text-sm text-slate-500">
              <span className="font-semibold text-[#1b2b5c]">Location:</span> {event.location}
            </p>
          )}
          {event.description && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {event.description}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#406cff] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2d4eea]"
              >
                Open in Google Calendar
              </a>
            )}
            <button
              type="button"
              disabled
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-400"
              title="Coming soon"
            >
              Delete event (soon)
            </button>
          </div>
        </section>
      </div>
    );
  } catch (err) {
    console.error(err);
    notFound();
  }
}
