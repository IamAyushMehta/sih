-- SIH26062 Database Schema
-- Integrated Polar Expedition Logistics and Asset Management System
-- PostgreSQL 16+

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'indent_status') THEN
    CREATE TYPE indent_status AS ENUM ('DRAFT', 'INDENTED', 'APPROVED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_status') THEN
    CREATE TYPE cargo_status AS ENUM (
      'DRAFT',
      'INDENTED',
      'APPROVED',
      'PREPARING',
      'MANIFESTED',
      'LOADED',
      'IN_TRANSIT',
      'ARRIVED',
      'RECEIVED',
      'CLOSED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voyage_status') THEN
    CREATE TYPE voyage_status AS ENUM (
      'PLANNED',
      'LOADING',
      'DEPARTED',
      'IN_TRANSIT',
      'ARRIVED',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'personnel_status') THEN
    CREATE TYPE personnel_status AS ENUM (
      'PLANNED',
      'CLEARED',
      'DEPLOYED',
      'AT_STATION',
      'ROTATING',
      'RETURNED',
      'MEDICAL_HOLD'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medical_clearance_status') THEN
    CREATE TYPE medical_clearance_status AS ENUM ('VALID', 'EXPIRING', 'EXPIRED', 'PENDING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_risk_level') THEN
    CREATE TYPE inventory_risk_level AS ENUM ('SAFE', 'WATCH', 'AT_RISK', 'CRITICAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL', 'EMERGENCY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_tx_type') THEN
    CREATE TYPE inventory_tx_type AS ENUM ('RECEIVE', 'CONSUME', 'ADJUST');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_severity') THEN
    CREATE TYPE emergency_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_status') THEN
    CREATE TYPE emergency_status AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');
  END IF;
END
$$;

-- Helpers
CREATE OR REPLACE FUNCTION sih_uuid_generate() RETURNS uuid AS $$
  SELECT gen_random_uuid();
$$ LANGUAGE SQL;

-- Core tables

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'PLANNER',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_code text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  notes text
);

CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  season_code text NOT NULL UNIQUE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS expeditions (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  expedition_code text NOT NULL UNIQUE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  notes text
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  item_code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL,
  item_type text NOT NULL DEFAULT 'GENERAL',
  hazard_class text,
  requires_special_handling boolean NOT NULL DEFAULT false,
  notes text
);

-- Expedition planning
CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  planned_resupply_date date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, season_id)
);

CREATE TABLE IF NOT EXISTS requirement_lines (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  required_qty numeric(20,4) NOT NULL,
  existing_stock_qty numeric(20,4) NOT NULL DEFAULT 0,
  expected_consumption_qty numeric(20,4) NOT NULL DEFAULT 0,
  safety_stock_qty numeric(20,4) NOT NULL DEFAULT 0,
  planned_resupply_qty numeric(20,4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  CHECK (required_qty >= 0),
  CHECK (existing_stock_qty >= 0),
  CHECK (expected_consumption_qty >= 0),
  CHECK (safety_stock_qty >= 0),
  CHECK (planned_resupply_qty >= 0),
  UNIQUE (requirement_id, item_id)
);

CREATE TABLE IF NOT EXISTS indents (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  indent_code text NOT NULL UNIQUE,
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  status indent_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  CHECK (
    (status = 'APPROVED' AND approved_at IS NOT NULL) OR
    (status <> 'APPROVED')
  )
);

CREATE TABLE IF NOT EXISTS indent_items (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  indent_id uuid NOT NULL REFERENCES indents(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  required_qty numeric(20,4) NOT NULL,
  unit text NOT NULL,
  existing_stock_snapshot numeric(20,4) NOT NULL DEFAULT 0,
  safety_stock_qty numeric(20,4) NOT NULL DEFAULT 0,
  planned_resupply_qty numeric(20,4) NOT NULL DEFAULT 0,
  CHECK (required_qty >= 0),
  CHECK (existing_stock_snapshot >= 0),
  CHECK (safety_stock_qty >= 0),
  CHECK (planned_resupply_qty >= 0),
  UNIQUE (indent_id, item_id)
);

-- Indent -> Cargo
CREATE TABLE IF NOT EXISTS cargo (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  cargo_code text NOT NULL UNIQUE,
  indent_id uuid NOT NULL REFERENCES indents(id) ON DELETE RESTRICT,
  status cargo_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargo_items (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  cargo_id uuid NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty numeric(20,4) NOT NULL,
  unit text NOT NULL,
  destination_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  cargo_type text NOT NULL DEFAULT 'STANDARD',
  hazard_class text,
  unloading_priority integer NOT NULL DEFAULT 100,
  weight_kg numeric(20,4),
  volume_m3 numeric(20,4),
  special_handling_flags text[],
  CHECK (qty >= 0),
  CHECK (unloading_priority >= 0),
  UNIQUE (cargo_id, item_id, destination_station_id)
);

-- Voyage + Manifest
CREATE TABLE IF NOT EXISTS voyages (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  voyage_code text NOT NULL UNIQUE,
  vessel_name text NOT NULL,
  departure_port text NOT NULL,
  destination_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  departure_date date NOT NULL,
  expected_arrival date,
  actual_arrival date,
  status voyage_status NOT NULL DEFAULT 'PLANNED',
  capacity_notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status IN ('ARRIVED','COMPLETED') AND actual_arrival IS NOT NULL) OR
    (status NOT IN ('ARRIVED','COMPLETED'))
  )
);

CREATE TABLE IF NOT EXISTS manifests (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  voyage_id uuid NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voyage_id)
);

