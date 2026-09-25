import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { loadAuth } from '../state/auth';
import { getManifestStowage } from '../api/stowage';

export default function StowagePlanPage() {
  const { manifestId } = useParams();

  const auth = loadAuth();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token || !manifestId) return;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await getManifestStowage(auth.token, manifestId);
        setData(res);
      } catch (e: any) {
        setError(e?.response?.data?.error ? String(e.response.data.error) : e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [auth?.token, manifestId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Stowage Plan</h1>
        <p className="text-sm text-slate-400">Loading sequence and zone assignment</p>
      </header>

      <main className="p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? <div className="text-slate-400">Loading stowage plan...</div> : null}

        {!loading && data ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">Voyage Details</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  Voyage: <span className="text-slate-300">{data.manifest?.voyageCode}</span>
                </div>
                <div>
                  Destination: <span className="text-slate-300">{data.manifest?.destinationStation}</span>
                </div>
                {data.manifest?.stowagePlan ? (
                  <div className="mt-3 text-xs text-slate-400">
                    Algorithm: {data.manifest.stowagePlan.algorithmVersion}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-amber-400">No stowage plan generated yet</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">Stowage Positions (Loading Order)</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-400">
                      <th className="pb-2 pr-4">Load #</th>
                      <th className="pb-2 pr-4">Unload #</th>
                      <th className="pb-2 pr-4">Zone</th>
                      <th className="pb-2 pr-4">Deck</th>
                      <th className="pb-2 pr-4">Position</th>
                      <th className="pb-2 pr-4">Item</th>
                      <th className="pb-2 pr-4">Qty</th>
                      <th className="pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions?.map((pos: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-800/50">
                        <td className="py-2 pr-4 font-mono">{pos.loadingSequence}</td>
                        <td className="py-2 pr-4 font-mono">{pos.unloadingSequence}</td>
                        <td className="py-2 pr-4">{pos.stowageZone}</td>
                        <td className="py-2 pr-4">{pos.stowageDeck}</td>
                        <td className="py-2 pr-4 font-mono">{pos.stowagePosition}</td>
                        <td className="py-2 pr-4">
                          {pos.itemName} ({pos.itemCode})
                        </td>
                        <td className="py-2 pr-4">
                          {pos.quantity} {pos.unit}
                        </td>
                        <td className="py-2 text-slate-400">{pos.constraintsNotes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.positions?.length === 0 && (
                <div className="mt-3 text-sm text-slate-400">No stowage positions found.</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">Explanation</h2>
              <div className="mt-2 text-sm text-slate-300">
                <p>Items are loaded in reverse order of unloading priority.</p>
                <p className="mt-1 text-slate-400">
                  "Last loaded = First unloaded" ensures efficient port operations.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !data && !error && (
          <div className="text-sm text-slate-400">No stowage data available.</div>
        )}
      </main>
    </div>
  );
}