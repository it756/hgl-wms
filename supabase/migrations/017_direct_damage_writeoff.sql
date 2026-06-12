-- Migration: 017_direct_damage_writeoff.sql
-- Purpose: Allow direct damage write-offs from the product catalogue (no variance
--   proposal required). This supports the workflow where a Warehouse Manager,
--   Admin, or Finance Manager identifies damaged stock during a routine inspection
--   and removes it from inventory immediately.
--
--   Existing damage_ledger rows (created via variance proposals) keep
--   proposal_line_id populated and have source_type = 'variance_proposal'.
--   Direct write-offs leave proposal_line_id NULL with source_type = 'direct_writeoff'.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Make proposal_line_id nullable (direct write-offs have no proposal)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.damage_ledger
  ALTER COLUMN proposal_line_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add source_type discriminator
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.damage_ledger
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'variance_proposal'
    CHECK (source_type IN ('variance_proposal', 'direct_writeoff'));

COMMENT ON COLUMN public.damage_ledger.source_type IS
  'Origin of the damage write-off: variance_proposal (via Finance-approved variance) '
  'or direct_writeoff (recorded directly from the product catalogue).';

CREATE INDEX IF NOT EXISTS idx_damage_ledger_source_type
  ON public.damage_ledger(source_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enable RLS for INSERT — admin / warehouse / finance can write-off directly
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.damage_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "damage_ledger_select" ON public.damage_ledger;
CREATE POLICY "damage_ledger_select"
  ON public.damage_ledger FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN (
      'ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'
    )
  );

DROP POLICY IF EXISTS "damage_ledger_insert" ON public.damage_ledger;
CREATE POLICY "damage_ledger_insert"
  ON public.damage_ledger FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN (
      'ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: process_direct_damage_writeoff
--    Atomically decrement stock and insert a direct-writeoff damage_ledger row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_direct_damage_writeoff(
  p_product_id    uuid,
  p_quantity      integer,
  p_reason        text,
  p_written_off_by uuid,
  p_notes         text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id            uuid;
  v_unit_cost     numeric(12,2);
  v_stock_before  integer;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'process_direct_damage_writeoff: quantity must be positive (got %)', p_quantity;
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'process_direct_damage_writeoff: reason is required';
  END IF;

  -- Lock product row and validate stock availability
  SELECT stock_quantity, COALESCE(unit_cost, 0) INTO v_stock_before, v_unit_cost
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_direct_damage_writeoff: product not found (id: %)', p_product_id;
  END IF;

  IF v_stock_before < p_quantity THEN
    RAISE EXCEPTION 'process_direct_damage_writeoff: insufficient stock (available: %, requested: %)',
      v_stock_before, p_quantity;
  END IF;

  -- Decrement stock
  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at     = now()
  WHERE id = p_product_id;

  -- Insert ledger entry (proposal_line_id NULL; source_type = direct_writeoff)
  INSERT INTO public.damage_ledger (
    proposal_line_id,
    product_id,
    quantity,
    unit_cost_at_writeoff,
    estimated_value,
    currency,
    writeoff_reason,
    transfer_reference,
    written_off_by,
    written_off_at,
    source_type
  ) VALUES (
    NULL,
    p_product_id,
    p_quantity,
    v_unit_cost,
    p_quantity * v_unit_cost,
    'ZMW',
    COALESCE(p_reason, '') || CASE WHEN p_notes IS NOT NULL THEN ' — ' || p_notes ELSE '' END,
    NULL,
    p_written_off_by,
    now(),
    'direct_writeoff'
  )
  RETURNING id INTO v_id;

  -- Best-effort audit log
  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'damage_ledger',
      v_id,
      'direct_writeoff',
      p_written_off_by,
      json_build_object(
        'product_id',          p_product_id,
        'quantity',            p_quantity,
        'unit_cost_at_writeoff', v_unit_cost,
        'reason',              p_reason
      ),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
