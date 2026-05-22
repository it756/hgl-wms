-- Migration: Add sbu_units table, unit_id on profiles, requesting_unit_id on transfer_requests
-- Safe to run on existing databases — uses IF NOT EXISTS / IF EXISTS guards

-- ─────────────────────────────────────────────
-- 1. Create sbu_units table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sbu_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL,
  sbu_id      uuid NOT NULL REFERENCES public.sbus(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sbu_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sbu_units_sbu_id ON public.sbu_units(sbu_id);
COMMENT ON TABLE public.sbu_units IS 'Sub-units / departments within an SBU. Staff are assigned to a unit; transfer requests originate from a unit.';

-- ─────────────────────────────────────────────
-- 2. Add unit_id to profiles (nullable)
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.sbu_units(id);
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);

-- ─────────────────────────────────────────────
-- 3. Add requesting_unit_id to transfer_requests
--    Existing rows: clear them (dev data) then add NOT NULL constraint
-- ─────────────────────────────────────────────

-- Remove existing seed data so we can enforce NOT NULL cleanly
TRUNCATE public.transfer_line_items CASCADE;
TRUNCATE public.transfer_requests CASCADE;
TRUNCATE public.return_requests CASCADE;
TRUNCATE public.grn_line_items CASCADE;
TRUNCATE public.grns CASCADE;
TRUNCATE public.issuance_line_items CASCADE;
TRUNCATE public.issuances CASCADE;

ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS requesting_unit_id uuid REFERENCES public.sbu_units(id);

-- Now make it NOT NULL (table is empty so this is safe)
ALTER TABLE public.transfer_requests
  ALTER COLUMN requesting_unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_requests_unit_id
  ON public.transfer_requests(requesting_unit_id);
