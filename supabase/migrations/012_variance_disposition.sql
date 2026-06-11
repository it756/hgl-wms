-- Migration: 006_variance_disposition.sql
-- Purpose: Variance disposition flow — BU Manager decides per GRN line item whether
--          a quantity shortfall is a WRITE_BACK (credit stock) or a LOSS (stock ledger entry).
--
-- New tables:  variance_dispositions, stock_losses
-- New RPC:     process_variance_disposition(p_transfer_request_id, p_decided_by, p_line_dispositions)

BEGIN;

-- ─────────────────────────────────────────────
-- TABLE: variance_dispositions
-- One row per GRN line item that had a variance.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.variance_dispositions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id   uuid NOT NULL REFERENCES public.transfer_requests(id),
  grn_id                uuid NOT NULL REFERENCES public.grns(id),
  grn_line_item_id      uuid NOT NULL REFERENCES public.grn_line_items(id),
  product_id            uuid NOT NULL REFERENCES public.products(id),
  sbu_id                uuid NOT NULL REFERENCES public.sbus(id),
  quantity_variance     integer NOT NULL CHECK (quantity_variance > 0),
  -- The BU Manager's decision for this line
  disposition           text NOT NULL CHECK (disposition IN ('WRITE_BACK', 'LOSS')),
  decided_by            uuid NOT NULL REFERENCES auth.users(id),
  decided_at            timestamptz NOT NULL DEFAULT now(),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variance_dispositions IS
  'Records BU Manager disposition decisions for individual GRN line item variances.
   WRITE_BACK: stock is credited back to warehouse.
   LOSS: quantity is posted to the stock_losses ledger with financial value.';

