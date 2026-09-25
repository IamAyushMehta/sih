import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { loadAuth } from '../state/auth';
import { getCargo, getCargoTimeline } from '../api/trace';
import Timeline, { type TimelineEvent } from '../components/Timeline';

export default function CargoTraceabilityPage() {
  const { cargoId } = useParams();

  const auth = loadAuth();

  const [loading, setLoading] = useState(false);
  const [cargo, setCargo] = useState<any | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token || !cargoId) return;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const cargoRes = await getCargo(auth.token, cargoId);
        setCargo(cargoRes.cargo ?? null);

        const timelineRes = await getCargoTimeline(auth.token, cargoId);
        setEvents(timelineRes.events ?? []);
      } catch (e: any) {
        setError(e?.response?.data?.error ? String(e.response.data.error) : e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [auth?.token, cargoId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Cargo Traceability</h1>
        <p className="text-sm text-slate-400">Indent → Cargo → Voyage → Station Receipt</p>
      </header>

      <main className="p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Cargo Details</h2>

            {loading ? <div className="text-sm text-slate-400 mt-2">Loading…</div> : null}

            {!loading && cargo ? (
              <div className="mt-3 space-y-2">
                <div className="text-sm">
                  Cargo: <span className="text-slate-300">{cargo.cargo_code}</span>
                </div>
                <div className="text-sm">
                  Status: <span className="text-slate-300">{cargo.status}</span>
                </div>
                <div className="text-sm">
                  Station:{' '}
                  <span className="text-slate-300">{cargo.station_name}</span>
                </div>
                <div className="text-sm">
                  Destination station code:{' '}
                  <span className="text-slate-300">{cargo.station_code}</span>
                </div>
                <div className="text-sm text-slate-400">Indent ID: {cargo.indent_id}</div>
              </div>
            ) : null}

            {!loading && !cargo ? (
              <div className="text-sm text-slate-400 mt-3">Cargo not found.</div>
            ) : null}
          </div>

          <Timeline events={events} />
        </div>
      </main>
    </div>
  );
}
