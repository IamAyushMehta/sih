import React, { useEffect, useState } from 'react';

import { loadAuth } from '../state/auth';
import { api } from '../api/client';

export default function ManifestListPage() {
  const auth = loadAuth();

  const [loading, setLoading] = useState(false);
  const [manifestList, setManifestList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, this page is a placeholder.
  }, []);

  async function run() {
    if (!auth?.token) return;
    setLoading(true);
    setError(null);
    try {
      // Backend read endpoint for listing manifests isn't implemented yet.
      // Keeping this page minimal so routing won't break.
      setManifestList([]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Manifests</h1>
        <p className="text-sm text-slate-400">Select a manifest to view stowage plan</p>
      </header>

      <main className="p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <button
            className="rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-4 py-2 font-medium"
            disabled={loading}
            onClick={run}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
          <div className="mt-3 text-sm text-slate-400">
            Manifest list endpoint is not wired yet.
          </div>
        </div>
      </main>
    </div>
  );
}
