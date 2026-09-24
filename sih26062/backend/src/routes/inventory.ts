import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

export const inventoryRouter = Router();

const consumptionSchema = z.object({
  date: z.coerce.date().optional(),
  quantityConsumed: z.coerce.number().positive(),
  unit: z.string().min(1),
  source: z.string().optional(),
  notes: z.string().optional(),
});

inventoryRouter.post(
  '/stations/:stationId/items/:itemId/consumption',
  requireAuth,
  requireRole(['ADMIN', 'LOGISTICS', 'MEDICAL']),
  async (req, res) => {
    const input = consumptionSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.flatten() });

    const { stationId, itemId } = req.params;
    const qty = input.data.quantityConsumed;
    const date = input.data.date
      ? input.data.date.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const unit = input.data.unit;

    const trx = await pool.connect();
    try {
      await trx.query('BEGIN');

      // Ensure inventory row exists.
      await trx.query(
        'INSERT INTO inventory (station_id, item_id, quantity, unit, average_daily_consumption, minimum_stock, safety_stock, last_updated) '
          + 'VALUES ($1,$2,0,$3,NULL,0,0,now()) '
          + 'ON CONFLICT (station_id, item_id) DO NOTHING;',
        [stationId, itemId, unit]
      );

      // Upsert consumption record (so the demo can be run idempotently).
      await trx.query(
        'INSERT INTO consumption_records '
          + '(station_id, item_id, consumption_date, quantity_consumed, unit, source, notes) '
          + 'VALUES ($1,$2,$3,$4,$5,$6,$7) '
          + 'ON CONFLICT (station_id, item_id, consumption_date) DO UPDATE '
          + 'SET quantity_consumed = EXCLUDED.quantity_consumed, '
          + '    unit = EXCLUDED.unit, '
          + '    source = EXCLUDED.source, '
          + '    notes = EXCLUDED.notes;',
        [
          stationId,
          itemId,
          date,
          qty,
          unit,
          input.data.source ?? null,
          input.data.notes ?? null,
        ]
      );

      // Decrement inventory.
      await trx.query(
        'UPDATE inventory '
          + 'SET quantity = quantity - $1, last_updated = now() '
          + 'WHERE station_id = $2 AND item_id = $3;',
        [qty, stationId, itemId]
      );

      // Transaction record.
      await trx.query(
        'INSERT INTO inventory_transactions '
          + '(station_id, item_id, transaction_type, qty_delta, unit, source_type, source_id, occurred_at, notes) '
          + 'VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8);',
        [
          stationId,
          itemId,
          'CONSUME',
          -qty,
          unit,
          'CONSUMPTION_RECORD',
          // source_id isn't modeled for consumption; keep NULL.
          null,
          input.data.notes ?? null,
        ]
      );

      // Recompute average_daily_consumption from last 30 days observations.
      const avgRes = await trx.query(
        'SELECT AVG(quantity_consumed) AS avg_daily, COUNT(*)::int AS cnt '
          + 'FROM consumption_records '
          + 'WHERE station_id = $1 AND item_id = $2 '
          + '  AND consumption_date >= (CURRENT_DATE - INTERVAL \'30 days\')::date;',
        [stationId, itemId]
      );

      const avg = avgRes.rows[0].avg_daily as number | null;
      const cnt = avgRes.rows[0].cnt as number;

      if (avg === null || cnt === 0) {
        await trx.query(
          'UPDATE inventory SET average_daily_consumption = NULL, last_updated = now() '
            + 'WHERE station_id=$1 AND item_id=$2;',
          [stationId, itemId]
        );
      } else {
        await trx.query(
          'UPDATE inventory SET average_daily_consumption = $1, last_updated = now() '
            + 'WHERE station_id=$2 AND item_id=$3;',
          [avg, stationId, itemId]
        );
      }

      // Clamp negative quantity to 0 for forecasting safety.
      await trx.query(
        'UPDATE inventory SET quantity = GREATEST(quantity, 0) '
          + 'WHERE station_id=$1 AND item_id=$2;',
        [stationId, itemId]
      );

      await trx.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await trx.query('ROLLBACK');
      throw e;
    } finally {
      trx.release();
    }
  }
);

const forecastParamsSchema = z.object({
  asOfDate: z.coerce.date().optional(),
});

