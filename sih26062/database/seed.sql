-- SIH26062 Seed Data
-- Demo seed/reference data.
-- IMPORTANT: Inventory rows are intentionally NOT seeded.
-- Inventory is created when cargo is received via backend APIs.

-- Stations
INSERT INTO stations (station_code, name, timezone, notes)
VALUES
  ('MAITRI', 'Maitri Station', 'UTC', 'Demo: Indian Antarctic station')
ON CONFLICT (station_code) DO NOTHING;

-- Seasons
INSERT INTO seasons (season_code, label, start_date, end_date)
VALUES
  ('2027-28', '2027–28', '2027-11-01', '2028-03-31')
ON CONFLICT (season_code) DO NOTHING;

-- Expedition
INSERT INTO expeditions (expedition_code, season_id, notes)
SELECT
  'EXP-2027-28', s.id, 'Demo expedition'
FROM seasons s
WHERE s.season_code = '2027-28'
ON CONFLICT (expedition_code) DO NOTHING;

-- Items
INSERT INTO items (item_code, name, unit, item_type, hazard_class, requires_special_handling, notes)
VALUES
  ('FUEL', 'Aviation Fuel (Demo)', 'L', 'FUEL', NULL, false, 'Demo fuel item for depletion forecasting'),
  ('FOOD', 'Food Rations (Demo)', 'kg', 'CONSUMABLE', NULL, false, 'Demo food item'),
  ('SPARES', 'Spare Parts (Demo)', 'unit', 'SPARE_PART', NULL, true, 'Demo spare parts')
ON CONFLICT (item_code) DO NOTHING;

-- Requirements for Maitri (used by forecasting to derive next resupply date)
-- Demo next resupply is 150 days from today so the critical alert is deterministic.
WITH maitri AS (
  SELECT id FROM stations WHERE station_code = 'MAITRI'
), season AS (
  SELECT id FROM seasons WHERE season_code = '2027-28'
)
INSERT INTO requirements (station_id, season_id, planned_resupply_date, created_at)
SELECT
  maitri.id,
  season.id,
  (CURRENT_DATE + INTERVAL '150 days')::date,
  now()
FROM maitri
CROSS JOIN season
ON CONFLICT (station_id, season_id) DO UPDATE
  SET planned_resupply_date = EXCLUDED.planned_resupply_date;

-- Requirement lines (reference; the demo flow will typically overwrite via APIs)
WITH req AS (
  SELECT r.id
  FROM requirements r
  JOIN stations st ON st.id = r.station_id
  JOIN seasons s ON s.id = r.season_id
  WHERE st.station_code = 'MAITRI' AND s.season_code = '2027-28'
)
INSERT INTO requirement_lines (
  requirement_id, item_id, required_qty, existing_stock_qty, expected_consumption_qty,
  safety_stock_qty, planned_resupply_qty, unit
)
SELECT
  req.id,
  i.id,
  CASE WHEN i.item_code = 'FUEL' THEN 50000
       WHEN i.item_code = 'FOOD' THEN 8000
       WHEN i.item_code = 'SPARES' THEN 500
       ELSE 0 END AS required_qty,
  0 AS existing_stock_qty,
  CASE WHEN i.item_code = 'FUEL' THEN 550
       WHEN i.item_code = 'FOOD' THEN 40
       WHEN i.item_code = 'SPARES' THEN 1
       ELSE 0 END AS expected_consumption_qty,
  0 AS safety_stock_qty,
  CASE WHEN i.item_code = 'FUEL' THEN 50000
       WHEN i.item_code = 'FOOD' THEN 8000
       WHEN i.item_code = 'SPARES' THEN 500
       ELSE 0 END AS planned_resupply_qty,
  i.unit
FROM req
CROSS JOIN items i
WHERE i.item_code IN ('FUEL','FOOD','SPARES')
ON CONFLICT (requirement_id, item_id) DO UPDATE
  SET required_qty = EXCLUDED.required_qty,
      existing_stock_qty = EXCLUDED.existing_stock_qty,
      expected_consumption_qty = EXCLUDED.expected_consumption_qty,
      safety_stock_qty = EXCLUDED.safety_stock_qty,
      planned_resupply_qty = EXCLUDED.planned_resupply_qty;

-- Consumption history (last 30 days) for forecasting.
-- This is crucial for the depletion forecast to be meaningful.
-- We seed consumption records but keep inventory empty until cargo receipt.
WITH maitri AS (
  SELECT id FROM stations WHERE station_code = 'MAITRI'
), days AS (
  SELECT (CURRENT_DATE - offs)::date AS d
  FROM generate_series(29, 0, -1) offs
), target_items AS (
  SELECT id, item_code, unit, item_type FROM items WHERE item_code IN ('FUEL','FOOD','SPARES')
)
INSERT INTO consumption_records (station_id, item_id, consumption_date, quantity_consumed, unit, source, notes)
SELECT
  maitri.id,
  ti.id,
  days.d AS consumption_date,
  CASE ti.item_code
    WHEN 'FUEL' THEN 550
    WHEN 'FOOD' THEN 40
    WHEN 'SPARES' THEN 1
    ELSE 0
  END AS quantity_consumed,
  ti.unit,
  'DEMO_SEED',
  'Seeded 30-day consumption history'
FROM maitri
CROSS JOIN days
CROSS JOIN target_items ti
ON CONFLICT (station_id, item_id, consumption_date) DO UPDATE
  SET quantity_consumed = EXCLUDED.quantity_consumed,
      unit = EXCLUDED.unit,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes;
