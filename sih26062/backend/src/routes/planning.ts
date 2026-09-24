import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

export const planningRouter = Router();

planningRouter.get(
  '/stations',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS']),
  async (_req, res) => {
    const r = await pool.query(
      'SELECT id, station_code, name, timezone, notes FROM stations ORDER BY station_code;'
    );
    res.json({ stations: r.rows });
  }
);

planningRouter.get(
  '/seasons',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS']),
  async (_req, res) => {
    const r = await pool.query(
      'SELECT id, season_code, label, start_date, end_date FROM seasons ORDER BY start_date;'
    );
    res.json({ seasons: r.rows });
  }
);

const requirementLineSchema = z.object({
  itemId: z.string().uuid(),
  requiredQty: z.coerce.number().nonnegative(),
  existingStockQty: z.coerce.number().nonnegative().default(0),
  expectedConsumptionQty: z.coerce.number().nonnegative().default(0),
  safetyStockQty: z.coerce.number().nonnegative().default(0),
  plannedResupplyQty: z.coerce.number().nonnegative().default(0),
  unit: z.string().min(1),
});

const createRequirementSchema = z.object({
  stationId: z.string().uuid(),
  seasonId: z.string().uuid(),
  plannedResupplyDate: z.coerce.date().optional(),
  lines: z.array(requirementLineSchema).min(1),
});

// Create requirement plan + requirement_lines.
planningRouter.post(
  '/requirements',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER']),
  async (req, res) => {
    const input = createRequirementSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.flatten() });

    const { stationId, seasonId, plannedResupplyDate, lines } = input.data;
    const actorUserId = (req as AuthedRequest).user!.userId;

    // Demo-friendly default: if UI doesn’t provide a planned resupply date,
    // assume next resupply is ~150 days from today.
    const resolvedPlannedResupplyDate = plannedResupplyDate
      ? plannedResupplyDate.toISOString().slice(0, 10)
      : new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const created = await pool.query(
      'INSERT INTO requirements (station_id, season_id, planned_resupply_date, created_by) '
        + 'VALUES ($1,$2,$3,$4) '
        + 'ON CONFLICT (station_id, season_id) DO UPDATE '
        + 'SET planned_resupply_date = EXCLUDED.planned_resupply_date, created_by = EXCLUDED.created_by '
        + 'RETURNING id;',
      [stationId, seasonId, resolvedPlannedResupplyDate, actorUserId]
    );

    const requirementId = created.rows[0].id as string;

    await pool.query('DELETE FROM requirement_lines WHERE requirement_id = $1;', [requirementId]);

    for (const line of lines) {
      await pool.query(
        'INSERT INTO requirement_lines '
          + '(requirement_id, item_id, required_qty, existing_stock_qty, expected_consumption_qty, safety_stock_qty, planned_resupply_qty, unit) '
          + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);',
        [
          requirementId,
          line.itemId,
          line.requiredQty,
          line.existingStockQty,
          line.expectedConsumptionQty,
          line.safetyStockQty,
          line.plannedResupplyQty,
          line.unit,
        ]
      );
    }

    res.json({ requirementId });
  }
);

const createIndentSchema = z.object({
  indentCode: z.string().min(1),
});

planningRouter.post(
  '/requirements/:requirementId/indents',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER']),
  async (req, res) => {
    const input = createIndentSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.flatten() });

    const requirementId = req.params.requirementId;
    const { indentCode } = input.data;

    const trx = await pool.connect();
    try {
      await trx.query('BEGIN');

      const r = await trx.query(
        'SELECT station_id, season_id FROM requirements WHERE id = $1;',
        [requirementId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Requirement not found' });

      const { station_id: stationId, season_id: seasonId } = r.rows[0];

      const indentIns = await trx.query(
        'INSERT INTO indents (indent_code, station_id, season_id, status, created_by) '
          + 'VALUES ($1,$2,$3,$4,$5) RETURNING id;',
        [indentCode, stationId, seasonId, 'DRAFT', (req as AuthedRequest).user!.userId]
      );
      const indentId = indentIns.rows[0].id as string;

      const lines = await trx.query(
        'SELECT item_id, required_qty, existing_stock_qty, safety_stock_qty, planned_resupply_qty, unit '
          + 'FROM requirement_lines WHERE requirement_id = $1;',
        [requirementId]
      );

      for (const l of lines.rows) {
        await trx.query(
          'INSERT INTO indent_items '
            + '(indent_id, item_id, required_qty, unit, existing_stock_snapshot, safety_stock_qty, planned_resupply_qty) '
            + 'VALUES ($1,$2,$3,$4,$5,$6,$7);',
          [
            indentId,
            l.item_id,
            l.required_qty,
            l.unit,
            l.existing_stock_qty,
            l.safety_stock_qty,
            l.planned_resupply_qty,
          ]
        );
      }

      await trx.query('COMMIT');
      res.json({ indentId });
    } catch (e) {
      await trx.query('ROLLBACK');
      throw e;
    } finally {
      trx.release();
    }
  }
);

