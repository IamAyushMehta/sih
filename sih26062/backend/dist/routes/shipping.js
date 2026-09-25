"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
exports.shippingRouter = (0, express_1.Router)();
const createVoyageSchema = zod_1.z.object({
    voyageCode: zod_1.z.string().min(1),
    vesselName: zod_1.z.string().min(1),
    departurePort: zod_1.z.string().min(1),
    destinationStationId: zod_1.z.string().uuid(),
    departureDate: zod_1.z.coerce.date(),
    expectedArrival: zod_1.z.coerce.date().optional(),
    capacityNotes: zod_1.z.string().optional(),
});
exports.shippingRouter.post('/voyages', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const input = createVoyageSchema.safeParse(req.body);
    if (!input.success)
        return res.status(400).json({ error: input.error.flatten() });
    const actorUserId = req.user.userId;
    const r = await pool_1.pool.query('INSERT INTO voyages '
        + '(voyage_code, vessel_name, departure_port, destination_station_id, departure_date, expected_arrival, status, capacity_notes, created_by) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id;', [
        input.data.voyageCode,
        input.data.vesselName,
        input.data.departurePort,
        input.data.destinationStationId,
        input.data.departureDate.toISOString().slice(0, 10),
        input.data.expectedArrival ? input.data.expectedArrival.toISOString().slice(0, 10) : null,
        'PLANNED',
        input.data.capacityNotes ?? null,
        actorUserId,
    ]);
    res.json({ voyageId: r.rows[0].id });
});
const addCargoToManifestSchema = zod_1.z.object({
    cargoId: zod_1.z.string().uuid(),
});
exports.shippingRouter.post('/voyages/:voyageId/manifests/addCargo', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const input = addCargoToManifestSchema.safeParse(req.body);
    if (!input.success)
        return res.status(400).json({ error: input.error.flatten() });
    const actorUserId = req.user.userId;
    const { voyageId } = req.params;
    const voyageRow = await pool_1.pool.query('SELECT destination_station_id FROM voyages WHERE id = $1;', [voyageId]);
    if (voyageRow.rows.length === 0)
        return res.status(404).json({ error: 'Voyage not found' });
    const destinationStationId = voyageRow.rows[0].destination_station_id;
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        const manifestIns = await trx.query('INSERT INTO manifests (voyage_id, status, created_by) '
            + 'VALUES ($1,$2,$3) '
            + 'ON CONFLICT (voyage_id) DO NOTHING RETURNING id;', [voyageId, 'DRAFT', actorUserId]);
        let manifestId;
        if (manifestIns.rows.length > 0) {
            manifestId = manifestIns.rows[0].id;
        }
        else {
            const existing = await trx.query('SELECT id FROM manifests WHERE voyage_id = $1;', [voyageId]);
            manifestId = existing.rows[0].id;
        }
        const cargoItems = await trx.query('SELECT ci.id as cargo_item_id, ci.item_id, ci.qty, ci.unit, ci.destination_station_id, ci.unloading_priority, ci.weight_kg, ci.volume_m3, ci.hazard_class, i.item_type '
            + 'FROM cargo_items ci '
            + 'JOIN items i ON i.id = ci.item_id '
            + 'WHERE ci.cargo_id = $1 AND ci.destination_station_id = $2;', [input.data.cargoId, destinationStationId]);
        for (const ci of cargoItems.rows) {
            await trx.query('INSERT INTO manifest_items '
                + '(manifest_id, cargo_item_id, station_id, weight_kg, volume_m3, priority, unloading_priority, destination_station_id) '
                + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (manifest_id, cargo_item_id) DO NOTHING;', [
                manifestId,
                ci.cargo_item_id,
                destinationStationId,
                ci.weight_kg ?? null,
                ci.volume_m3 ?? null,
                ci.item_type === 'FUEL' ? 100 : 80,
                ci.unloading_priority ?? 100,
                destinationStationId,
            ]);
        }
        // Mark cargo as MANIFESTED if any items were added.
        await trx.query('UPDATE cargo SET status = $1 WHERE id = $2;', ['MANIFESTED', input.data.cargoId]);
        await trx.query('COMMIT');
        res.json({ manifestId });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
