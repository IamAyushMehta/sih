-- SIH26062 Shared Queries (initial)

-- 1) Station inventory snapshot
-- SELECT * FROM inventory WHERE station_id = $1;

-- 2) Consumption history (for averaging)
-- SELECT consumption_date, quantity_consumed
-- FROM consumption_records
-- WHERE station_id = $1 AND item_id = $2
-- ORDER BY consumption_date DESC
-- LIMIT $3;

-- 3) Compute avg over last 30 days (if enough rows exist)
-- Backend will decide when to fall back to shorter windows.

-- 4) Next resupply date for an item at a station
-- - In Phase 2, this comes from latest planned_resupply_qty / requirement_lines
-- For now, it will be derived from requirements planned_resupply_date.

-- 5) In-transit stock estimation
-- Backend will compute from cargo received/arrived states.
