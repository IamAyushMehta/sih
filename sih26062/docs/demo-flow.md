# Demo Flow — SIH26062 (Critical Workflow)

This document maps the end-to-end demo scenario to backend operations and persisted entities.

## The critical scenario (must work end-to-end)
1. Create/select station: **Maitri**
2. Create seasonal requirement: **2027–28**
   - Fuel: 50,000 L
   - Food: 8,000 kg
   - Spare parts: 500 units
3. Create indent:
   - IND-001 for Maitri Fuel (required 50,000 L)
4. Approve indent
5. Convert indent → cargo/consignment:
   - CARGO-001
6. Add cargo to voyage manifest:
   - VOY-001 (MV-Antarctica-07)
7. Generate stowage plan
   - Algorithm recommends loading sequence and explains unloading order
8. Mark cargo as loaded
9. Start voyage
10. Mark cargo as received at station
11. Automatically update station inventory (Fuel becomes 50,000 L)
12. Record consumption (~550 L/day average)
13. Forecast depletion (~91 days)
14. Compare with next resupply date (150 days)
   - Identify critical shortage window (~59 days before resupply)
15. Dashboard shows:
   - **CRITICAL RESUPPLY RISK** alert
16. Adjust next resupply requirement (optional in demo)

## Backend responsibilities (non-negotiable)
- State machine validation for indent/cargo/voyage transitions.
- Inventory updates and inventory transactions on station receipt.
- Consumption recording drives computed averages.
- Forecasting uses DB data (not frontend-only).
- Resupply risk classification derived from computed forecast.

## UI responsibilities
- Display cargo traceability timeline.
- Show stowage loading and unloading sequences visually.
- Show depletion vs next resupply chart.
- Show operational alerts from computed DB results.
