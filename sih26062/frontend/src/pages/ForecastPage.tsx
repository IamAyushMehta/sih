import React, { useEffect, useState } from 'react';

import { loadAuth } from '../state/auth';
import { getForecast } from '../api/inventory';

export default function ForecastPage() {
  const auth = loadAuth();

  // Simple UI: ask user to input stationId/itemId for now.
  const [stationId, setStationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [forecast, setForecast] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // keep empty - user-driven
  }, []);

  async function run() {
    if (!auth?.token) return;
    if (!stationId || !itemId) {
      setError('Please provide stationId and itemId.');
      return;
    }

    setBusy(true);
    setError(null);
    setForecast(null);

    try {
      const res = await getForecast(auth.token, stationId, itemId);
      setForecast(res);
    } catch (e: any) {
      setError(e?.response?.data?.error ? String(e.response.data.error) : e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory Forecast</h1>
        <p className="text-sm text-slate-400">Depletion vs next resupply risk classification</p>
      </header>

      <main className="p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Run Forecast</h2>

            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <div className="text-slate-300 mb-1">Station ID</div>
                <input
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </label>

              <label className="block text-sm">
                <div className="text-slate-300 mb-1">Item ID</div>
                <input
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </label>

              <button
                disabled={busy}
                onClick={run}
                className="w-full rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-4 py-2 font-medium"
              >
                {busy ? 'Forecasting…' : 'Get Forecast'}
              </button>

              <div className="text-xs text-slate-400">
                For a full demo, click <span className="text-slate-200">Run Critical Workflow</span>, then use the resulting
                IDs.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Result</h2>

            {!forecast && !busy ? (
              <div className="mt-3 text-sm text-slate-400">No forecast yet.</div>
            ) : null}

            {busy ? <div className="mt-3 text-sm text-slate-400">Computing…</div> : null}

            {forecast ? (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  Risk Level:{' '}
                  <span className="text-slate-300 font-medium">{forecast.riskLevel}</span>
                </div>
                <div>
                  Current Stock:{' '}
                  <span className="text-slate-300 font-medium">{forecast.currentStock}</span>
                </div>
                <div>
                  Avg Daily Consumption:{' '}
                  <span className="text-slate-300 font-medium">{forecast.averageDailyConsumption ?? '—'}</span>
                </div>
                <div>
                  Days Remaining:{' '}
                  <span className="text-slate-300 font-medium">{forecast.daysRemaining ?? '—'}</span>
                </div>
                <div>
                  Estimated Depletion:{' '}
                  <span className="text-slate-300 font-medium">{forecast.estimatedDepletionDate ?? '—'}</span>
                </div>
                <div>
                  Next Resupply:{' '}
                  <span className="text-slate-300 font-medium">{forecast.nextResupplyDate ?? '—'}</span>
                </div>

                {forecast.shortfallDays !== undefined ? (
                  <div>
                    Shortfall Days:{' '}
                    <span className="text-slate-300 font-medium">{forecast.shortfallDays ?? '—'}</span>
                  </div>
                ) : null}

                {forecast.message ? (
                  <div className="mt-2 text-xs text-amber-300">{forecast.message}</div>
                ) : null}

                {forecast.recommendedAction ? (
                  <div className="mt-2 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-200">
                    <div className="font-semibold">Recommendation</div>
                    <div className="mt-1">{forecast.recommendedAction}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