// Generate stowage plan (explainable heuristic).
exports.shippingRouter.post('/manifests/:manifestId/stowage/generate', 
// Body is optional for now; future versions may accept stowage constraints.
auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const { manifestId } = req.params;
    const actorUserId = req.user.userId;
    const manifestItems = await pool_1.pool.query('SELECT mi.id as manifest_item_id, mi.unloading_priority, mi.priority, mi.cargo_item_id, ci.item_id, i.item_type, ci.hazard_class, mi.destination_station_id '
        + 'FROM manifest_items mi '
        + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
        + 'JOIN items i ON i.id = ci.item_id '
        + 'WHERE mi.manifest_id = $1 AND mi.status = \'ACTIVE\';', [manifestId]);
    const items = manifestItems.rows;
    if (items.length === 0)
        return res.status(400).json({ error: 'Manifest has no active items' });
    // Sort for unloading: earlier unloading => lower unloading_priority.
    const sortedForUnload = [...items].sort((a, b) => {
        const ua = a.unloading_priority ?? 100;
        const ub = b.unloading_priority ?? 100;
        if (ua !== ub)
            return ua - ub;
        // tie-breaker: higher priority unload earlier
        return (b.priority ?? 0) - (a.priority ?? 0);
    });
    const n = sortedForUnload.length;
    const stowageZoneForUnloadIndex = (unloadIndex) => {
        // unloadIndex is 1..n (1 = earliest unload)
        if (unloadIndex <= 3)
            return 'ZONE_A';
        if (unloadIndex <= 6)
            return 'ZONE_B';
        return 'ZONE_C';
    };
    // Insert plan + positions in a transaction.
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        // Remove existing plan positions for idempotency.
        await trx.query('DELETE FROM stowage_positions WHERE stowage_plan_id IN (SELECT id FROM stowage_plans WHERE manifest_id = $1);', [manifestId]);
        await trx.query('DELETE FROM stowage_plans WHERE manifest_id = $1;', [manifestId]);
        const planIns = await trx.query('INSERT INTO stowage_plans (manifest_id, algorithm_version, explanation_json, created_by) '
            + 'VALUES ($1,$2,$3::jsonb,$4) RETURNING id;', [manifestId, 'v1-demo', JSON.stringify({
                rule: 'last-loaded-first-unloaded',
                unloadSort: 'unloading_priority asc, then priority desc',
                loadingOrderDerivedFromUnload: true,
            }), actorUserId]);
        const planId = planIns.rows[0].id;
        const positions = [];
        for (let idx = 0; idx < n; idx++) {
            const unloadIndex = idx + 1; // 1..n
            const loadingIndex = n - idx; // last-loaded-first-unloaded
            const mi = sortedForUnload[idx];
            const zone = stowageZoneForUnloadIndex(unloadIndex);
            const deck = zone === 'ZONE_A' ? 'DECK_1' : zone === 'ZONE_B' ? 'DECK_2' : 'DECK_1';
            const positionLabel = `P${zone.replace('ZONE_', '')}-${loadingIndex}`;
            await trx.query('INSERT INTO stowage_positions '
                + '(stowage_plan_id, manifest_item_id, stowage_zone, stowage_deck, stowage_position, loading_sequence, unloading_sequence, destination_station_id, constraints_notes) '
                + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);', [
                planId,
                mi.manifest_item_id,
                zone,
                deck,
                positionLabel,
                loadingIndex,
                unloadIndex,
                mi.destination_station_id,
                mi.hazard_class ? `Hazard: ${mi.hazard_class}` : null,
            ]);
            await trx.query('UPDATE manifest_items SET loading_sequence_recommended = $1, loading_sequence_final = $1, unloading_sequence_final = $2 WHERE id = $3;', [loadingIndex, unloadIndex, mi.manifest_item_id]);
            positions.push({ manifest_item_id: mi.manifest_item_id, loading_sequence: loadingIndex, unloading_sequence: unloadIndex, zone });
        }
        await trx.query('COMMIT');
        res.json({ planId, loadingSequence: positions.sort((a, b) => a.loading_sequence - b.loading_sequence) });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
