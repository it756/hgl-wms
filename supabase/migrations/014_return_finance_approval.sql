-- Migration: 014_return_finance_approval.sql
-- Purpose: Insert a Finance approval gate before returned goods restore stock.
--   New status flow:
--     PENDING_APPROVAL → APPROVED (BU Manager)
--                     → AWAITING_FINANCE_APPROVAL (WH Manager confirms physical receipt)
--                     → STOCK_RESTORED (Finance Manager approves; stock incremented)
--                     → REJECTED (at any stage)
--   Existing 'RECEIVED' status is retained for backwards compatibility but new
--   receipts use 'AWAITING_FINANCE_APPROVAL'.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend status CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.return_requests
  DROP CONSTRAINT IF EXISTS return_requests_status_check;

ALTER TABLE public.return_requests
  ADD CONSTRAINT return_requests_status_check
  CHECK (status IN (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'RECEIVED',                  -- legacy; retained for historical rows
    'AWAITING_FINANCE_APPROVAL', -- new: physically received, awaiting Finance
    'STOCK_RESTORED'             -- new: Finance approved, stock incremented
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Finance approval columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS finance_approved_by    uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS finance_approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS finance_approval_notes text;

COMMENT ON COLUMN public.return_requests.finance_approved_by IS
  'Finance Manager who released the stock-credit step. Populated when status moves to STOCK_RESTORED.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: process_return_physical_receipt
--    WH Manager confirms physical receipt. Marks AWAITING_FINANCE_APPROVAL.
--    Does NOT increment stock — that happens in process_return_stock_credit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_return_physical_receipt(
  p_return_request_id uuid,
  p_received_by       uuid
) RETURNS uuid AS $$
DECLARE
  v_return RECORD;
BEGIN
  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id = p_return_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_return_physical_receipt: return request not found (id: %)', p_return_request_id;
  END IF;

  IF v_return.status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'process_return_physical_receipt: return request must be APPROVED to receive (current status: %)', v_return.status;
  END IF;

  UPDATE public.return_requests
  SET
    status      = 'AWAITING_FINANCE_APPROVAL',
    received_by = p_received_by,
    received_at = now(),
    updated_at  = now()
  WHERE id = p_return_request_id;

  -- Best-effort audit log
  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'return_request',
      p_return_request_id,
      'return_physical_receipt',
      p_received_by,
      json_build_object('received_at', now()),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_return_request_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: process_return_stock_credit
--    Finance Manager approves; stock is restored atomically; status STOCK_RESTORED.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_return_stock_credit(
  p_return_request_id uuid,
  p_approved_by       uuid,
  p_notes             text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_return RECORD;
  v_line   RECORD;
BEGIN
  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id = p_return_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_return_stock_credit: return request not found (id: %)', p_return_request_id;
  END IF;

  IF v_return.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'process_return_stock_credit: return must be AWAITING_FINANCE_APPROVAL (current: %)', v_return.status;
  END IF;

  -- Restore stock for each line item
  FOR v_line IN
    SELECT * FROM public.return_line_items
    WHERE return_request_id = p_return_request_id
  LOOP
    UPDATE public.products
    SET
      stock_quantity = stock_quantity + v_line.quantity_to_return,
      updated_at     = now()
    WHERE id = v_line.product_id;
  END LOOP;

  UPDATE public.return_requests
  SET
    status                 = 'STOCK_RESTORED',
    finance_approved_by    = p_approved_by,
    finance_approved_at    = now(),
    finance_approval_notes = p_notes,
    updated_at             = now()
  WHERE id = p_return_request_id;

  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'return_request',
      p_return_request_id,
      'return_stock_restored',
      p_approved_by,
      json_build_object('approved_at', now(), 'notes', p_notes),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_return_request_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
