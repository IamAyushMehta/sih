# Phase 3 Status (work-in-progress)

## Implemented
- Added `/demo/run-critical-workflow` backend endpoint that executes the end-to-end demo scenario via DB transactions.

## To do in Phase 3
- Ensure state transitions are consistent and enforce allowed transitions for each lifecycle step.
- Implement traceability timeline endpoints (cargo detail timeline).
- Implement remaining frontend pages and wire them to API.
- Validate stowage/unloading sequencing is used consistently in the demo.
- Extend inventory forecasting to match the dashboard spec table + chart.
- Ensure operational alerts are computed from the database (no hardcoding).
