import { Router } from 'express';

import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const readRouter = Router();

// Inventory list for a station
readRouter.get(
  '/inventory/stations/:stationId/items',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']),
  async (req, res) => {
    const { stationId } = req.params;

    const r = await pool.query(
      'SELECT i.id as item_id, i.item_code, i.name, i.unit, inv.quantity, inv.average_daily_consumption, inv.safety_stock '
        + 'FROM inventory inv '
        + 'JOIN items i ON i.id = inv.item_id '
        + 'WHERE inv.station_id = $1 '
        + 'ORDER BY i.item_code;',
      [stationId]
    );

    res.json({ items: r.rows });
  }
);

readRouter.get(
  '/shipping/cargo/:cargoId',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']),
  async (req, res) => {
    const { cargoId } = req.params;

    const cRow = await pool.query(
      'SELECT c.id, c.cargo_code, c.status, c.created_at, '
        + '       indd.id as indent_id, '
        + '       s.station_code, s.name as station_name '
        + 'FROM cargo c '
        + 'JOIN indents indd ON indd.id = c.indent_id '
        + 'JOIN stations s ON s.id = indd.station_id '
        + 'WHERE c.id = $1;',
      [cargoId]
    );

    const cargo = cRow.rows[0] ?? null;
    res.json({ cargo });
  }
);

readRouter.get(
  '/shipping/cargo/:cargoId/timeline',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']),
  async (req, res) => {
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

    const r = await pool.query(sql, [cargoId]);

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
  }
);

export default readRouter;
