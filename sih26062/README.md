# SIH26062 — Integrated Polar Expedition Logistics and Asset Management System

**Organization:** Ministry of Earth Sciences (MoES)

**Smart India Hackathon:** SIH26062

## Problem
Antarctic station operations depend on careful planning and logistics:
- converting seasonal needs into indents and cargo
- sequencing cargo onto voyages with correct unloading access
- receiving and tracking inventory consumption
- forecasting depletion and resupply risk
- managing personnel rotations and medical clearance
- supporting emergency response with operational visibility

## Solution
SIH26062 is an integrated platform that connects the full operational workflow:
- Expedition planning (station → season → requirements → indents)
- Cargo lifecycle (indent → approval → cargo → manifest → voyage → receipt)
- **Stowage sequencing optimization** (last-loaded-first-unloaded)
- **Inventory depletion forecasting** and **resupply risk detection**
- Personnel rotation + medical clearance
- Emergency command and roll-call visibility

## Core Innovation
1. Cargo traceability across the full lifecycle
2. Stowage planning that explains loading/unloading order
3. Depletion forecasting using real consumption history
4. Resupply risk classification derived from forecast outputs
5. Personnel tracking and medical clearance warnings
6. Emergency readiness view

## Architecture
Frontend
↓
Backend
↓
PostgreSQL

## Repo Layout
- `frontend/` — React + Vite + Tailwind
- `backend/` — Node.js + Express + TypeScript
- `database/` — PostgreSQL `schema.sql`, `seed.sql`
- `docs/` — architecture docs + demo flow mapping

## Setup (Phase 1 — DB schema)
1. Create a PostgreSQL database.
2. Run:
   - `database/schema.sql`
   - `database/seed.sql` (demo reference data)

> Note: The repo will be extended in later phases to provide end-to-end APIs and the critical demo workflow.