CREATE INDEX IF NOT EXISTS idx_variance_dispositions_transfer ON public.variance_dispositions(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_variance_dispositions_product  ON public.variance_dispositions(product_id);
CREATE INDEX IF NOT EXISTS idx_variance_dispositions_sbu      ON public.variance_dispositions(sbu_id);

-- ─────────────────────────────────────────────
-- TABLE: stock_losses
-- Permanent loss ledger. One row per LOSS disposition.
-- unit_cost_at_loss is snapshotted from products.unit_cost at decision time.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_losses (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number          text NOT NULL UNIQUE,
  variance_disposition_id   uuid NOT NULL REFERENCES public.variance_dispositions(id),
  transfer_request_id       uuid NOT NULL REFERENCES public.transfer_requests(id),
  grn_id                    uuid NOT NULL REFERENCES public.grns(id),
  product_id                uuid NOT NULL REFERENCES public.products(id),
  sbu_id                    uuid NOT NULL REFERENCES public.sbus(id),
  quantity_lost             integer NOT NULL CHECK (quantity_lost > 0),
  -- Financial snapshot — locked at decision time
  unit_cost_at_loss         numeric(14, 4),          -- NULL if product has no unit_cost
  value_lost                numeric(14, 4),          -- quantity_lost × unit_cost_at_loss; NULL if no cost
  decided_by                uuid NOT NULL REFERENCES auth.users(id),
  decided_at                timestamptz NOT NULL DEFAULT now(),
  reason_notes              text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_losses IS
  'Permanent stock loss ledger. Each row represents inventory written off as a loss
   following a variance disposition decision by a BU Manager.
   unit_cost_at_loss and value_lost are snapshotted at decision time.';

CREATE INDEX IF NOT EXISTS idx_stock_losses_product  ON public.stock_losses(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_losses_sbu      ON public.stock_losses(sbu_id);
CREATE INDEX IF NOT EXISTS idx_stock_losses_transfer ON public.stock_losses(transfer_request_id);

-- ─────────────────────────────────────────────
-- RPC: process_variance_disposition
-- Called by POST /api/bu/variance/[id]/disposition
--
-- p_transfer_request_id — the COMPLETED_WITH_VARIANCE transfer
-- p_decided_by          — BU Manager user id
-- p_line_dispositions   — JSON array:
--   [{
--     "grn_line_item_id": "<uuid>",
--     "disposition": "WRITE_BACK" | "LOSS",
--     "notes": "optional text"
--   }]
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_variance_disposition(
  p_transfer_request_id uuid,
  p_decided_by          uuid,
  p_line_dispositions   json
) RETURNS void AS $$
DECLARE
  v_tr       RECORD;
  v_grn      RECORD;
  v_line     RECORD;
  v_product  RECORD;
  v_item     json;
  v_grn_li   RECORD;
  v_variance integer;
  v_disp_id  uuid;
  v_ref      text;
BEGIN
  -- Lock and validate transfer request
  SELECT * INTO v_tr
    FROM transfer_requests
   WHERE id = p_transfer_request_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_variance_disposition: transfer_request not found: %', p_transfer_request_id;
  END IF;

  IF v_tr.status <> 'COMPLETED_WITH_VARIANCE' THEN
    RAISE EXCEPTION 'process_variance_disposition: transfer must be COMPLETED_WITH_VARIANCE, got: %', v_tr.status;
  END IF;

  -- Fetch the associated GRN (expect exactly one per transfer)
  SELECT * INTO v_grn
    FROM grns
   WHERE transfer_request_id = p_transfer_request_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_variance_disposition: no GRN found for transfer %', p_transfer_request_id;
  END IF;

  -- Process each line disposition from JSON array
  FOR v_item IN SELECT * FROM json_array_elements(p_line_dispositions)
  LOOP
    -- Fetch the GRN line item
    SELECT * INTO v_grn_li
      FROM grn_line_items
     WHERE id = (v_item->>'grn_line_item_id')::uuid
       AND grn_id = v_grn.id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'process_variance_disposition: grn_line_item % not found in grn %',
        v_item->>'grn_line_item_id', v_grn.id;
    END IF;

    v_variance := v_grn_li.issued_quantity - v_grn_li.quantity_received;

    -- Skip lines with no variance (perfectly received)
    IF v_variance <= 0 THEN
      CONTINUE;
    END IF;

    -- Fetch product for cost snapshot
    SELECT * INTO v_product
      FROM products
     WHERE id = v_grn_li.product_id;

    -- Insert variance_disposition record
    INSERT INTO variance_dispositions (
      transfer_request_id, grn_id, grn_line_item_id, product_id, sbu_id,
      quantity_variance, disposition, decided_by, decided_at, notes
    ) VALUES (
      p_transfer_request_id, v_grn.id, v_grn_li.id, v_grn_li.product_id, v_tr.sbu_id,
      v_variance,
      v_item->>'disposition',
      p_decided_by,
      now(),
      v_item->>'notes'
    )
    RETURNING id INTO v_disp_id;

    -- Handle each disposition type
    IF v_item->>'disposition' = 'WRITE_BACK' THEN
      -- Credit the variance gap back to warehouse stock
      UPDATE products
         SET stock_quantity = stock_quantity + v_variance,
             updated_at = now()
       WHERE id = v_grn_li.product_id;

    ELSIF v_item->>'disposition' = 'LOSS' THEN
      -- Generate a loss reference number
      v_ref := 'LOSS-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('stock_loss_ref_seq')::text, 5, '0');

      INSERT INTO stock_losses (
        reference_number, variance_disposition_id, transfer_request_id,
        grn_id, product_id, sbu_id, quantity_lost,
        unit_cost_at_loss, value_lost,
        decided_by, decided_at, reason_notes
      ) VALUES (
        v_ref, v_disp_id, p_transfer_request_id,
        v_grn.id, v_grn_li.product_id, v_tr.sbu_id, v_variance,
        v_product.unit_cost,
        CASE WHEN v_product.unit_cost IS NOT NULL
             THEN v_variance * v_product.unit_cost
             ELSE NULL
        END,
        p_decided_by, now(), v_item->>'notes'
      );
    ELSE
      RAISE EXCEPTION 'process_variance_disposition: invalid disposition value: %', v_item->>'disposition';
    END IF;
  END LOOP;

  -- Mark transfer as fully resolved
  UPDATE transfer_requests
     SET status = 'COMPLETED',
         variance_resolution_notes = 'Disposed by BU Manager via per-line disposition',
         updated_at = now()
   WHERE id = p_transfer_request_id;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'transfer_request',
      p_transfer_request_id,
      'variance_disposition',
      p_decided_by,
      json_build_object('line_count', json_array_length(p_line_dispositions)),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

END;
$$ LANGUAGE plpgsql;

-- Sequence for loss reference numbers
CREATE SEQUENCE IF NOT EXISTS public.stock_loss_ref_seq START WITH 1 INCREMENT BY 1;

COMMIT;