exports.shippingRouter.post('/manifests/:manifestId/loaded', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const { manifestId } = req.params;
    const actorUserId = req.user.userId;
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        await trx.query('UPDATE manifests SET status = $1 WHERE id = $2;', ['LOADED', manifestId]);
        // Update all cargos referenced by this manifest.
        await trx.query('UPDATE cargo SET status = $1 WHERE id IN (SELECT DISTINCT cargo_item.cargo_id FROM manifest_items mi '
            + 'JOIN cargo_items cargo_item ON cargo_item.id = mi.cargo_item_id WHERE mi.manifest_id = $2);', ['LOADED', manifestId]);
        // Insert cargo status history
        const histories = await trx.query('SELECT DISTINCT c.id as cargo_id FROM manifest_items mi '
            + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
            + 'JOIN cargo c ON c.id = ci.cargo_id '
            + 'WHERE mi.manifest_id = $1;', [manifestId]);
        for (const h of histories.rows) {
            await trx.query('INSERT INTO cargo_status_history (cargo_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);', [h.cargo_id, 'MANIFESTED', 'LOADED', actorUserId, 'Cargo loaded']);
        }
        await trx.query('COMMIT');
        res.json({ ok: true });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
exports.shippingRouter.post('/voyages/:voyageId/depart', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const { voyageId } = req.params;
    const actorUserId = req.user.userId;
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        await trx.query('UPDATE voyages SET status = $1, departure_date = COALESCE(departure_date, now()::date) WHERE id = $2;', ['IN_TRANSIT', voyageId]);
        await trx.query('UPDATE cargo SET status = $1 WHERE id IN (SELECT DISTINCT ci.cargo_id FROM manifests m '
            + 'JOIN manifest_items mi ON mi.manifest_id = m.id '
            + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
            + 'WHERE m.voyage_id = $2);', ['IN_TRANSIT', voyageId]);
        await trx.query('INSERT INTO voyage_status_history (voyage_id, from_status, to_status, changed_by, notes) '
            + 'SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM voyages WHERE id = $1);', [voyageId, 'PLANNED', 'IN_TRANSIT', actorUserId, 'Voyage departed']);
        await trx.query('COMMIT');
        res.json({ ok: true });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
exports.shippingRouter.post('/voyages/:voyageId/receive', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const { voyageId } = req.params;
    const actorUserId = req.user.userId;
    const { receivedAt } = zod_1.z.object({ receivedAt: zod_1.z.coerce.date().optional() }).safeParse(req.body)
        ? zod_1.z.object({ receivedAt: zod_1.z.coerce.date().optional() }).parse(req.body)
        : { receivedAt: undefined };
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        const arrived = receivedAt ? receivedAt.toISOString() : null;
        await trx.query('UPDATE voyages SET status = $1, actual_arrival = COALESCE($2::date, actual_arrival) WHERE id = $3;', ['ARRIVED', receivedAt ? receivedAt.toISOString().slice(0, 10) : null, voyageId]);
        const manifestItems = await trx.query('SELECT mi.cargo_item_id, ci.cargo_id, mi.destination_station_id, ci.qty, ci.unit '
            + 'FROM manifests m '
            + 'JOIN manifest_items mi ON mi.manifest_id = m.id '
            + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
            + 'WHERE m.voyage_id = $1;', [voyageId]);
        for (const mi of manifestItems.rows) {
            const qty = Number(mi.qty);
            if (!qty)
                continue;
            // 1) cargo status
            await trx.query('UPDATE cargo SET status = $1 WHERE id = $2;', ['RECEIVED', mi.cargo_id]);
            // 2) inventory row upsert
            await trx.query('INSERT INTO inventory (station_id, item_id, quantity, unit, average_daily_consumption, minimum_stock, safety_stock, last_updated) '
                + 'SELECT $1, ci.item_id, $2, $3, NULL, 0, 0, now() '
                + 'FROM cargo_items ci WHERE ci.id = $4 '
                + 'ON CONFLICT (station_id, item_id) DO UPDATE '
                + 'SET quantity = inventory.quantity + EXCLUDED.quantity, unit = EXCLUDED.unit, last_updated = now();', [mi.destination_station_id, qty, mi.unit, mi.cargo_item_id]);
            // 3) inventory transaction record
            await trx.query('INSERT INTO inventory_transactions (station_id, item_id, transaction_type, qty_delta, unit, source_type, source_id, occurred_at, notes) '
                + 'SELECT $1, ci.item_id, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), $8 '
                + 'FROM cargo_items ci WHERE ci.id = $9;', [
                mi.destination_station_id,
                'RECEIVE',
                qty,
                mi.unit,
                'VOYAGE_RECEIPT',
                voyageId,
                receivedAt ? arrived : null,
                'Cargo received at station',
                mi.cargo_item_id,
            ]);
        }
        // Update manifest status.
        await trx.query('UPDATE manifests SET status = $1 WHERE voyage_id = $2;', ['RECEIVED', voyageId]);
        await trx.query('COMMIT');
        res.json({ ok: true });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
//# sourceMappingURL=shipping.js.map