-- Migration: 019_sbu_stock.sql
-- Purpose: Track per-SBU stock holdings derived from issued transfers minus returned goods.
--          SBU users (BU_MANAGER, UNIT_STAFF) may only view their own SBU's stock.
--          Warehouse Manager, Finance Manager, and Admin can view all.

BEGIN;

-- ─────────────────────────────────────────────
-- VIEW: sbu_stock
-- Calculates the net quantity of each product held by each SBU:
--   total_issued (from warehouse) - total_returned (to warehouse with RECEIVED status)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.sbu_stock AS
WITH issued AS (
  SELECT
    tr.sbu_id,
    ili.product_id,
    SUM(ili.quantity_issued) AS total_issued
  FROM public.issuance_line_items ili
  JOIN public.issuances i         ON ili.issuance_id = i.id
  JOIN public.transfer_requests tr ON i.transfer_request_id = tr.id
  GROUP BY tr.sbu_id, ili.product_id
),
returned AS (
  SELECT
    rr.sbu_id,
    rli.product_id,
    SUM(COALESCE(rli.quantity_received, 0)) AS total_returned
  FROM public.return_line_items rli
  JOIN public.return_requests rr ON rli.return_request_id = rr.id
  WHERE rr.status = 'RECEIVED'
  GROUP BY rr.sbu_id, rli.product_id
)
SELECT
  i.sbu_id,
  i.product_id,
  GREATEST(i.total_issued - COALESCE(r.total_returned, 0), 0)::integer AS quantity,
  p.name        AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  s.name        AS sbu_name,
  s.code        AS sbu_code
FROM issued i
LEFT JOIN returned r      ON r.sbu_id    = i.sbu_id    AND r.product_id = i.product_id
JOIN public.products p    ON p.id        = i.product_id
JOIN public.sbus s        ON s.id        = i.sbu_id;

COMMENT ON VIEW public.sbu_stock IS
  'Net stock held by each SBU per product: total issued minus total returned (RECEIVED status).';

-- Grant SELECT on the view to authenticated role (API uses service role, so access is controlled
-- in the application layer by role checks in the API handler).
GRANT SELECT ON public.sbu_stock TO authenticated;

COMMIT;
