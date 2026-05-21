-- Migration: 003_increment_stock_after_grn.sql
-- Purpose: RPC to increment stock after Supplier GRN is approved by Finance

CREATE OR REPLACE FUNCTION public.increment_stock_after_grn(
  p_grn_id uuid,
  p_approved_by uuid,
  p_approval_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_grn RECORD;
  v_line RECORD;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_grn FROM grns WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'increment_stock_after_grn: grn not found';
  END IF;

  -- Ensure GRN has been approved by Finance (status field expected)
  IF v_grn.status IS DISTINCT FROM 'GRN_APPROVED' THEN
    RAISE EXCEPTION 'increment_stock_after_grn: grn not approved';
  END IF;

  -- Process line items and increment product stock (assumes grn_line_items table exists)
  FOR v_line IN SELECT * FROM grn_line_items WHERE grn_id = p_grn_id LOOP
    UPDATE products SET stock_quantity = stock_quantity + v_line.quantity_received, updated_at = now() WHERE id = v_line.product_id;
  END LOOP;

  -- Insert audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES ('grn', p_grn_id, 'grn_approve_increment', p_approved_by, json_build_object('notes', p_approval_notes), now());
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_grn_id;
END;
$$ LANGUAGE plpgsql;
