-- Migration: 002_process_issuance.sql
-- Creates an atomic RPC to record an issuance, decrement stock and update transfer status

CREATE OR REPLACE FUNCTION public.process_issuance(
  p_transfer_request_id uuid,
  p_issued_by uuid,
  p_items json,
  p_issue_date timestamptz DEFAULT now(),
  p_logistics_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_issuance_id uuid;
  v_tr RECORD;
  v_item RECORD;
  v_stock integer;
BEGIN
  -- Lock and validate transfer request
  SELECT * INTO v_tr FROM transfer_requests WHERE id = p_transfer_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_issuance: transfer_request not found';
  END IF;

  -- Ensure transfer is in a state that allows issuance
  IF v_tr.status NOT IN ('PENDING','APPROVED_FOR_ISSUE') THEN
    RAISE EXCEPTION 'process_issuance: transfer_request not in issuable state (%).', v_tr.status;
  END IF;

  -- If finance approval required, ensure transfer is APPROVED_FOR_ISSUE
  IF COALESCE(v_tr.requires_finance_approval, false) = true AND v_tr.status <> 'APPROVED_FOR_ISSUE' THEN
    RAISE EXCEPTION 'process_issuance: requires finance approval';
  END IF;

  -- Create issuance
  INSERT INTO issuances(transfer_request_id, issued_by, issue_date, logistics_notes, created_at, updated_at)
  VALUES (p_transfer_request_id, p_issued_by, p_issue_date, p_logistics_notes, now(), now())
  RETURNING id INTO v_issuance_id;

  -- Process each line item from JSON array {product_id, quantity_issued}
  FOR v_item IN SELECT * FROM json_to_recordset(p_items) AS (product_id uuid, quantity_issued integer)
  LOOP
    -- Lock product row
    SELECT stock_quantity INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'process_issuance: product not found %', v_item.product_id;
    END IF;
    IF v_stock < v_item.quantity_issued THEN
      RAISE EXCEPTION 'process_issuance: insufficient_stock for product %', v_item.product_id;
    END IF;

    -- Decrement stock
    UPDATE products
    SET stock_quantity = stock_quantity - v_item.quantity_issued,
        updated_at = now()
    WHERE id = v_item.product_id;

    -- Insert line item
    INSERT INTO issuance_line_items(issuance_id, product_id, quantity_issued, created_at, updated_at)
    VALUES (v_issuance_id, v_item.product_id, v_item.quantity_issued, now(), now());
  END LOOP;

  -- Transition transfer to ISSUED
  UPDATE transfer_requests
  SET status = 'ISSUED', updated_at = now()
  WHERE id = p_transfer_request_id;

  -- Insert an audit log entry if table exists (best-effort)
  BEGIN
    INSERT INTO audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES ('issuance', v_issuance_id, 'create', p_issued_by, json_build_object('transfer_request_id', p_transfer_request_id), now());
  EXCEPTION WHEN undefined_table THEN
    -- ignore if audit_logs not present
    NULL;
  END;

  RETURN v_issuance_id;
END;
$$ LANGUAGE plpgsql;

-- Ensure function privileges for service role will be granted by deployment environment if needed
