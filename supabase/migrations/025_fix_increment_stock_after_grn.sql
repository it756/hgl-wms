-- Migration: 024_fix_increment_stock_after_grn.sql
-- Fixes two defects in increment_stock_after_grn (from 003):
--   1. It read the wrong tables: `grns`/`grn_line_items` instead of
--      `supplier_grns`/`supplier_grn_line_items`, so every finance approval
--      of a supplier GRN failed with "grn not found".
--   2. It had no idempotency guard: any call while status = GRN_APPROVED
--      incremented stock again.
-- The function is now atomic AND idempotent: it locks the GRN row, performs
-- the status transition itself (AWAITING_FINANCE_APPROVAL -> GRN_APPROVED),
-- and increments stock exactly once. Concurrent or repeated calls fail with
-- a descriptive error and change nothing.

CREATE OR REPLACE FUNCTION public.increment_stock_after_grn(
  p_grn_id uuid,
  p_approved_by uuid,
  p_approval_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_grn RECORD;
  v_line RECORD;
BEGIN
  SELECT * INTO v_grn FROM supplier_grns WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'increment_stock_after_grn: supplier grn not found';
  END IF;

  IF v_grn.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'increment_stock_after_grn: grn not awaiting approval (%)', v_grn.status;
  END IF;

  UPDATE supplier_grns
  SET status = 'GRN_APPROVED',
      approved_by = p_approved_by,
      approved_at = now(),
      approval_notes = p_approval_notes,
      updated_at = now()
  WHERE id = p_grn_id;

  FOR v_line IN SELECT * FROM supplier_grn_line_items WHERE supplier_grn_id = p_grn_id LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + v_line.quantity_received,
        updated_at = now()
    WHERE id = v_line.product_id;
  END LOOP;

  -- Insert audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES ('supplier_grn', p_grn_id, 'grn_approve_increment', p_approved_by, json_build_object('notes', p_approval_notes), now());
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_grn_id;
END;
$$ LANGUAGE plpgsql;
