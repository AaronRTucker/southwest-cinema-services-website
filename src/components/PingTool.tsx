"use client";

import { useState } from "react";

interface Site {
  siteId: string;
  siteName: string;
  online: boolean;
}

interface PingResult {
  alive: boolean;
  ms: number | null;
  error?: string;
}

export default function PingTool({ sites }: { sites: Site[] }) {
  const [siteId, setSiteId] = useState(
    sites.find((s) => s.online)?.siteId ?? sites[0]?.siteId ?? ""
  );
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ target: string; ping: PingResult } | null>(null);

  const selectedSite = sites.find((s) => s.siteId === siteId);
  const canPing = !!target.trim() && !!selectedSite?.online && !loading;

  async function handlePing() {
    if (!canPing) return;
    const t = target.trim();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/relay/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, command: "ping", params: { target: t } }),
      });
      const data = await res.json();
      setResult({
        target: t,
        ping: data.ok ? data.data : { alive: false, ms: null, error: data.error },
      });
    } catch {
      setResult({ target: t, ping: { alive: false, ms: null, error: "Network error" } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Network Ping</h2>
      <div className="flex flex-wrap gap-3 items-end">
        {sites.length > 1 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Run from</label>
            <select
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setResult(null); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              {sites.map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteName}{s.online ? "" : " (offline)"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-gray-400 block mb-1">Target IP or hostname</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePing()}
            placeholder="192.168.10.1"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        <button
          onClick={handlePing}
          disabled={!canPing}
          className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "Pinging…" : "Ping"}
        </button>
      </div>

      {selectedSite && !selectedSite.online && (
        <p className="text-xs text-red-400 mt-2">Site relay is offline — connect a relay to use ping.</p>
      )}

      {result && (
        <div className={`mt-3 flex items-center gap-2 text-sm font-mono px-3 py-2 rounded-lg ${result.ping.alive ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          <span>{result.ping.alive ? "✓" : "✗"}</span>
          <span>
            {result.target}
            {result.ping.alive
              ? result.ping.ms != null ? ` — ${result.ping.ms}ms` : " — reachable"
              : result.ping.error ? ` — ${result.ping.error}` : " — unreachable"}
          </span>
        </div>
      )}
    </div>
  );
}
