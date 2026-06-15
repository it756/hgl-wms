-- Migration: 020_sbu_stock_include_supplier_grns.sql
-- Purpose: Extend the sbu_stock view to include stock seeded via approved Supplier GRNs
--          tagged to an SBU, in addition to stock received via transfer issuances.
--
-- Stock for an SBU = (supplier_grn seeded qty) + (transfer issued qty) - (returned qty)

BEGIN;

CREATE OR REPLACE VIEW public.sbu_stock AS
WITH seeded AS (
  -- Stock received directly for this SBU via approved Supplier GRNs
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
  -- Stock issued to this SBU via completed transfer requests
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
  -- Stock returned back to the warehouse from this SBU
  SELECT
    rr.sbu_id,
    rli.product_id,
    SUM(COALESCE(rli.quantity_received, 0)) AS total_returned
  FROM public.return_line_items rli
  JOIN public.return_requests rr ON rli.return_request_id = rr.id
  WHERE rr.status = 'RECEIVED'
  GROUP BY rr.sbu_id, rli.product_id
),
combined AS (
  -- Union of all sbu_id + product_id pairs from both sources
  SELECT sbu_id, product_id FROM seeded
  UNION
  SELECT sbu_id, product_id FROM issued
)
SELECT
  c.sbu_id,
  c.product_id,
  GREATEST(
    COALESCE(s.total_seeded, 0) + COALESCE(i.total_issued, 0) - COALESCE(r.total_returned, 0),
    0
  )::integer                AS quantity,
  p.name                    AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  sb.name                   AS sbu_name,
  sb.code                   AS sbu_code
FROM combined c
LEFT JOIN seeded s     ON s.sbu_id    = c.sbu_id    AND s.product_id  = c.product_id
LEFT JOIN issued i     ON i.sbu_id    = c.sbu_id    AND i.product_id  = c.product_id
LEFT JOIN returned r   ON r.sbu_id    = c.sbu_id    AND r.product_id  = c.product_id
JOIN public.products p ON p.id        = c.product_id
JOIN public.sbus sb    ON sb.id       = c.sbu_id;

COMMENT ON VIEW public.sbu_stock IS
  'Net stock held by each SBU per product: (supplier GRN seeded + transfer issued) minus returned (RECEIVED status).';

GRANT SELECT ON public.sbu_stock TO authenticated;

COMMIT;
