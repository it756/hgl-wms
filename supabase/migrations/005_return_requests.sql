-- Migration: 005_return_requests.sql
-- Purpose: Return requests flow — Unit Staff raise returns, BU Manager approves,
--          Warehouse Manager confirms receipt and stock is restored atomically.

BEGIN;

-- ─────────────────────────────────────────────
-- TABLE: return_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.return_requests (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number              text NOT NULL UNIQUE,
  original_transfer_request_id  uuid REFERENCES public.transfer_requests(id) ON DELETE SET NULL,
  sbu_id                        uuid NOT NULL REFERENCES public.sbus(id),
  raised_by                     uuid NOT NULL REFERENCES auth.users(id),
  status                        text NOT NULL DEFAULT 'PENDING_APPROVAL'
                                  CHECK (status IN (
                                    'PENDING_APPROVAL',
                                    'APPROVED',
                                    'REJECTED',
                                    'RECEIVED'
                                  )),
  reason                        text NOT NULL,
  notes                         text,
  approved_by                   uuid REFERENCES auth.users(id),
  approved_at                   timestamptz,
  approval_notes                text,
  received_by                   uuid REFERENCES auth.users(id),
  received_at                   timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.return_requests IS
  'Records of goods being returned from an SBU back to the warehouse. Requires BU Manager approval before the Warehouse Manager can confirm receipt and restore stock.';

CREATE INDEX IF NOT EXISTS idx_return_requests_sbu_id  ON public.return_requests(sbu_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status   ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_raised_by ON public.return_requests(raised_by);

-- ─────────────────────────────────────────────
-- TABLE: return_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.return_line_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id   uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES public.products(id),
  quantity_to_return  integer NOT NULL CHECK (quantity_to_return > 0),
  quantity_received   integer CHECK (quantity_received >= 0),  -- filled by WH Manager on receipt
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.return_line_items IS
  'Line items for a return request. quantity_received is populated when the Warehouse Manager confirms physical receipt.';

CREATE INDEX IF NOT EXISTS idx_return_line_items_return_id ON public.return_line_items(return_request_id);

-- ─────────────────────────────────────────────
-- RPC: process_return_receipt
-- Purpose: Atomically confirm receipt of returned goods and restore stock.
--          Called only by the Warehouse Manager after BU Manager approval.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_return_receipt(
  p_return_request_id uuid,
  p_received_by       uuid
) RETURNS uuid AS $$
DECLARE
  v_return RECORD;
  v_line   RECORD;
BEGIN
  -- Lock the return request row to prevent concurrent receipt
  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id = p_return_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_return_receipt: return request not found (id: %)', p_return_request_id;
  END IF;

  IF v_return.status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'process_return_receipt: return request must be APPROVED to receive (current status: %)', v_return.status;
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

  -- Mark return as RECEIVED
  UPDATE public.return_requests
  SET
    status      = 'RECEIVED',
    received_by = p_received_by,
    received_at = now(),
    updated_at  = now()
  WHERE id = p_return_request_id;

  -- Audit log (best-effort — mirrors pattern in increment_stock_after_grn)
  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'return_request',
      p_return_request_id,
      'return_received',
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

COMMIT;