CREATE TABLE IF NOT EXISTS manifest_items (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  manifest_id uuid NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
  cargo_item_id uuid NOT NULL REFERENCES cargo_items(id) ON DELETE RESTRICT,

  -- Redundant for faster operational joins
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  destination_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,

  weight_kg numeric(20,4),
  volume_m3 numeric(20,4),
  priority integer NOT NULL DEFAULT 100,
  unloading_priority integer NOT NULL DEFAULT 100,

  loading_sequence_recommended integer,
  loading_sequence_final integer,
  unloading_sequence_final integer,

  stowage_zone text,
  stowage_deck text,
  stowage_position text,

  status text NOT NULL DEFAULT 'ACTIVE',

  CHECK (priority >= 0),
  CHECK (unloading_priority >= 0),
  UNIQUE (manifest_id, cargo_item_id)
);

-- Persisted stowage plans
CREATE TABLE IF NOT EXISTS stowage_plans (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  manifest_id uuid NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
  algorithm_version text NOT NULL DEFAULT 'v1',
  explanation_json jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manifest_id)
);

CREATE TABLE IF NOT EXISTS stowage_positions (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  stowage_plan_id uuid NOT NULL REFERENCES stowage_plans(id) ON DELETE CASCADE,
  manifest_item_id uuid NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,

  stowage_zone text,
  stowage_deck text,
  stowage_position text,

  loading_sequence integer NOT NULL,
  unloading_sequence integer NOT NULL,
  destination_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,

  constraints_notes text,

  CHECK (loading_sequence >= 1),
  CHECK (unloading_sequence >= 1),
  UNIQUE (stowage_plan_id, loading_sequence)
);

-- Inventory + Transactions + Consumption
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  quantity numeric(20,4) NOT NULL,
  unit text NOT NULL,

  average_daily_consumption numeric(20,4),
  minimum_stock numeric(20,4) NOT NULL DEFAULT 0,
  safety_stock numeric(20,4) NOT NULL DEFAULT 0,

  last_updated timestamptz NOT NULL DEFAULT now(),

  UNIQUE (station_id, item_id),
  CHECK (quantity >= 0),
  CHECK (minimum_stock >= 0),
  CHECK (safety_stock >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  transaction_type inventory_tx_type NOT NULL,
  qty_delta numeric(20,4) NOT NULL,
  unit text NOT NULL,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_type text,
  source_id uuid,

  notes text,

  CHECK (qty_delta <> 0)
);