inventoryRouter.get(
  '/forecast/stations/:stationId/items/:itemId',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']),
  async (req, res) => {
    const input = forecastParamsSchema.safeParse(req.query);
    if (!input.success) return res.status(400).json({ error: input.error.flatten() });

    const { stationId, itemId } = req.params;
    const asOfDate = input.data.asOfDate
      ? input.data.asOfDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const inventory = await pool.query(
      'SELECT quantity, unit, average_daily_consumption, safety_stock '
        + 'FROM inventory WHERE station_id=$1 AND item_id=$2;',
      [stationId, itemId]
    );

    if (inventory.rows.length === 0) {
      return res.status(404).json({ error: 'No inventory record for station+item' });
    }

    const inv = inventory.rows[0];
    const currentStock = Number(inv.quantity);

    // Compute avg from the last 30 days; we rely on seeded or recorded consumption.
    const cons = await pool.query(
      'SELECT AVG(quantity_consumed) AS avg_daily, COUNT(*)::int AS cnt '
        + 'FROM consumption_records '
        + 'WHERE station_id=$1 AND item_id=$2 '
        + '  AND consumption_date >= ($3::date - INTERVAL \'30 days\')::date;',
      [stationId, itemId, asOfDate]
    );

    const avgDaily = cons.rows[0].avg_daily as number | null;
    const cnt = cons.rows[0].cnt as number;

    if (avgDaily === null || cnt === 0) {
      return res.status(200).json({
        riskLevel: 'WATCH',
        message: 'Insufficient consumption history for reliable forecast.',
        currentStock,
        averageDailyConsumption: null,
      });
    }

    const daysRemaining = avgDaily <= 0 ? null : currentStock / avgDaily;

    const nextResupply = await pool.query(
      'SELECT MAX(planned_resupply_date) AS next_resupply_date '
        + 'FROM requirements '
        + 'WHERE station_id = $1 AND planned_resupply_date IS NOT NULL;',
      [stationId]
    );

    const nextResupplyDate = nextResupply.rows[0].next_resupply_date as string | null;

    if (!nextResupplyDate) {
      return res.status(200).json({
        riskLevel: 'WATCH',
        message: 'No next resupply date found for forecast.',
        currentStock,
        averageDailyConsumption: avgDaily,
      });
    }

    if (daysRemaining === null) {
      return res.status(200).json({
        riskLevel: 'SAFE',
        currentStock,
        averageDailyConsumption: avgDaily,
        daysRemaining: null,
        nextResupplyDate,
      });
    }

    const daysToNextResupply = Math.floor(
      (new Date(nextResupplyDate).getTime() - new Date(asOfDate).getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const shortfallDays = daysToNextResupply - daysRemaining;

    const estimatedDepletion = new Date(
      new Date(asOfDate).getTime() + Math.floor(daysRemaining * 24 * 60 * 60 * 1000)
    );

    let riskLevel: string;
    if (daysRemaining <= 0) riskLevel = 'CRITICAL';
    else if (shortfallDays > 0) riskLevel = 'CRITICAL';
    else {
      const closeness = Math.abs(shortfallDays);
      if (closeness <= 15) riskLevel = 'AT_RISK';
      else if (closeness <= 45) riskLevel = 'WATCH';
      else riskLevel = 'SAFE';
    }

    return res.json({
      itemId,
      stationId,
      currentStock,
      averageDailyConsumption: avgDaily,
      daysRemaining,
      estimatedDepletionDate: estimatedDepletion.toISOString().slice(0, 10),
      nextResupplyDate,
      daysToNextResupply,
      shortfallDays,
      riskLevel,
      recommendedAction:
        riskLevel === 'CRITICAL'
          ? 'Initiate resupply adjustment / expedite cargo preparation.'
          : riskLevel === 'AT_RISK'
            ? 'Monitor consumption closely and confirm next resupply readiness.'
            : 'No immediate action required.',
    });
  }
);

inventoryRouter.get(
  '/dashboard/alerts',
  requireAuth,
  requireRole(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL']),
  async (_req, res) => {
    const asOfDate = new Date().toISOString().slice(0, 10);

    const invPairs = await pool.query('SELECT DISTINCT station_id, item_id FROM inventory;');

    const alerts: any[] = [];

    for (const pair of invPairs.rows) {
      const current = await pool.query(
        'SELECT quantity, average_daily_consumption FROM inventory '
          + 'WHERE station_id=$1 AND item_id=$2;',
        [pair.station_id, pair.item_id]
      );
      if (current.rows.length === 0) continue;

      const currentStock = Number(current.rows[0].quantity);

      const cons = await pool.query(
        'SELECT AVG(quantity_consumed) AS avg_daily, COUNT(*)::int AS cnt '
          + 'FROM consumption_records '
          + 'WHERE station_id=$1 AND item_id=$2 '
          + '  AND consumption_date >= ($3::date - INTERVAL \'30 days\')::date;',
        [pair.station_id, pair.item_id, asOfDate]
      );

      const avgDailyHist = cons.rows[0].avg_daily as number | null;
      const cnt = cons.rows[0].cnt as number;
      if (avgDailyHist === null || cnt === 0) continue;

      const daysRemaining = currentStock / avgDailyHist;

      const nextRes = await pool.query(
        'SELECT MAX(planned_resupply_date) AS next_resupply_date '
          + 'FROM requirements WHERE station_id=$1 AND planned_resupply_date IS NOT NULL;',
        [pair.station_id]
      );

      const nextResupplyDate = nextRes.rows[0].next_resupply_date as string | null;
      if (!nextResupplyDate) continue;

      const daysToNextResupply = Math.floor(
        (new Date(nextResupplyDate).getTime() - new Date(asOfDate).getTime()) /
          (24 * 60 * 60 * 1000)
      );

      const shortfallDays = daysToNextResupply - daysRemaining;

      let riskLevel: string;
      if (daysRemaining <= 0 || shortfallDays > 0) riskLevel = 'CRITICAL';
      else {
        const closeness = Math.abs(shortfallDays);
        if (closeness <= 15) riskLevel = 'AT_RISK';
        else if (closeness <= 45) riskLevel = 'WATCH';
        else riskLevel = 'SAFE';
      }

      if (riskLevel !== 'CRITICAL' && riskLevel !== 'AT_RISK') continue;

      const stationName = (await pool.query('SELECT name FROM stations WHERE id=$1;', [pair.station_id])).rows[0]?.name ?? 'Station';
      const itemRow = await pool.query(
        'SELECT name, item_code FROM items WHERE id=$1;',
        [pair.item_id]
      );

      const itemName = itemRow.rows[0]?.name ?? itemRow.rows[0]?.item_code ?? pair.item_id;

      alerts.push({
        id: `${pair.station_id}:${pair.item_id}:${riskLevel}`,
        station: stationName,
        item: itemName,
        riskLevel,
        message:
          riskLevel === 'CRITICAL'
            ? `${itemName} is projected to run out approximately ${Math.round(shortfallDays)} days before the next resupply.`
            : `${itemName} is at risk; depletion is close to the next resupply.`,
        calculatedAt: asOfDate,
      });
    }

    res.json({ alerts });
  }
);
