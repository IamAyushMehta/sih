"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRouter = void 0;
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
exports.readRouter = (0, express_1.Router)();
// Inventory list for a station
exports.readRouter.get('/inventory/stations/:stationId/items', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (req, res) => {
    const { stationId } = req.params;
    const r = await pool_1.pool.query('SELECT i.id as item_id, i.item_code, i.name, i.unit, inv.quantity, inv.average_daily_consumption, inv.safety_stock '
        + 'FROM inventory inv '
        + 'JOIN items i ON i.id = inv.item_id '
        + 'WHERE inv.station_id = $1 '
        + 'ORDER BY i.item_code;', [stationId]);
    res.json({ items: r.rows });
});
exports.readRouter.get('/shipping/cargo/:cargoId', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (req, res) => {
    const { cargoId } = req.params;
    const cRow = await pool_1.pool.query('SELECT c.id, c.cargo_code, c.status, c.created_at, '
        + '       indd.id as indent_id, '
        + '       s.station_code, s.name as station_name '
        + 'FROM cargo c '
        + 'JOIN indents indd ON indd.id = c.indent_id '
        + 'JOIN stations s ON s.id = indd.station_id '
        + 'WHERE c.id = $1;', [cargoId]);
    const cargo = cRow.rows[0] ?? null;
    res.json({ cargo });
});
exports.readRouter.get('/shipping/cargo/:cargoId/timeline', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (req, res) => {
    const { cargoId } = req.params;
    const sql = `
      WITH
      cargo_indent AS (
        SELECT c.indent_id
        FROM cargo c
        WHERE c.id = $1
      ),
      indent_station AS (
        SELECT i.id as indent_id, s.name as station_name
        FROM indents i
        JOIN stations s ON s.id = i.station_id
        JOIN cargo_indent ci ON ci.indent_id = i.id
      ),
      cargo_destination AS (
        SELECT
          MIN(s.name) AS station_name
        FROM cargo_items ci
        JOIN stations s ON s.id = ci.destination_station_id
        WHERE ci.cargo_id = $1
      ),
      cargo_voyages AS (
        SELECT DISTINCT m.voyage_id
        FROM cargo_items ci
        JOIN manifest_items mi ON mi.cargo_item_id = ci.id
        JOIN manifests m ON m.id = mi.manifest_id
        WHERE ci.cargo_id = $1
      )
      SELECT * FROM (
        -- Indent status timeline
        SELECT
          ih.changed_at AS date_time,
          u.username AS actor,
          CONCAT('INDENT ', ih.from_status, ' → ', ih.to_status) AS status,
          istn.station_name AS location,
          ih.notes AS notes
        FROM indent_status_history ih
        JOIN indents i ON i.id = ih.indent_id
        LEFT JOIN users u ON u.id = ih.changed_by
        JOIN indent_station istn ON istn.indent_id = i.id
        WHERE ih.indent_id = (SELECT indent_id FROM cargo_indent)

        UNION ALL

        -- Cargo status timeline
        SELECT
          ch.changed_at AS date_time,
          u.username AS actor,
          CONCAT('CARGO ', ch.from_status, ' → ', ch.to_status) AS status,
          cd.station_name AS location,
          ch.notes AS notes
        FROM cargo_status_history ch
        LEFT JOIN users u ON u.id = ch.changed_by
        LEFT JOIN cargo_destination cd ON TRUE
        WHERE ch.cargo_id = $1

        UNION ALL

        -- Voyage status timeline for voyages that included this cargo
        SELECT
          vh.changed_at AS date_time,
          u.username AS actor,
          CONCAT('VOYAGE ', vh.from_status, ' → ', vh.to_status) AS status,
          s.name AS location,
          vh.notes AS notes
        FROM voyage_status_history vh
        JOIN cargo_voyages v ON v.voyage_id = vh.voyage_id
        LEFT JOIN users u ON u.id = vh.changed_by
        JOIN voyages vo ON vo.id = vh.voyage_id
        JOIN stations s ON s.id = vo.destination_station_id
      ) t
      ORDER BY t.date_time ASC;
    `;
    const r = await pool_1.pool.query(sql, [cargoId]);
    const events = r.rows.map((row) => ({
        dateTime: row.date_time
            ? new Date(row.date_time).toISOString().slice(0, 19).replace('T', ' ')
            : undefined,
        actor: row.actor ?? 'system',
        status: row.status,
        location: row.location,
        notes: row.notes,
    }));
    res.json({ cargoId, events });
});
exports.readRouter.get('/shipping/manifests/:manifestId/stowage', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (req, res) => {
    const { manifestId } = req.params;
    const manifestRow = await pool_1.pool.query('SELECT m.id as manifest_id, v.voyage_code, s.name as station_name, '
        + '       sp.algorithm_version, sp.explanation_json, sp.created_at '
        + 'FROM manifests m '
        + 'JOIN voyages v ON v.id = m.voyage_id '
        + 'JOIN stations s ON s.id = v.destination_station_id '
        + 'LEFT JOIN stowage_plans sp ON sp.manifest_id = m.id '
        + 'WHERE m.id = $1;', [manifestId]);
    if (manifestRow.rows.length === 0) {
        return res.status(404).json({ error: 'Manifest not found' });
    }
    const manifest = manifestRow.rows[0];
    const positions = await pool_1.pool.query('SELECT '
        + 'sp.id as stowage_position_id, '
        + 'sp.stowage_zone, '
        + 'sp.stowage_deck, '
        + 'sp.stowage_position, '
        + 'sp.loading_sequence, '
        + 'sp.unloading_sequence, '
        + 'sp.constraints_notes, '
        + 'mi.id as manifest_item_id, '
        + 'ci.cargo_id, '
        + 'c.cargo_code, '
        + 'it.item_code, '
        + 'it.name as item_name, '
        + 'ci.qty, '
        + 'ci.unit, '
        + 'ci.unloading_priority '
        + 'FROM stowage_positions sp '
        + 'JOIN manifest_items mi ON mi.id = sp.manifest_item_id '
        + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
        + 'JOIN cargo c ON c.id = ci.cargo_id '
        + 'JOIN items it ON it.id = ci.item_id '
        + 'WHERE sp.stowage_plan_id = (SELECT id FROM stowage_plans WHERE manifest_id = $1) '
        + 'ORDER BY sp.loading_sequence;', [manifestId]);
    const items = positions.rows.map((row) => ({
        loadingSequence: row.loading_sequence,
        unloadingSequence: row.unloading_sequence,
        stowageZone: row.stowage_zone,
        stowageDeck: row.stowage_deck,
        stowagePosition: row.stowage_position,
        constraintsNotes: row.constraints_notes,
        cargoCode: row.cargo_code,
        itemCode: row.item_code,
        itemName: row.item_name,
        quantity: row.qty,
        unit: row.unit,
        unloadingPriority: row.unloading_priority,
    }));
    res.json({
        manifest: {
            id: manifest.manifest_id,
            voyageCode: manifest.voyage_code,
            destinationStation: manifest.station_name,
            stowagePlan: manifest.algorithm_version
                ? {
                    algorithmVersion: manifest.algorithm_version,
                    explanation: manifest.explanation_json,
                    createdAt: manifest.created_at,
                }
                : null,
        },
        positions: items,
    });
});
exports.readRouter.get('/inventory/stations/:stationId/forecast-summary', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (req, res) => {
    const { stationId } = req.params;
    const asOfDate = new Date().toISOString().slice(0, 10);
    const inventoryItems = await pool_1.pool.query('SELECT i.id as item_id, i.item_code, i.name, i.unit, inv.quantity '
        + 'FROM inventory inv '
        + 'JOIN items i ON i.id = inv.item_id '
        + 'WHERE inv.station_id = $1 '
        + 'ORDER BY i.item_code;', [stationId]);
    const nextResupplyRes = await pool_1.pool.query('SELECT MAX(planned_resupply_date) as next_resupply_date '
        + 'FROM requirements WHERE station_id = $1 AND planned_resupply_date IS NOT NULL;', [stationId]);
    const nextResupplyDate = nextResupplyRes.rows[0].next_resupply_date;
    const summary = [];
    for (const item of inventoryItems.rows) {
        const avgRow = await pool_1.pool.query('SELECT AVG(quantity_consumed) as avg_daily, COUNT(*) as cnt '
            + 'FROM consumption_records '
            + 'WHERE station_id = $1 AND item_id = $2 '
            + '  AND consumption_date >= ($3::date - INTERVAL \'30 days\')::date;', [stationId, item.item_id, asOfDate]);
        const avg = avgRow.rows[0].avg_daily;
        const cnt = avgRow.rows[0].cnt;
        let riskLevel = 'SAFE';
        let daysRemaining = null;
        let estimatedDepletionDate = null;
        let shortfallDays = null;
        if (avg && cnt > 0 && avg > 0) {
            daysRemaining = Number(item.quantity) / avg;
            if (nextResupplyDate) {
                const daysToNextResupply = Math.floor((new Date(nextResupplyDate).getTime() - new Date(asOfDate).getTime()) / (24 * 60 * 60 * 1000));
                shortfallDays = daysToNextResupply - daysRemaining;
                if (daysRemaining <= 0 || shortfallDays > 0) {
                    riskLevel = 'CRITICAL';
                }
                else {
                    const closeness = Math.abs(shortfallDays);
                    if (closeness <= 15)
                        riskLevel = 'AT_RISK';
                    else if (closeness <= 45)
                        riskLevel = 'WATCH';
                    else
                        riskLevel = 'SAFE';
                }
                estimatedDepletionDate = new Date(new Date(asOfDate).getTime() + Math.floor(daysRemaining * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
            }
        }
        summary.push({
            itemId: item.item_id,
            itemCode: item.item_code,
            itemName: item.name,
            unit: item.unit,
            currentStock: Number(item.quantity),
            averageDailyConsumption: avg,
            daysRemaining,
            estimatedDepletionDate,
            nextResupplyDate,
            shortfallDays,
            riskLevel,
        });
    }
    const stationRow = await pool_1.pool.query('SELECT station_code, name FROM stations WHERE id = $1;', [stationId]);
    const station = stationRow.rows[0] ?? null;
    res.json({
        station,
        nextResupplyDate,
        summary,
        asOfDate,
    });
});
exports.readRouter.get('/dashboard/summary', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']), async (_req, res) => {
    const cargoAwaitingReceipt = await pool_1.pool.query('SELECT COUNT(*) as cnt FROM cargo WHERE status IN (\'IN_TRANSIT\', \'ARRIVED\');');
    const inventoryAtRisk = await pool_1.pool.query(`SELECT COUNT(*) as cnt
       FROM (
         SELECT DISTINCT inv.station_id, inv.item_id
         FROM inventory inv
         WHERE inv.quantity <= inv.safety_stock
       ) t;`);
    const stations = await pool_1.pool.query('SELECT COUNT(*) as cnt FROM stations;');
    const recentIndents = await pool_1.pool.query('SELECT COUNT(*) as cnt FROM indents WHERE created_at >= NOW() - INTERVAL \'7 days\';');
    res.json({
        cargoAwaitingReceipt: Number(cargoAwaitingReceipt.rows[0].cnt),
        inventoryAtRisk: Number(inventoryAtRisk.rows[0].cnt),
        stations: Number(stations.rows[0].cnt),
        recentIndents: Number(recentIndents.rows[0].cnt),
        timestamp: new Date().toISOString(),
    });
});
exports.default = exports.readRouter;
//# sourceMappingURL=read.js.map