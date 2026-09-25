"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditEvent = writeAuditEvent;
const pool_1 = require("../db/pool");
async function writeAuditEvent(params) {
    const { actorUserId, entityType, entityId, action, oldValue, newValue, location, notes, } = params;
    await pool_1.pool.query('INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, old_value_json, new_value_json, location_json, notes) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);', [actorUserId ?? null, entityType, entityId ?? null, action, oldValue ?? null, newValue ?? null, location ?? null, notes ?? null]);
}
//# sourceMappingURL=audit.js.map