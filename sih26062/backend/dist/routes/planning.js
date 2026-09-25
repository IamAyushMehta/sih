"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planningRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
exports.planningRouter = (0, express_1.Router)();
exports.planningRouter.get('/stations', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS']), async (_req, res) => {
    const r = await pool_1.pool.query('SELECT id, station_code, name, timezone, notes FROM stations ORDER BY station_code;');
    res.json({ stations: r.rows });
});
exports.planningRouter.get('/seasons', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS']), async (_req, res) => {
    const r = await pool_1.pool.query('SELECT id, season_code, label, start_date, end_date FROM seasons ORDER BY start_date;');
    res.json({ seasons: r.rows });
});
const requirementLineSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    requiredQty: zod_1.z.coerce.number().nonnegative(),
    existingStockQty: zod_1.z.coerce.number().nonnegative().default(0),
    expectedConsumptionQty: zod_1.z.coerce.number().nonnegative().default(0),
    safetyStockQty: zod_1.z.coerce.number().nonnegative().default(0),
    plannedResupplyQty: zod_1.z.coerce.number().nonnegative().default(0),
    unit: zod_1.z.string().min(1),
});
const createRequirementSchema = zod_1.z.object({
    stationId: zod_1.z.string().uuid(),
    seasonId: zod_1.z.string().uuid(),
    plannedResupplyDate: zod_1.z.coerce.date().optional(),
    lines: zod_1.z.array(requirementLineSchema).min(1),
});
// Create requirement plan + requirement_lines.
exports.planningRouter.post('/requirements', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER']), async (req, res) => {
    const input = createRequirementSchema.safeParse(req.body);
    if (!input.success)
        return res.status(400).json({ error: input.error.flatten() });
    const { stationId, seasonId, plannedResupplyDate, lines } = input.data;
    const actorUserId = req.user.userId;
    // Demo-friendly default: if UI doesn’t provide a planned resupply date,
    // assume next resupply is ~150 days from today.
    const resolvedPlannedResupplyDate = plannedResupplyDate
        ? plannedResupplyDate.toISOString().slice(0, 10)
        : new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const created = await pool_1.pool.query('INSERT INTO requirements (station_id, season_id, planned_resupply_date, created_by) '
        + 'VALUES ($1,$2,$3,$4) '
        + 'ON CONFLICT (station_id, season_id) DO UPDATE '
        + 'SET planned_resupply_date = EXCLUDED.planned_resupply_date, created_by = EXCLUDED.created_by '
        + 'RETURNING id;', [stationId, seasonId, resolvedPlannedResupplyDate, actorUserId]);
    const requirementId = created.rows[0].id;
    await pool_1.pool.query('DELETE FROM requirement_lines WHERE requirement_id = $1;', [requirementId]);
    for (const line of lines) {
        await pool_1.pool.query('INSERT INTO requirement_lines '
            + '(requirement_id, item_id, required_qty, existing_stock_qty, expected_consumption_qty, safety_stock_qty, planned_resupply_qty, unit) '
            + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);', [
            requirementId,
            line.itemId,
            line.requiredQty,
            line.existingStockQty,
            line.expectedConsumptionQty,
            line.safetyStockQty,
            line.plannedResupplyQty,
            line.unit,
        ]);
    }
    res.json({ requirementId });
});
const createIndentSchema = zod_1.z.object({
    indentCode: zod_1.z.string().min(1),
});
exports.planningRouter.post('/requirements/:requirementId/indents', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER']), async (req, res) => {
    const input = createIndentSchema.safeParse(req.body);
    if (!input.success)
        return res.status(400).json({ error: input.error.flatten() });
    const requirementId = req.params.requirementId;
    const { indentCode } = input.data;
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        const r = await trx.query('SELECT station_id, season_id FROM requirements WHERE id = $1;', [requirementId]);
        if (r.rows.length === 0)
            return res.status(404).json({ error: 'Requirement not found' });
        const { station_id: stationId, season_id: seasonId } = r.rows[0];
        const indentIns = await trx.query('INSERT INTO indents (indent_code, station_id, season_id, status, created_by) '
            + 'VALUES ($1,$2,$3,$4,$5) RETURNING id;', [indentCode, stationId, seasonId, 'DRAFT', req.user.userId]);
        const indentId = indentIns.rows[0].id;
        const lines = await trx.query('SELECT item_id, required_qty, existing_stock_qty, safety_stock_qty, planned_resupply_qty, unit '
            + 'FROM requirement_lines WHERE requirement_id = $1;', [requirementId]);
        for (const l of lines.rows) {
            await trx.query('INSERT INTO indent_items '
                + '(indent_id, item_id, required_qty, unit, existing_stock_snapshot, safety_stock_qty, planned_resupply_qty) '
                + 'VALUES ($1,$2,$3,$4,$5,$6,$7);', [
                indentId,
                l.item_id,
                l.required_qty,
                l.unit,
                l.existing_stock_qty,
                l.safety_stock_qty,
                l.planned_resupply_qty,
            ]);
        }
        await trx.query('COMMIT');
        res.json({ indentId });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
exports.planningRouter.post('/indents/:indentId/approve', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER']), async (req, res) => {
    const indentId = req.params.indentId;
    const actorUserId = req.user.userId;
    const r = await pool_1.pool.query('SELECT status FROM indents WHERE id = $1;', [indentId]);
    if (r.rows.length === 0)
        return res.status(404).json({ error: 'Indent not found' });
    const current = r.rows[0].status;
    if (current !== 'DRAFT' && current !== 'INDENTED') {
        return res.status(409).json({ error: `Indent cannot be approved from status ${current}` });
    }
    const upd = await pool_1.pool.query('UPDATE indents SET status = $1, approved_by = $2, approved_at = now() WHERE id = $3 RETURNING id;', ['APPROVED', actorUserId, indentId]);
    await pool_1.pool.query('INSERT INTO indent_status_history (indent_id, from_status, to_status, changed_by, notes) '
        + 'VALUES ($1,$2,$3,$4,$5);', [indentId, current, 'APPROVED', actorUserId, 'Approved indent']);
    res.json({ indentId: upd.rows[0].id });
});
const createCargoSchema = zod_1.z.object({
    cargoCode: zod_1.z.string().min(1),
});
// Convert an approved indent into cargo consignments.
exports.planningRouter.post('/indents/:indentId/cargo', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'LOGISTICS']), async (req, res) => {
    const input = createCargoSchema.safeParse(req.body);
    if (!input.success)
        return res.status(400).json({ error: input.error.flatten() });
    const indentId = req.params.indentId;
    const actorUserId = req.user.userId;
    const indentRow = await pool_1.pool.query('SELECT status, station_id FROM indents WHERE id = $1;', [indentId]);
    if (indentRow.rows.length === 0)
        return res.status(404).json({ error: 'Indent not found' });
    if (indentRow.rows[0].status !== 'APPROVED') {
        return res.status(409).json({ error: 'Indent must be APPROVED before converting to cargo' });
    }
    const stationId = indentRow.rows[0].station_id;
    const trx = await pool_1.pool.connect();
    try {
        await trx.query('BEGIN');
        const cargoIns = await trx.query('INSERT INTO cargo (cargo_code, indent_id, status, created_by) VALUES ($1,$2,$3,$4) RETURNING id;', [input.data.cargoCode, indentId, 'APPROVED', actorUserId]);
        const cargoId = cargoIns.rows[0].id;
        const itemRows = await trx.query('SELECT ii.item_id, ii.planned_resupply_qty, ii.unit, i.item_type, i.requires_special_handling, i.hazard_class '
            + 'FROM indent_items ii JOIN items i ON i.id = ii.item_id '
            + 'WHERE ii.indent_id = $1;', [indentId]);
        function defaultUnloadingPriority(itemType, requiresSpecial) {
            // Lower unloading_priority => earlier unloading.
            if (itemType === 'FUEL')
                return 10;
            if (itemType === 'CONSUMABLE')
                return 20;
            if (requiresSpecial)
                return 30;
            return 40;
        }
        for (const r1 of itemRows.rows) {
            const itemType = r1.item_type;
            const qty = Number(r1.planned_resupply_qty);
            if (!qty || qty === 0)
                continue;
            const unloadingPriority = defaultUnloadingPriority(itemType, Boolean(r1.requires_special_handling));
            await trx.query('INSERT INTO cargo_items '
                + '(cargo_id, item_id, qty, unit, destination_station_id, cargo_type, hazard_class, unloading_priority) '
                + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);', [
                cargoId,
                r1.item_id,
                qty,
                r1.unit ?? null,
                stationId,
                'STANDARD',
                r1.hazard_class,
                unloadingPriority,
            ]);
        }
        await trx.query('COMMIT');
        res.json({ cargoId });
    }
    catch (e) {
        await trx.query('ROLLBACK');
        throw e;
    }
    finally {
        trx.release();
    }
});
//# sourceMappingURL=planning.js.map