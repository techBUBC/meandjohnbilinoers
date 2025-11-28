import Link from "next/link";
import { notFound } from "next/navigation";
import EmailReplyPanel from "@/components/EmailReplyPanel";
import { getMessageDetail } from "@/lib/google";
import { formatDateTimeLabel } from "@/lib/date";

type PageProps = {
  params: { id: string };
};

export default async function EmailDetailPage({ params }: PageProps) {
  try {
    const message = await getMessageDetail(params.id);
    const safeHtml = message.bodyHtml ? sanitizeHtml(message.bodyHtml) : null;
    const fallbackText = message.bodyText || message.snippet || "No content available.";

    return (
      <div className="space-y-6">
        <section className="card p-6">
          <div className="mb-4 text-sm">
            <Link href="/" className="text-[#406cff] hover:underline">
              ← Back to Home
            </Link>
          </div>
          <header className="mb-4 space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
            <h2 className="text-2xl font-semibold text-[#1b2b5c]">{message.subject}</h2>
          </header>
          <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">From</dt>
              <dd className="font-medium text-slate-700">{message.from}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">To</dt>
              <dd className="font-medium text-slate-700">{message.to || "Me"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Date</dt>
              <dd className="font-medium text-slate-700">
                {formatDateTimeLabel(message.date)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            {safeHtml ? (
              <article
                className="text-sm leading-relaxed text-slate-800 [word-break:break-word]"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            ) : (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap">{fallbackText}</pre>
            )}
          </div>
        </section>
        <EmailReplyPanel message={message} />
      </div>
    );
  } catch (err) {
    console.error(err);
    notFound();
  }
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"');
}
