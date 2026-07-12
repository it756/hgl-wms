-- Migration: 035_product_price_history.sql
-- Purpose: Introduce product_price_history table so every Finance-approved Supplier GRN
--          creates an immutable, time-stamped price record per line item.
--          Also updates increment_stock_after_grn to:
--            1. Insert a price history row for each costed line.
--            2. Update products.unit_cost to the latest approved receipt cost (COALESCE —
--               existing cost is kept when the GRN line has no unit_cost).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: product_price_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                uuid NOT NULL REFERENCES public.products(id),
  supplier_grn_id           uuid REFERENCES public.supplier_grns(id),
  supplier_grn_line_item_id uuid REFERENCES public.supplier_grn_line_items(id),
  source_type               text NOT NULL DEFAULT 'supplier_grn',
  unit_cost                 numeric(12,2) NOT NULL,
  currency                  text NOT NULL DEFAULT 'ZMW',
  quantity_received         integer,
  effective_at              timestamptz NOT NULL DEFAULT now(),
  recorded_by               uuid REFERENCES auth.users(id),
  created_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_price_history IS
  'Immutable time-stamped log of approved supplier receipt prices per product. '
  'One row per supplier_grn_line_item that carries a unit_cost at Finance approval.';

COMMENT ON COLUMN public.product_price_history.source_type IS
  'Origin of the price event. ''supplier_grn'' is the only value used today; '
  'extensible to ''contract'' or ''manual_update''.';

CREATE INDEX IF NOT EXISTS idx_pph_product_id
  ON public.product_price_history(product_id);

CREATE INDEX IF NOT EXISTS idx_pph_product_effective_at
  ON public.product_price_history(product_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS idx_pph_supplier_grn_id
  ON public.product_price_history(supplier_grn_id);

-- Prevents duplicate rows if the approval RPC is retried.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pph_unique_grn_line
  ON public.product_price_history(supplier_grn_line_item_id)
  WHERE supplier_grn_line_item_id IS NOT NULL;

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Finance, Warehouse and Admin can read; only service_role (via the RPC) may write.
CREATE POLICY "price_history_read" ON public.product_price_history
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: increment_stock_after_grn (replaced)
-- Changes vs migration 033:
--   • Updates products.unit_cost to the GRN line cost (COALESCE: kept when NULL).
--   • Inserts a product_price_history row for every line that carries a unit_cost.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_stock_after_grn(
  p_grn_id       uuid,
  p_approved_by  uuid,
  p_approval_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_grn  RECORD;
  v_line RECORD;
BEGIN
  SELECT * INTO v_grn FROM public.supplier_grns WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'increment_stock_after_grn: supplier grn not found';
  END IF;

  IF v_grn.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'increment_stock_after_grn: grn not awaiting approval (%)', v_grn.status;
  END IF;

  -- Mark the supplier GRN as approved.
  UPDATE public.supplier_grns
  SET status         = 'GRN_APPROVED',
      approved_by    = p_approved_by,
      approved_at    = now(),
      approval_notes = p_approval_notes,
      updated_at     = now()
  WHERE id = p_grn_id;

  -- Process each line item.
  FOR v_line IN
    SELECT * FROM public.supplier_grn_line_items WHERE supplier_grn_id = p_grn_id
  LOOP
    -- 1. Increment stock and update catalogue cost (last-approved-cost policy).
    UPDATE public.products
    SET stock_quantity = stock_quantity + v_line.quantity_received,
        unit_cost      = COALESCE(v_line.unit_cost, unit_cost),
        expiry_date    = CASE
                           WHEN v_line.expiry_date IS NULL THEN expiry_date
                           WHEN expiry_date IS NULL        THEN v_line.expiry_date
                           ELSE LEAST(expiry_date, v_line.expiry_date)
                         END,
        updated_at     = now()
    WHERE id = v_line.product_id;

    -- 2. Write price history only when a cost was recorded on the GRN line.
    IF v_line.unit_cost IS NOT NULL THEN
      INSERT INTO public.product_price_history (
        product_id,
        supplier_grn_id,
        supplier_grn_line_item_id,
        source_type,
        unit_cost,
        currency,
        quantity_received,
        effective_at,
        recorded_by,
        created_at
      )
      VALUES (
        v_line.product_id,
        p_grn_id,
        v_line.id,
        'supplier_grn',
        v_line.unit_cost,
        'ZMW',
        v_line.quantity_received,
        now(),
        p_approved_by,
        now()
      )
      ON CONFLICT (supplier_grn_line_item_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Audit entry (tolerates envs where audit_logs does not yet exist).
  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'supplier_grn',
      p_grn_id,
      'grn_approve_increment',
      p_approved_by,
      json_build_object('notes', p_approval_notes),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_grn_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.increment_stock_after_grn(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_stock_after_grn(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
