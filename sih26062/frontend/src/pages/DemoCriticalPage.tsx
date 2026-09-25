import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { demoRun } from '../api/demo';
import { loadAuth } from '../state/auth';

export default function DemoCriticalPage() {
  const navigate = useNavigate();
  const auth = loadAuth();

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    if (!auth?.token) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const r = await demoRun(auth.token, {});
      setResult(r);

      if (r?.ids?.manifestId) {
        navigate(`/manifests/${r.ids.manifestId}/stowage`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ? String(e.response.data.error) : e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Demo Runner</h1>
        <p className="text-sm text-slate-400">Runs the full critical workflow via backend + DB</p>
      </header>
      <main className="p-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <button
            disabled={busy}
            onClick={onRun}
            className="rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-4 py-2 font-medium"
          >
            {busy ? 'Running…' : 'Run Critical Workflow'}
          </button>

          {error ? (
            <div className="mt-3 rounded border border-red-700 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-5 space-y-4">
              <div>
                <h2 className="font-semibold">Created</h2>
                <pre className="mt-2 rounded border border-slate-800 bg-slate-950 p-3 text-xs overflow-auto">
                  {JSON.stringify(result.ids, null, 2)}
                </pre>
              </div>

              <div>
                <h2 className="font-semibold">Stowage Plan</h2>
                <pre className="mt-2 rounded border border-slate-800 bg-slate-950 p-3 text-xs overflow-auto">
                  {JSON.stringify(result.stowage, null, 2)}
                </pre>
              </div>

              <div>
                <h2 className="font-semibold">Forecast</h2>
                <pre className="mt-2 rounded border border-slate-800 bg-slate-950 p-3 text-xs overflow-auto">
                  {JSON.stringify(result.forecast, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
