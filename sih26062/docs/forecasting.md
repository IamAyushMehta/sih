# Forecasting Engine — SIH26062

## Objectives
Given a station’s current inventory and consumption history, the system must compute:
- average daily consumption (prefer 30-day average when enough history exists)
- estimated depletion date
- days remaining
- days before next resupply
- risk classification: SAFE / WATCH / AT_RISK / CRITICAL
- recommended action (order quantity where applicable)

## Core calculations
Let:
- `currentStock` = current inventory quantity
- `avgDailyConsumption` = average daily consumption derived from consumption records
- `nextResupplyDate` = next expected arrival / receiving date

### Days until depletion
- If `avgDailyConsumption <= 0` (including zero):
  - depletion is not projected; risk should be SAFE unless next-resupply is missing (then show WATCH with a data note).
- Otherwise:
  - `daysRemaining = currentStock / avgDailyConsumption`

### Estimated depletion date
- `estimatedDepletionDate = today + daysRemaining`

### Days before resupply
- `daysBeforeResupply = nextResupplyDate - estimatedDepletionDate`
  - positive means depletion happens after (i.e., no imminent shortage)
  - negative means depletion happens before resupply

## Risk classification
The SIH requirement example implies:
- `CRITICAL` when depletion occurs **before** next resupply (shortfall window).
- `AT_RISK` when depletion is close to resupply.
- `WATCH` when depletion is later but not far.
- `SAFE` when depletion is comfortably after.

Exact thresholds will be implemented in backend config (not hardcoded in UI only).

## Recommended order quantity
Where meaningful, compute:
- `requiredUntilNextResupply = (avgDailyConsumption * daysUntilResupply) + safetyStock`
- `recommendedOrder = max(0, requiredUntilNextResupply - currentStock - inTransitStock)`

> InTransit stock is the sum of cargo already on voyages in transit for this station/item.

## Edge cases (must be handled)
- zero consumption
- no consumption history
- negative inventory (clamp to 0 for risk, but show data integrity warning)
- no next resupply date
- stock already depleted (daysRemaining <= 0)
- incoming cargo (inTransit stock)
- insufficient historical data
  - if insufficient, show: `Insufficient consumption history for reliable forecast.`

## Data sources
- `inventory` for current stock
- `consumption_records` for historical consumption
- `voyages` / `cargo_items` (via receipts/status) for in-transit estimation
- `requirements` (planned resupply) for next expected resupply
