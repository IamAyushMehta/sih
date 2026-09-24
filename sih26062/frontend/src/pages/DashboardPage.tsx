import React, { useEffect, useState } from 'react';

import { getAlerts } from '../api/inventory';
import { loadAuth } from '../state/auth';

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth?.token) return;

    async function run() {
      setBusy(true);
      const token = auth!.token;
      try {
        const res = await getAlerts(token);
        setAlerts(res.alerts ?? []);
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
        <p className="text-sm text-slate-400">Operational alerts derived from live DB calculations</p>
      </header>

      <main className="p-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Operational Alerts</h2>
            {busy ? <div className="text-sm text-slate-400">Loading…</div> : null}
          </div>

          <div className="mt-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-sm text-slate-400">No alerts right now.</div>
            ) : null}

            {alerts.map((a) => (
              <div key={a.id} className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      a.riskLevel === 'CRITICAL'
                        ? 'bg-red-900/40 text-red-200 border border-red-700'
                        : a.riskLevel === 'AT_RISK'
                          ? 'bg-amber-900/40 text-amber-200 border border-amber-700'
                          : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    ⚠ {a.riskLevel}
                  </span>
                  <div className="text-sm font-medium">{a.station}</div>
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
