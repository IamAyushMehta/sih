import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { loadAuth } from '../state/auth';
import { getCargo } from '../api/trace';
import Timeline, { type TimelineEvent } from '../components/Timeline';

export default function CargoTraceabilityPage() {
  const { cargoId } = useParams();
  const [loading, setLoading] = useState(false);
  const [cargo, setCargo] = useState<any | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const auth = loadAuth();

  useEffect(() => {
    if (!auth?.token || !cargoId) return;

    async function run() {
      setLoading(true);
      try {
        const res = await getCargo(auth.token, cargoId);
        setCargo(res.cargo ?? null);

        // For Phase 4, we display a minimal timeline based on returned cargo status.
        // Next iterations will query persisted cargo status history + audit_events.
        const status = res.cargo?.status;
        const stationName = res.cargo?.station_name;
        setEvents([
          { status: 'CREATED', actor: 'system', location: res.cargo?.station_name, notes: 'Indent/cargo creation in demo transaction.' },
          {
            status: status ? `Current: ${status}` : 'Unknown',
            actor: 'system',
            location: stationName,
            notes: 'For full timeline, wire status_history in later Phase 4 refinements.',
          },
        ]);
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Cargo Details</h2>
            {loading ? <div className="text-sm text-slate-400 mt-2">Loading…</div> : null}

            {!loading && cargo ? (
              <div className="mt-3 space-y-2">
                <div className="text-sm">Cargo: <span className="text-slate-300">{cargo.cargo_code}</span></div>
                <div className="text-sm">Status: <span className="text-slate-300">{cargo.status}</span></div>
                <div className="text-sm">Station: <span className="text-slate-300">{cargo.station_name}</span></div>
              </div>
            ) : null}

            {!loading && !cargo ? (
              <div className="text-sm text-slate-400 mt-3">No cargo loaded.</div>
            ) : null}
          </div>

          <Timeline events={events} />
        </div>
      </main>
    </div>
  );
}
