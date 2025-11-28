import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Assistant v6",
  description: "Professional console assistant for Gmail, Calendar & Tasks",
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/overview", label: "Overview" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f7ff] text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col gap-6 px-4 pb-12 pt-6">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 px-6 py-4 shadow-[0_8px_30px_rgba(64,108,255,0.08)] backdrop-blur">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">
                Personal console
              </p>
              <h1 className="text-2xl font-semibold text-[#1b2b5c]">
                Personal Assistant v6
              </h1>
            </div>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-500">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1 transition-colors hover:bg-[#f5f7ff] hover:text-[#1b2b5c]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