CREATE TABLE IF NOT EXISTS consumption_records (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  consumption_date date NOT NULL,
  quantity_consumed numeric(20,4) NOT NULL,
  unit text NOT NULL,

  source text,
  notes text,

  UNIQUE (station_id, item_id, consumption_date),
  CHECK (quantity_consumed >= 0)
);

-- Personnel
CREATE TABLE IF NOT EXISTS personnel (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  person_name text NOT NULL,
  role text NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS personnel_assignments (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,

  rotation text,

  arrival_date date,
  departure_date date,

  status personnel_status NOT NULL DEFAULT 'PLANNED',

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (personnel_id, station_id, season_id)
);

CREATE TABLE IF NOT EXISTS medical_clearances (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  status medical_clearance_status NOT NULL DEFAULT 'PENDING',

  clearance_date date,
  expiry_date date,

  medical_category text,
  notes text,

  UNIQUE (personnel_id, expiry_date)
);

CREATE TABLE IF NOT EXISTS personnel_movements (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  from_location text,
  to_location text,
  event_date timestamptz NOT NULL DEFAULT now(),

  source_type text,
  source_id uuid,

  notes text
);

-- Emergency response
CREATE TABLE IF NOT EXISTS emergency_plans (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  emergency_type text NOT NULL,

  response_procedure text NOT NULL,
  responsible_personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,

  required_resources_json jsonb,
  escalation_contacts_json jsonb,

  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emergencies (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  emergency_type text NOT NULL,
  severity emergency_severity NOT NULL,
  status emergency_status NOT NULL DEFAULT 'ACTIVE',

  activated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,

  notes text,

  CHECK ((status IN ('RESOLVED','CANCELLED') AND resolved_at IS NOT NULL) OR (status='ACTIVE'))
);

CREATE TABLE IF NOT EXISTS roll_calls (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  emergency_id uuid NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,

  present_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  evacuated_count integer NOT NULL DEFAULT 0,
  injured_count integer NOT NULL DEFAULT 0,
  accounted_for_count integer NOT NULL DEFAULT 0,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (present_count >= 0),
  CHECK (missing_count >= 0),
  CHECK (evacuated_count >= 0),
  CHECK (injured_count >= 0),
  CHECK (accounted_for_count >= 0),

  UNIQUE (emergency_id)
);

CREATE TABLE IF NOT EXISTS emergency_resources (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  emergency_id uuid NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_name text NOT NULL,
  quantity_available numeric(20,4) NOT NULL,
  unit text NOT NULL,

  UNIQUE (emergency_id, resource_type, resource_name)
);

CREATE TABLE IF NOT EXISTS emergency_resource_usage (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  emergency_id uuid NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  emergency_resource_id uuid NOT NULL REFERENCES emergency_resources(id) ON DELETE CASCADE,

  qty_used numeric(20,4) NOT NULL,
  unit text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),

  old_value_json jsonb,
  new_value_json jsonb,
  location_json jsonb,

  notes text
);

-- Status history (used for traceability timelines)
CREATE TABLE IF NOT EXISTS indent_status_history (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  indent_id uuid NOT NULL REFERENCES indents(id) ON DELETE CASCADE,
  from_status indent_status NOT NULL,
  to_status indent_status NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS cargo_status_history (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  cargo_id uuid NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  from_status cargo_status NOT NULL,
  to_status cargo_status NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS voyage_status_history (
  id uuid PRIMARY KEY DEFAULT sih_uuid_generate(),
  voyage_id uuid NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  from_status voyage_status NOT NULL,
  to_status voyage_status NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Indexes (operational / dashboard queries)
CREATE INDEX IF NOT EXISTS idx_inventory_station ON inventory(station_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);

CREATE INDEX IF NOT EXISTS idx_consumption_station_item_date ON consumption_records(station_id, item_id, consumption_date DESC);

CREATE INDEX IF NOT EXISTS idx_cargo_destination ON cargo_items(destination_station_id);
CREATE INDEX IF NOT EXISTS idx_manifest_items_station ON manifest_items(station_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

-- Recommended: keep foreign keys consistent by ensuring manifest_items.station_id == cargo_items.destination_station_id at app level.
