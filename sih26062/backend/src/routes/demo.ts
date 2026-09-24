import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

export const demoRouter = Router();

const runSchema = z.object({
  stationCode: z.string().min(1).default('MAITRI'),
  seasonCode: z.string().min(1).default('2027-28'),
  requirementCode: z.string().min(1).optional(),

  indentCode: z.string().min(1).default('IND-2027-001'),
  cargoCode: z.string().min(1).default('CARGO-2027-001'),
  voyageCode: z.string().min(1).default('VOY-001'),
  vesselName: z.string().min(1).default('MV-Antarctica-07'),
  departurePort: z.string().min(1).default('Cape Town'),
  plannedDepartureDate: z.coerce.date().optional(),

  // Demo quantities
  fuelQty: z.coerce.number().positive().default(50000),
  foodQty: z.coerce.number().positive().default(8000),
  sparesQty: z.coerce.number().positive().default(500),

  consumptionTodayQty: z.coerce.number().positive().default(550),
  consumptionUnit: z.string().min(1).default('L'),
});

function daysFromToday(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

demoRouter.post('/run-critical-workflow', requireAuth, requireRole(['ADMIN', 'PLANNER', 'LOGISTICS']), async (req, res) => {
  const input = runSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error.flatten() });

  const actorUserId = (req as AuthedRequest).user!.userId;

  const {
    stationCode,
    seasonCode,
    indentCode,
    cargoCode,
    voyageCode,
    vesselName,
    departurePort,
    plannedDepartureDate,
    fuelQty,
    foodQty,
    sparesQty,
    consumptionTodayQty,
    consumptionUnit,
  } = input.data;

  const trx = await pool.connect();
  try {
    await trx.query('BEGIN');

    // Resolve IDs
    const station = await trx.query('SELECT id, station_code, name FROM stations WHERE station_code=$1;', [stationCode]);
    if (station.rows.length === 0) throw new Error(`Station not found: ${stationCode}`);
    const stationId = station.rows[0].id as string;

    const season = await trx.query('SELECT id, season_code FROM seasons WHERE season_code=$1;', [seasonCode]);
    if (season.rows.length === 0) throw new Error(`Season not found: ${seasonCode}`);
    const seasonId = season.rows[0].id as string;

    const [fuelItem] = (await trx.query('SELECT id, unit, item_code FROM items WHERE item_code=$1;', ['FUEL'])).rows;
    const [foodItem] = (await trx.query('SELECT id, unit, item_code FROM items WHERE item_code=$1;', ['FOOD'])).rows;
    const [sparesItem] = (await trx.query('SELECT id, unit, item_code FROM items WHERE item_code=$1;', ['SPARES'])).rows;

    // STEP 2: create/update seasonal requirement
    const plannedResupplyDate = daysFromToday(150);

    const reqUpsert = await trx.query(
      'INSERT INTO requirements (station_id, season_id, planned_resupply_date, created_by) '
        + 'VALUES ($1,$2,$3,$4) '
        + 'ON CONFLICT (station_id, season_id) DO UPDATE '
        + 'SET planned_resupply_date = EXCLUDED.planned_resupply_date, '
        + '    created_by = EXCLUDED.created_by '
        + 'RETURNING id;',
      [stationId, seasonId, plannedResupplyDate, actorUserId]
    );
    const requirementId = reqUpsert.rows[0].id as string;

    // Replace requirement_lines for the demo items
    await trx.query('DELETE FROM requirement_lines WHERE requirement_id = $1;', [requirementId]);

    async function insertReqLine(item: any, qty: number) {
      await trx.query(
        'INSERT INTO requirement_lines '
          + '(requirement_id, item_id, required_qty, existing_stock_qty, expected_consumption_qty, safety_stock_qty, planned_resupply_qty, unit) '
          + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);',
        [requirementId, item.id, qty, 0, qty, 0, qty, item.unit]
      );
    }

    await insertReqLine(fuelItem, fuelQty);
    await insertReqLine(foodItem, foodQty);
    await insertReqLine(sparesItem, sparesQty);

    // STEP 3: create indent for Fuel only
    const indentIns = await trx.query(
      'INSERT INTO indents (indent_code, station_id, season_id, status, created_by) '
        + 'VALUES ($1,$2,$3,$4,$5) '
        + 'RETURNING id;',
      [indentCode, stationId, seasonId, 'DRAFT', actorUserId]
    );
    const indentId = indentIns.rows[0].id as string;

    const fuelReqLine = await trx.query(
      'SELECT required_qty, existing_stock_qty, safety_stock_qty, planned_resupply_qty, unit '
        + 'FROM requirement_lines WHERE requirement_id=$1 AND item_id=$2;',
      [requirementId, fuelItem.id]
    );

    await trx.query(
      'INSERT INTO indent_items (indent_id, item_id, required_qty, unit, existing_stock_snapshot, safety_stock_qty, planned_resupply_qty) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7);',
      [
        indentId,
        fuelItem.id,
        Number(fuelReqLine.rows[0].required_qty),
        fuelReqLine.rows[0].unit,
        Number(fuelReqLine.rows[0].existing_stock_qty),
        Number(fuelReqLine.rows[0].safety_stock_qty),
        Number(fuelReqLine.rows[0].planned_resupply_qty),
      ]
    );

    // STEP 4: approve indent
    await trx.query(
      'UPDATE indents SET status=$1, approved_by=$2, approved_at=now() WHERE id=$3;',
      ['APPROVED', actorUserId, indentId]
    );
    await trx.query(
      'INSERT INTO indent_status_history (indent_id, from_status, to_status, changed_by, notes) '
        + 'VALUES ($1,$2,$3,$4,$5);',
      [indentId, 'DRAFT', 'APPROVED', actorUserId, 'Approved indent']
    );

    // STEP 5: convert indent → cargo
    const cargoIns = await trx.query(
      'INSERT INTO cargo (cargo_code, indent_id, status, created_by) '
        + 'VALUES ($1,$2,$3,$4) RETURNING id;',
      [cargoCode, indentId, 'APPROVED', actorUserId]
    );
    const cargoId = cargoIns.rows[0].id as string;

    const unloadPriority = 10; // fuel -> earlier unload

    await trx.query(
      'INSERT INTO cargo_items '
        + '(cargo_id, item_id, qty, unit, destination_station_id, cargo_type, hazard_class, unloading_priority) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8);',
      [cargoId, fuelItem.id, fuelQty, consumptionUnit, stationId, 'STANDARD', null, unloadPriority]
    );

    // STEP 6: voyage + manifest + add cargo
    const depDate = plannedDepartureDate
      ? plannedDepartureDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const voyageIns = await trx.query(
      'INSERT INTO voyages (voyage_code, vessel_name, departure_port, destination_station_id, departure_date, expected_arrival, status, capacity_notes, created_by) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id;',
      [voyageCode, vesselName, departurePort, stationId, depDate, depDate, 'PLANNED', null, actorUserId]
    );
    const voyageId = voyageIns.rows[0].id as string;

    // Manifest
    const manifestIns = await trx.query(
      'INSERT INTO manifests (voyage_id, status, created_by) '
        + 'VALUES ($1,$2,$3) ON CONFLICT (voyage_id) DO NOTHING RETURNING id;',
      [voyageId, 'DRAFT', actorUserId]
    );

    let manifestId: string;
    if (manifestIns.rows.length > 0) {
      manifestId = manifestIns.rows[0].id as string;
    } else {
      manifestId = (await trx.query('SELECT id FROM manifests WHERE voyage_id=$1;', [voyageId])).rows[0].id;
    }

    // Add cargo items to manifest_items
    await trx.query(
      'INSERT INTO manifest_items (manifest_id, cargo_item_id, station_id, weight_kg, volume_m3, priority, unloading_priority, destination_station_id, loading_sequence_recommended, loading_sequence_final, unloading_sequence_final, stowage_zone, stowage_deck, stowage_position, status) '
        + 'SELECT $1, ci.id, ci.destination_station_id, NULL, NULL, 100, $2, ci.destination_station_id, NULL, NULL, NULL, NULL, NULL, NULL, $3 '
        + 'FROM cargo_items ci WHERE ci.cargo_id=$4 AND ci.destination_station_id=$5;',
      [manifestId, unloadPriority, 'ACTIVE', cargoId, stationId]
    );

    // cargo -> MANIFESTED
    await trx.query('UPDATE cargo SET status=$1 WHERE id=$2;', ['MANIFESTED', cargoId]);
    await trx.query(
      'INSERT INTO cargo_status_history (cargo_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [cargoId, 'APPROVED', 'MANIFESTED', actorUserId, 'Cargo manifested']
    );

    // STEP 7: generate stowage plan (based on unloading order)
    const manifestItems = await trx.query(
      'SELECT mi.id as manifest_item_id, mi.unloading_priority, mi.priority, mi.cargo_item_id, mi.destination_station_id, ci.hazard_class '
        + 'FROM manifest_items mi '
        + 'JOIN cargo_items ci ON ci.id = mi.cargo_item_id '
        + 'WHERE mi.manifest_id=$1 AND mi.status=\'ACTIVE\';',
      [manifestId]
    );

    const sortedForUnload = [...manifestItems.rows].sort((a, b) => {
      const ua = a.unloading_priority ?? 100;
      const ub = b.unloading_priority ?? 100;
      if (ua !== ub) return ua - ub;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    const n = sortedForUnload.length;

    await trx.query('DELETE FROM stowage_positions WHERE stowage_plan_id IN (SELECT id FROM stowage_plans WHERE manifest_id=$1);', [manifestId]);
    await trx.query('DELETE FROM stowage_plans WHERE manifest_id=$1;', [manifestId]);

    const planIns = await trx.query(
      'INSERT INTO stowage_plans (manifest_id, algorithm_version, explanation_json, created_by) '
        + 'VALUES ($1,$2,$3,$4) RETURNING id;',
      [manifestId, 'v1-demo', JSON.stringify({ rule: 'last-loaded-first-unloaded' }), actorUserId]
    );
    const stowagePlanId = planIns.rows[0].id as string;

    for (let idx = 0; idx < n; idx++) {
      const unloadIndex = idx + 1;
      const loadingIndex = n - idx;
      const mi = sortedForUnload[idx];

      const zone = unloadIndex <= 3 ? 'ZONE_A' : unloadIndex <= 6 ? 'ZONE_B' : 'ZONE_C';
      const deck = zone === 'ZONE_A' ? 'DECK_1' : zone === 'ZONE_B' ? 'DECK_2' : 'DECK_1';
      const positionLabel = `P${zone.replace('ZONE_', '')}-${loadingIndex}`;

      await trx.query(
        'INSERT INTO stowage_positions '
          + '(stowage_plan_id, manifest_item_id, stowage_zone, stowage_deck, stowage_position, loading_sequence, unloading_sequence, destination_station_id, constraints_notes) '
          + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);',
        [
          stowagePlanId,
          mi.manifest_item_id,
          zone,
          deck,
          positionLabel,
          loadingIndex,
          unloadIndex,
          mi.destination_station_id,
          mi.hazard_class ? `Hazard: ${mi.hazard_class}` : null,
        ]
      );

      await trx.query(
        'UPDATE manifest_items '
          + 'SET loading_sequence_recommended=$1, loading_sequence_final=$1, unloading_sequence_final=$2 '
          + 'WHERE id=$3;',
        [loadingIndex, unloadIndex, mi.manifest_item_id]
      );
    }

    // STEP 8: mark cargo as loaded
    await trx.query('UPDATE manifests SET status=$1 WHERE id=$2;', ['LOADED', manifestId]);
    await trx.query('UPDATE cargo SET status=$1 WHERE id=$2;', ['LOADED', cargoId]);
    await trx.query(
      'INSERT INTO cargo_status_history (cargo_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [cargoId, 'MANIFESTED', 'LOADED', actorUserId, 'Cargo loaded']
    );

    // STEP 9: start voyage
    await trx.query('UPDATE voyages SET status=$1 WHERE id=$2;', ['DEPARTED', voyageId]);
    await trx.query('UPDATE cargo SET status=$1 WHERE id=$2;', ['IN_TRANSIT', cargoId]);
    await trx.query(
      'INSERT INTO voyage_status_history (voyage_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [voyageId, 'PLANNED', 'DEPARTED', actorUserId, 'Voyage departed']
    );
    await trx.query(
      'INSERT INTO cargo_status_history (cargo_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [cargoId, 'LOADED', 'IN_TRANSIT', actorUserId, 'Voyage in transit']
    );

    // STEP 10/11: mark cargo as received + inventory update
    const actualArrivalDate = new Date().toISOString().slice(0, 10);
    await trx.query('UPDATE voyages SET status=$1, actual_arrival=$2 WHERE id=$3;', ['ARRIVED', actualArrivalDate, voyageId]);
    await trx.query('UPDATE cargo SET status=$1 WHERE id=$2;', ['RECEIVED', cargoId]);
    await trx.query(
      'INSERT INTO voyage_status_history (voyage_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [voyageId, 'DEPARTED', 'ARRIVED', actorUserId, 'Voyage arrived']
    );
    await trx.query(
      'INSERT INTO cargo_status_history (cargo_id, from_status, to_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5);',
      [cargoId, 'IN_TRANSIT', 'RECEIVED', actorUserId, 'Cargo received at station']
    );
    await trx.query('UPDATE manifests SET status=$1 WHERE id=$2;', ['RECEIVED', manifestId]);

    await trx.query(
      'INSERT INTO inventory (station_id, item_id, quantity, unit, average_daily_consumption, minimum_stock, safety_stock, last_updated) '
        + 'VALUES ($1,$2,$3,$4,NULL,0,0,now()) '
        + 'ON CONFLICT (station_id, item_id) DO UPDATE '
        + 'SET quantity = inventory.quantity + EXCLUDED.quantity, '
        + '    unit = EXCLUDED.unit, '
        + '    last_updated = now();',
      [stationId, fuelItem.id, fuelQty, consumptionUnit]
    );

    await trx.query(
      'INSERT INTO inventory_transactions (station_id, item_id, transaction_type, qty_delta, unit, source_type, source_id, occurred_at, notes) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8);',
      [stationId, fuelItem.id, 'RECEIVE', fuelQty, consumptionUnit, 'VOYAGE_RECEIPT', cargoId, 'Cargo received at station']
    );

    // STEP 12: record consumption today (idempotent because endpoint upserts)
    // Use consumption endpoint logic directly for correctness (avoid HTTP).
    await trx.query(
      'INSERT INTO consumption_records '
        + '(station_id, item_id, consumption_date, quantity_consumed, unit, source, notes) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7) '
        + 'ON CONFLICT (station_id, item_id, consumption_date) DO UPDATE '
        + 'SET quantity_consumed = EXCLUDED.quantity_consumed, '
        + '    unit = EXCLUDED.unit, '
        + '    source = EXCLUDED.source, '
        + '    notes = EXCLUDED.notes;',
      [stationId, fuelItem.id, actualArrivalDate, consumptionTodayQty, consumptionUnit, 'DEMO_FLOW', 'Demo consumption']
    );

    await trx.query(
      'UPDATE inventory SET quantity = quantity - $1, last_updated = now() '
        + 'WHERE station_id=$2 AND item_id=$3;',
      [consumptionTodayQty, stationId, fuelItem.id]
    );

    await trx.query(
      'INSERT INTO inventory_transactions (station_id, item_id, transaction_type, qty_delta, unit, source_type, source_id, occurred_at, notes) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8);',
      [stationId, fuelItem.id, 'CONSUME', -consumptionTodayQty, consumptionUnit, 'CONSUMPTION_RECORD', null, 'Demo consumption']
    );

    // Recompute average_daily_consumption from last 30 days.
    const avgRes = await trx.query(
      'SELECT AVG(quantity_consumed) AS avg_daily, COUNT(*)::int AS cnt '
        + 'FROM consumption_records '
        + 'WHERE station_id=$1 AND item_id=$2 '
        + '  AND consumption_date >= (CURRENT_DATE - INTERVAL \'30 days\')::date;',
      [stationId, fuelItem.id]
    );

    const avgDaily = avgRes.rows[0].avg_daily as number | null;
    const cnt = avgRes.rows[0].cnt as number;

    if (avgDaily === null || cnt === 0) {
      await trx.query(
        'UPDATE inventory SET average_daily_consumption=NULL, last_updated=now() '
          + 'WHERE station_id=$1 AND item_id=$2;',
        [stationId, fuelItem.id]
      );
    } else {
      await trx.query(
        'UPDATE inventory SET average_daily_consumption=$1, last_updated=now() '
          + 'WHERE station_id=$2 AND item_id=$3;',
        [avgDaily, stationId, fuelItem.id]
      );
    }

    await trx.query(
      'UPDATE inventory SET quantity = GREATEST(quantity,0) WHERE station_id=$1 AND item_id=$2;',
      [stationId, fuelItem.id]
    );

    await trx.query('COMMIT');

    // Compute forecast and alerts for response.
    const invRow = (await pool.query('SELECT quantity FROM inventory WHERE station_id=$1 AND item_id=$2;', [stationId, fuelItem.id])).rows[0];
    const invStock = Number(invRow.quantity);

    const consAvg = (await pool.query(
      'SELECT AVG(quantity_consumed) AS avg_daily, COUNT(*)::int AS cnt '
        + 'FROM consumption_records '
        + 'WHERE station_id=$1 AND item_id=$2 '
        + '  AND consumption_date >= (CURRENT_DATE - INTERVAL \'30 days\')::date;',
      [stationId, fuelItem.id]
    )).rows[0];

    const avgDailyConsumption = Number(consAvg.avg_daily);

    const reqNext = (await pool.query(
      'SELECT MAX(planned_resupply_date) AS next_resupply_date '
        + 'FROM requirements WHERE station_id=$1 AND planned_resupply_date IS NOT NULL;',
      [stationId]
    )).rows[0].next_resupply_date as string;

    const daysRemaining = invStock / avgDailyConsumption;
    const daysToNextResupply = Math.floor(
      (new Date(reqNext).getTime() - new Date(actualArrivalDate).getTime()) / (24 * 60 * 60 * 1000)
    );
    const shortfallDays = daysToNextResupply - daysRemaining;

    const riskLevel = shortfallDays > 0 ? 'CRITICAL' : 'SAFE';

    const stowagePositions = await pool.query(
      'SELECT loading_sequence, unloading_sequence, stowage_zone, stowage_deck, stowage_position '
        + 'FROM stowage_positions sp '
        + 'JOIN stowage_plans p ON p.id = sp.stowage_plan_id '
        + 'WHERE p.manifest_id=$1 ORDER BY loading_sequence ASC;',
      [manifestId]
    );

    res.json({
      ids: { stationId, seasonId, requirementId, indentId, cargoId, voyageId, manifestId },
      stowage: stowagePositions.rows,
      forecast: {
        item: 'FUEL',
        currentStock: invStock,
        averageDailyConsumption: avgDailyConsumption,
        daysRemaining,
        nextResupplyDate: reqNext,
        daysToNextResupply,
        shortfallDays,
        riskLevel,
      },
    });
  } catch (e: any) {
    await trx.query('ROLLBACK');
    res.status(500).json({ error: e?.message ?? String(e) });
  } finally {
    trx.release();
  }
});
