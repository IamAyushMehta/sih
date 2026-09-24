# Database — SIH26062

This document summarizes the PostgreSQL schema in `database/schema.sql`.

## Design Goals
- Normalize entities for correctness and traceability.
- Preserve end-to-end logistics lineage:
  - Indent → Cargo → Voyage Manifest → Stowage Plan → Voyage → Station Receipt → Inventory
- Store status history for operational timelines.
- Enable forecasting using consumption history.

## Key Tables
See `database/schema.sql` for full DDL.

- `stations` (station master data)
- `seasons` (season definitions)
- `items` (fuel/food/spares and other assets)
- Planning:
  - `requirements`, `requirement_lines`
  - `indents`, `indent_items`
- Logistics:
  - `cargo`, `cargo_items`
  - `voyages`, `manifests`, `manifest_items`
  - `stowage_plans`, `stowage_positions`
- Inventory & consumption:
  - `inventory`
  - `inventory_transactions`
  - `consumption_records`
- Personnel and medical:
  - `personnel`, `personnel_assignments`
  - `medical_clearances`
  - `personnel_movements`
- Emergency:
  - `emergency_plans`, `emergencies`
  - `roll_calls`, `emergency_resources`, `emergency_resource_usage`
- Audit:
  - `audit_events`
  - `indent_status_history`, `cargo_status_history`, `voyage_status_history`

## Operational Query Patterns
- Station inventory snapshot:
  - `inventory` filtered by `station_id`
- Consumption window + averaging:
  - `consumption_records` filtered by `station_id,item_id,consumption_date`
- Traceability timeline:
  - join `*_status_history` and `audit_events` to entity
- Stowage visualization:
  - `stowage_positions` ordered by `loading_sequence` / `unloading_sequence`
