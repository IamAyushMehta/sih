import React, { useEffect, useState } from 'react';

import { getAlerts } from '../api/inventory';
import { getDashboardSummary } from '../api/dashboard';
import { loadAuth } from '../state/auth';

function RiskPill({ riskLevel }: { riskLevel: string }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-1 rounded border ${
        riskLevel === 'CRITICAL'
          ? 'bg-red-900/40 text-red-200 border-red-700'
          : riskLevel === 'AT_RISK'
            ? 'bg-amber-900/40 text-amber-200 border-amber-700'
            : riskLevel === 'WATCH'
              ? 'bg-slate-800 text-slate-200 border-slate-700'
              : 'bg-emerald-900/30 text-emerald-200 border-emerald-800'
      }`}
    >
      ⚠ {riskLevel}
    </span>
  );
}

export default function DashboardPage() {
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth?.token) return;

    async function run() {
      setBusy(true);
      const token = auth!.token;
      try {
        const [a, s] = await Promise.all([getAlerts(token), getDashboardSummary(token)]);
        setAlerts(a.alerts ?? []);
        setSummary(s ?? null);
      } finally {
        setBusy(false);
      }
    }

    run();
  }, []);

  if (!loadAuth()?.token) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Command Dashboard</h1>
        <p className="text-sm text-slate-400">Workflow-aware operational alerts and summaries</p>
      </header>

      <main className="p-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Operational Snapshot</h2>
              <p className="text-sm text-slate-400">Live counts derived from the DB</p>
            </div>
            {busy ? <div className="text-sm text-slate-400">Loading…</div> : null}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Cargo awaiting receipt" value={summary?.cargoAwaitingReceipt ?? 0} />
            <StatCard label="Inventory at risk" value={summary?.inventoryAtRisk ?? 0} />
            <StatCard label="Stations in system" value={summary?.stations ?? 0} />
            <StatCard label="Recent indents (7d)" value={summary?.recentIndents ?? 0} />
          </div>

          <div className="mt-4 flex gap-3 flex-wrap">
            <a
              className="text-xs rounded border border-slate-800 px-3 py-1 hover:bg-slate-900"
              href="/forecast/summary"
            >
              Open Forecast Summary
            </a>
            <a
              className="text-xs rounded border border-slate-800 px-3 py-1 hover:bg-slate-900"
              href="/forecast"
            >
              Run Single Forecast
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Operational Alerts</h2>
            {busy ? <div className="text-sm text-slate-400">Updating…</div> : null}
          </div>

          <div className="mt-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-sm text-slate-400">No alerts right now.</div>
            ) : null}

            {alerts.map((a) => (
              <div key={a.id} className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center gap-3">
                  <RiskPill riskLevel={a.riskLevel} />
                  <div className="text-sm font-medium">
                    {a.station} — {a.item}
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-200">{a.message}</div>
                <div className="mt-2 text-xs text-slate-500">Calculated at {a.calculatedAt}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
