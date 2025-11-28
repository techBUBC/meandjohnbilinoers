"use client";

import { useEffect, useState } from "react";

type Status = {
  connected: boolean;
  email?: string;
  error?: string;
};

export default function GoogleStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch("/api/google/status");
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setStatus({ connected: false, error: e?.message ?? "Failed to load status" });
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/google/auth/url");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Could not get Google auth URL");
      }
    } catch (e: any) {
      alert(e?.message ?? "Failed to start Google OAuth");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card mb-6 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Google Status
          </div>
          <div className="text-base font-semibold text-slate-900">
            {status?.connected ? "Connected" : "Not connected"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {status?.email && <span>Signed in as {status.email}</span>}
            {status?.error && <span className="text-red-500">Error: {status.error}</span>}
            {!status && "Checking connection..."}
          </div>
        </div>
        <button
          onClick={handleConnect}
          className="inline-flex items-center rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          disabled={loading}
        >
          {status?.connected ? "Reconnect Google" : "Connect Google"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Local dev only. OAuth tokens are stored in a local file on this machine.
      </p>
    </section>
  );
}
