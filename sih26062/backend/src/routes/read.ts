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
        + '       indd.id as indent_id, s.station_code, s.name as station_name '
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
