import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { loadAuth } from '../state/auth';
import { api } from '../api/client';

export default function ForecastSummaryPage() {
  const auth = loadAuth();

  const [searchParams] = useSearchParams();
  const [stationId, setStationId] = useState('');

  useEffect(() => {
    const paramStationId = searchParams.get('stationId');
    if (paramStationId) setStationId(paramStationId);
  }, [searchParams]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  async function run() {
    if (!auth?.token) return;
    if (!stationId) {
      setError('Station ID is required.');
      return;
    }

    setBusy(true);
    setError(null);
    setData(null);

    try {
      const res = await api.get(`/inventory/stations/${stationId}/forecast-summary`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ? String(e.response.data.error) : e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Forecast Summary</h1>
        <p className="text-sm text-slate-400">Depletion and risk per item at a station</p>
      </header>

      <main className="p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Pick a Station</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="block text-sm">
              <div className="text-slate-300 mb-1">Station ID</div>
              <input
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                placeholder="UUID"
              />
            </label>

            <button
              disabled={busy}
              onClick={run}
              className="rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-4 py-2 font-medium"
            >
              {busy ? 'Loading…' : 'Load Forecast'}
            </button>
          </div>
        </div>

        {busy ? <div className="mt-4 text-slate-400 text-sm">Computing…</div> : null}

        {!busy && data ? (
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-400">As of</div>
                  <div className="text-sm text-slate-200 font-medium">{data.asOfDate}</div>
                  <div className="mt-2 text-sm text-slate-400">Station</div>
                  <div className="text-sm text-slate-200 font-medium">
                    {data.station?.station_code} — {data.station?.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Next resupply date</div>
                  <div className="text-sm text-slate-200 font-medium">{data.nextResupplyDate ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 overflow-x-auto">
              <h2 className="font-semibold">Item Risks</h2>
              <table className="w-full mt-3 text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="pb-2 pr-4">Item</th>
                    <th className="pb-2 pr-4">Stock</th>
                    <th className="pb-2 pr-4">Avg/day</th>
                    <th className="pb-2 pr-4">Days left</th>
                    <th className="pb-2 pr-4">Depletion</th>
                    <th className="pb-2 pr-4">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary?.map((r: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{r.itemName}</div>
                        <div className="text-xs text-slate-400">{r.itemCode}</div>
                      </td>
                      <td className="py-2 pr-4 font-mono">
                        {r.currentStock} {r.unit}
                      </td>
                      <td className="py-2 pr-4 font-mono">{r.averageDailyConsumption ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono">{r.daysRemaining ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono">{r.estimatedDepletionDate ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded border ${
                            r.riskLevel === 'CRITICAL'
                              ? 'bg-red-900/40 text-red-200 border-red-700'
                              : r.riskLevel === 'AT_RISK'
                                ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                                : r.riskLevel === 'WATCH'
                                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                                  : 'bg-emerald-900/30 text-emerald-200 border-emerald-800'
                          }`}
                        >
                          {r.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
