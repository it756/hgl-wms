-- Migration: 022_intra_transfer_finance_approval.sql
-- Purpose: Require Finance Manager approval before an intra-warehouse transfer
--          takes effect. Moves stock-decrement responsibility out of the
--          immediate POST handler and into the approval step.
--
-- Status flow:
--   PENDING_FINANCE_APPROVAL  (new initial state, set by warehouse manager)
--   → COMPLETED               (on Finance approval — stock decremented atomically)
--   → CANCELLED               (on Finance rejection or cancellation)
--
-- Also extends the sbu_stock view to account for completed IWT movements
-- (intra_received + intra_sent), so SBU stock levels are accurate.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend the status CHECK and add Finance approval columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.intra_warehouse_transfers
  DROP CONSTRAINT IF EXISTS intra_warehouse_transfers_status_check;

ALTER TABLE public.intra_warehouse_transfers
  ADD CONSTRAINT intra_warehouse_transfers_status_check
    CHECK (status IN ('PENDING','PENDING_FINANCE_APPROVAL','COMPLETED','CANCELLED'));

ALTER TABLE public.intra_warehouse_transfers
  ADD COLUMN IF NOT EXISTS finance_approved_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS finance_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS finance_notes        text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: approve_intra_transfer
--    Called by Finance Manager to approve a pending IWT.
--    Validates stock, decrements warehouse pool (when from_sbu_id IS NULL),
--    then marks the row COMPLETED atomically.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_intra_transfer(
  p_transfer_id   uuid,
  p_approved_by   uuid,
  p_notes         text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_product_id    uuid;
  v_quantity      integer;
  v_from_sbu_id   uuid;
  v_to_sbu_id     uuid;
  v_status        text;
  v_stock_before  integer;
  v_sbu_qty       integer;
BEGIN
  -- Lock the transfer row
  SELECT product_id, quantity, from_sbu_id, to_sbu_id, status
    INTO v_product_id, v_quantity, v_from_sbu_id, v_to_sbu_id, v_status
    FROM public.intra_warehouse_transfers
   WHERE id = p_transfer_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approve_intra_transfer: transfer not found (id: %)', p_transfer_id;
  END IF;

  IF v_status <> 'PENDING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'approve_intra_transfer: transfer is not pending approval (status: %)', v_status;
  END IF;

  IF v_from_sbu_id IS NULL THEN
    -- Source is the central warehouse pool — check and decrement products.stock_quantity
    SELECT stock_quantity INTO v_stock_before
      FROM public.products
     WHERE id = v_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'approve_intra_transfer: product not found (id: %)', v_product_id;
    END IF;

    IF v_stock_before < v_quantity THEN
      RAISE EXCEPTION
        'approve_intra_transfer: insufficient warehouse stock (available: %, requested: %)',
        v_stock_before, v_quantity;
    END IF;

    UPDATE public.products
       SET stock_quantity = stock_quantity - v_quantity,
           updated_at     = now()
     WHERE id = v_product_id;

  ELSE
    -- Source is another SBU — validate against sbu_stock view (no warehouse pool change)
    SELECT quantity INTO v_sbu_qty
      FROM public.sbu_stock
     WHERE sbu_id    = v_from_sbu_id
       AND product_id = v_product_id;

    IF v_sbu_qty IS NULL OR v_sbu_qty < v_quantity THEN
      RAISE EXCEPTION
        'approve_intra_transfer: insufficient SBU stock (sbu: %, available: %, requested: %)',
        v_from_sbu_id, COALESCE(v_sbu_qty, 0), v_quantity;
    END IF;
  END IF;

  -- Mark the transfer completed
  UPDATE public.intra_warehouse_transfers
     SET status              = 'COMPLETED',
         finance_approved_by = p_approved_by,
         finance_approved_at = now(),
         finance_notes       = p_notes,
         updated_at          = now()
   WHERE id = p_transfer_id;

  -- Audit log (best effort)
  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES (
      'intra_warehouse_transfer',
      p_transfer_id,
      'finance_approve',
      p_approved_by,
      json_build_object('notes', p_notes),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update sbu_stock view to include completed IWT movements
--    Extends migration 021: adds intra_received and intra_sent CTEs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.sbu_stock AS
WITH sku_tagged AS (
  -- Warehouse stock for products whose SKU prefix matches an SBU code
  SELECT
    s.id   AS sbu_id,
    p.id   AS product_id,
    p.stock_quantity AS tagged_quantity
  FROM public.sbus s
  JOIN public.products p ON p.sku LIKE (s.code || '-%')
  WHERE p.is_active = true
),
seeded AS (
  -- Stock received directly for an SBU via approved Supplier GRNs
  SELECT
    sg.sbu_id,
    sgli.product_id,
    SUM(sgli.quantity_received) AS total_seeded
  FROM public.supplier_grn_line_items sgli
  JOIN public.supplier_grns sg ON sgli.supplier_grn_id = sg.id
  WHERE sg.status = 'GRN_APPROVED'
    AND sg.sbu_id IS NOT NULL
  GROUP BY sg.sbu_id, sgli.product_id
),
issued AS (
  -- Stock issued to an SBU via transfer requests
  SELECT
    tr.sbu_id,
    ili.product_id,
    SUM(ili.quantity_issued) AS total_issued
  FROM public.issuance_line_items ili
  JOIN public.issuances i          ON ili.issuance_id = i.id
  JOIN public.transfer_requests tr ON i.transfer_request_id = tr.id
  GROUP BY tr.sbu_id, ili.product_id
),
returned AS (
  -- Stock returned to the warehouse from an SBU
  SELECT
    rr.sbu_id,
    rli.product_id,
    SUM(COALESCE(rli.quantity_received, 0)) AS total_returned
  FROM public.return_line_items rli
  JOIN public.return_requests rr ON rli.return_request_id = rr.id
  WHERE rr.status = 'RECEIVED'
  GROUP BY rr.sbu_id, rli.product_id
),
intra_received AS (
  -- Stock received by an SBU via completed intra-warehouse transfers
  SELECT
    to_sbu_id  AS sbu_id,
    product_id,
    SUM(quantity) AS total_intra_received
  FROM public.intra_warehouse_transfers
  WHERE status = 'COMPLETED'
  GROUP BY to_sbu_id, product_id
),
intra_sent AS (
  -- Stock sent away from an SBU via completed intra-warehouse transfers (SBU-to-SBU only)
  SELECT
    from_sbu_id AS sbu_id,
    product_id,
    SUM(quantity) AS total_intra_sent
  FROM public.intra_warehouse_transfers
  WHERE status      = 'COMPLETED'
    AND from_sbu_id IS NOT NULL
  GROUP BY from_sbu_id, product_id
),
combined AS (
  SELECT sbu_id, product_id FROM sku_tagged
  UNION
  SELECT sbu_id, product_id FROM seeded
  UNION
  SELECT sbu_id, product_id FROM issued
  UNION
  SELECT sbu_id, product_id FROM intra_received
)
SELECT
  c.sbu_id,
  c.product_id,
  GREATEST(
    COALESCE(t.tagged_quantity,          0)
    + COALESCE(s.total_seeded,           0)
    + COALESCE(i.total_issued,           0)
    + COALESCE(ir.total_intra_received,  0)
    - COALESCE(r.total_returned,         0)
    - COALESCE(iss.total_intra_sent,     0),
    0
  )::integer       AS quantity,
  p.name           AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  sb.name          AS sbu_name,
  sb.code          AS sbu_code
FROM combined c
LEFT JOIN sku_tagged t     ON t.sbu_id    = c.sbu_id  AND t.product_id  = c.product_id
LEFT JOIN seeded s         ON s.sbu_id    = c.sbu_id  AND s.product_id  = c.product_id
LEFT JOIN issued i         ON i.sbu_id    = c.sbu_id  AND i.product_id  = c.product_id
LEFT JOIN returned r       ON r.sbu_id    = c.sbu_id  AND r.product_id  = c.product_id
LEFT JOIN intra_received ir ON ir.sbu_id  = c.sbu_id  AND ir.product_id = c.product_id
LEFT JOIN intra_sent iss   ON iss.sbu_id  = c.sbu_id  AND iss.product_id = c.product_id
JOIN public.products p     ON p.id        = c.product_id
JOIN public.sbus sb        ON sb.id       = c.sbu_id;

COMMENT ON VIEW public.sbu_stock IS
  'Net stock for each SBU per product: warehouse SKU-tagged qty + GRN-seeded qty + transfer-issued qty + intra-received qty - returned qty - intra-sent qty.';

GRANT SELECT ON public.sbu_stock TO authenticated;

COMMIT;
