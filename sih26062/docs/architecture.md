# Architecture — SIH26062

## Overview
**SIH26062 — Integrated Polar Expedition Logistics and Asset Management System** is designed around Antarctic station operations:
- Build seasonal requirements at a station
- Convert requirements → indents → cargo consignments
- Sequence cargo onto voyages with **stowage planning** (last-loaded-first-unloaded)
- Receive cargo at the station, update **station inventory**
- Record consumption and run **depletion forecasting**
- Detect **resupply risk** and raise operational alerts
- Track personnel rotation with **medical clearance**
- Support emergency response (roll call + resource tracking)

## Proposed Tech Stack
- **Frontend:** React + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt

## Key Design Principles
1. **Workflow correctness is backend-validated.**
   - Cargo and voyage state machines are enforced server-side.
   - Invalid transitions are rejected with clear errors.

2. **Traceability is first-class.**
   - Indents → cargo → manifest items → stowage plan → voyage → station receipt are linked.
   - Every important event writes to an audit trail.

3. **Stowage sequencing is explainable.**
   - The stowage plan is persisted.
   - The algorithm uses unloading order / destination / priority / constraints.
   - UI shows both loading and unloading sequences.

4. **Forecasting is data-driven.**
   - Forecasting uses stored consumption history and incoming resupply dates.
   - Risk level classification is computed (no hardcoding).

## Modules (by domain)
- **Auth & RBAC**: roles, JWT, password hashing
- **Expedition Planning**: stations → seasons → requirements → indents
- **Cargo Lifecycle**: indent → cargo → voyage manifest → loading → in-transit → receipt
- **Stowage Planning**: generate recommended loading/unloading sequences
- **Inventory & Consumption**: inventory transactions + consumption records
- **Forecasting & Risk**: depletion, days-before-resupply, and recommended actions
- **Personnel & Medical**: assignments, rotation timeline, clearance warnings
- **Emergency Response**: active emergencies, roll call, resources
- **Operational Dashboard**: computed alerts and decision support

## Data Flow (High level)
1. Planner creates seasonal requirements for a station
2. Requirements → indents (planner creates; logistics/manager approves)
3. Indents → cargo consignments
4. Cargo → manifests for specific voyages
5. Manifest items → stowage plan (loading/unloading sequences)
6. Cargo loaded → voyage departed/in-transit → arrived
7. Station receipt updates inventory via inventory transactions
8. Consumption records update averages and forecasting
9. Dashboard surfaces risk alerts from computed data
