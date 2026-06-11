-- Migration: 010_damage_recalls.sql
-- Purpose: Physical transit tracking for damaged goods recalled from units back to the warehouse.
--   A damage_recall represents the logistics journey of goods that were written off in the
--   damage_ledger — they still need to physically return to the warehouse for disposal/assessment.
--   Stock is NOT restored (these goods are damaged); this table purely tracks physical movement.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: damage_recalls
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.damage_recalls (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_ledger_id  uuid        NOT NULL UNIQUE REFERENCES public.damage_ledger(id) ON DELETE CASCADE,
  initiated_by      uuid        NOT NULL REFERENCES auth.users(id),
  status            text        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING', 'IN_TRANSIT', 'RECEIVED')),
  notes             text,
  -- Populated when Warehouse Manager confirms physical receipt
  received_by       uuid        REFERENCES auth.users(id),
  received_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.damage_recalls IS
  'Tracks physical return transit of damage-written-off goods from the unit back to '
  'the warehouse for disposal or assessment. Stock is NOT restored — these goods are damaged. '
  'Lifecycle: PENDING → IN_TRANSIT → RECEIVED.';

CREATE INDEX IF NOT EXISTS idx_damage_recalls_ledger_id
  ON public.damage_recalls (damage_ledger_id);
CREATE INDEX IF NOT EXISTS idx_damage_recalls_status
  ON public.damage_recalls (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.damage_recalls ENABLE ROW LEVEL SECURITY;

-- Readable by ADMIN, WAREHOUSE_MANAGER, FINANCE_MANAGER
CREATE POLICY "damage_recalls_select"
  ON public.damage_recalls FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN (
      'ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'
    )
  );

-- Insert/Update by ADMIN and WAREHOUSE_MANAGER only
CREATE POLICY "damage_recalls_insert"
  ON public.damage_recalls FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER')
  );

CREATE POLICY "damage_recalls_update"
  ON public.damage_recalls FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER')
  );

COMMIT;
