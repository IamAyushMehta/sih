# Phase 4 Status — Frontend wiring (work-in-progress)

## Added
- Cargo traceability page:
  - `frontend/src/pages/CargoTraceabilityPage.tsx`
  - Shows a minimal cargo detail + timeline placeholder.
- Trace API module:
  - `frontend/src/api/trace.ts`
- Timeline component:
  - `frontend/src/components/Timeline.tsx`
- Navbar/layout:
  - `frontend/src/components/TopNav.tsx`
  - `frontend/src/App.tsx` wraps main screens with layout and adds `/cargo/:cargoId` route.

## Backend support
- Read-only cargo endpoint for UI:
  - `backend/src/routes/read.ts`
  - Mounted in `backend/src/index.ts`
  - `GET /shipping/cargo/:cargoId`

## Next
- Replace the placeholder timeline with real traceability using:
  - `cargo_status_history` + `audit_events`
  - indent_status_history + voyage_status_history
- Add stowage UI pages and connect to stowage plan persistence.
- Add forecast UI page connected to `/inventory/forecast/...`.
