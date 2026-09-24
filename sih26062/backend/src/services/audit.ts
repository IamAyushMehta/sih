import { pool } from '../db/pool';

export type AuditEntityType =
  | 'INDENT'
  | 'CARGO'
  | 'MANIFEST'
  | 'VOYAGE'
  | 'INVENTORY'
  | 'CONSUMPTION'
  | 'STOWAGE_PLAN'
  | 'PERSONNEL'
  | 'EMERGENCY';

export async function writeAuditEvent(params: {
  actorUserId?: string;
  entityType: AuditEntityType;
  entityId?: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  location?: unknown;
  notes?: string;
}) {
  const {
    actorUserId,
    entityType,
    entityId,
    action,
    oldValue,
    newValue,
    location,
    notes,
  } = params;

  await pool.query(
    'INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, old_value_json, new_value_json, location_json, notes) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);',
    [actorUserId ?? null, entityType, entityId ?? null, action, oldValue ?? null, newValue ?? null, location ?? null, notes ?? null]
  );
}