planningRouter.post(
  '/indents/:indentId/approve',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER']),
  async (req, res) => {
    const indentId = req.params.indentId;
    const actorUserId = (req as AuthedRequest).user!.userId;

    const r = await pool.query('SELECT status FROM indents WHERE id = $1;', [indentId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Indent not found' });

    const current = r.rows[0].status as string;
    if (current !== 'DRAFT' && current !== 'INDENTED') {
      return res.status(409).json({ error: `Indent cannot be approved from status ${current}` });
    }

    const upd = await pool.query(
      'UPDATE indents SET status = $1, approved_by = $2, approved_at = now() WHERE id = $3 RETURNING id;',
      ['APPROVED', actorUserId, indentId]
    );

    await pool.query(
      'INSERT INTO indent_status_history (indent_id, from_status, to_status, changed_by, notes) '
        + 'VALUES ($1,$2,$3,$4,$5);',
      [indentId, current, 'APPROVED', actorUserId, 'Approved indent']
    );

    res.json({ indentId: upd.rows[0].id });
  }
);

const createCargoSchema = z.object({
  cargoCode: z.string().min(1),
});

// Convert an approved indent into cargo consignments.
planningRouter.post(
  '/indents/:indentId/cargo',
  requireAuth,
  requireRole(['ADMIN', 'LOGISTICS']),
  async (req, res) => {
    const input = createCargoSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.flatten() });

    const indentId = req.params.indentId;
    const actorUserId = (req as AuthedRequest).user!.userId;

    const indentRow = await pool.query('SELECT status, station_id FROM indents WHERE id = $1;', [indentId]);
    if (indentRow.rows.length === 0) return res.status(404).json({ error: 'Indent not found' });
    if (indentRow.rows[0].status !== 'APPROVED') {
      return res.status(409).json({ error: 'Indent must be APPROVED before converting to cargo' });
    }

    const stationId = indentRow.rows[0].station_id as string;

    const trx = await pool.connect();
    try {
      await trx.query('BEGIN');

      const cargoIns = await trx.query(
        'INSERT INTO cargo (cargo_code, indent_id, status, created_by) VALUES ($1,$2,$3,$4) RETURNING id;',
        [input.data.cargoCode, indentId, 'APPROVED', actorUserId]
      );
      const cargoId = cargoIns.rows[0].id as string;

      const itemRows = await trx.query(
        'SELECT ii.item_id, ii.planned_resupply_qty, ii.unit, i.item_type, i.requires_special_handling, i.hazard_class '
          + 'FROM indent_items ii JOIN items i ON i.id = ii.item_id '
          + 'WHERE ii.indent_id = $1;',
        [indentId]
      );

      function defaultUnloadingPriority(itemType: string | null, requiresSpecial: boolean) {
        // Lower unloading_priority => earlier unloading.
        if (itemType === 'FUEL') return 10;
        if (itemType === 'CONSUMABLE') return 20;
        if (requiresSpecial) return 30;
        return 40;
      }

      for (const r1 of itemRows.rows) {
        const itemType = r1.item_type as string;
        const qty = Number(r1.planned_resupply_qty);

        if (!qty || qty === 0) continue;

        const unloadingPriority = defaultUnloadingPriority(itemType, Boolean(r1.requires_special_handling));

        await trx.query(
          'INSERT INTO cargo_items '
            + '(cargo_id, item_id, qty, unit, destination_station_id, cargo_type, hazard_class, unloading_priority) '
            + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);',
          [
            cargoId,
            r1.item_id,
            qty,
            r1.unit ?? null,
            stationId,
            'STANDARD',
            r1.hazard_class,
            unloadingPriority,
          ]
        );
      }

      await trx.query('COMMIT');
      res.json({ cargoId });
    } catch (e) {
      await trx.query('ROLLBACK');
      throw e;
    } finally {
      trx.release();
    }
  }
);
