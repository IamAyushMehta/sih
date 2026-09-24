import React from 'react';

export type TimelineEvent = {
  dateTime?: string;
  actor?: string;
  status?: string;
  location?: string;
  notes?: string;
};

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="font-semibold">Timeline</h2>
      <div className="mt-3 space-y-3">
        {events.map((e, idx) => (
          <div key={idx} className="rounded border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-sm font-medium">
              {e.status ? e.status : 'Event'}
            </div>
            {e.dateTime ? <div className="text-xs text-slate-400">{e.dateTime}</div> : null}
            {e.location ? <div className="text-xs text-slate-400">{e.location}</div> : null}
            {e.actor ? <div className="text-xs text-slate-500">By {e.actor}</div> : null}
            {e.notes ? <div className="text-sm mt-1 text-slate-200">{e.notes}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
