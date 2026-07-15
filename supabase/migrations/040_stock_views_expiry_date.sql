-- Migration: 040_stock_views_expiry_date.sql
-- Purpose: Expose products.expiry_date through the unit_stock and sbu_stock
--          views so stock listing UIs can surface expiry status without an
--          extra round trip. Both views already join products; this only
--          widens the projection.

BEGIN;

CREATE OR REPLACE VIEW public.unit_stock AS
SELECT
  tr.requesting_unit_id                         AS unit_id,
  tr.sbu_id,
  gli.product_id,
  SUM(gli.quantity_received)::integer           AS quantity,
  p.name                                        AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  p.expiry_date,
  u.name                                        AS unit_name,
  u.code                                        AS unit_code,
  s.name                                        AS sbu_name,
  s.code                                        AS sbu_code
FROM public.grn_line_items gli
JOIN public.grns gr              ON gr.id = gli.grn_id
JOIN public.transfer_requests tr ON tr.id = gr.transfer_request_id
JOIN public.products p           ON p.id = gli.product_id
JOIN public.sbu_units u          ON u.id = tr.requesting_unit_id
JOIN public.sbus s               ON s.id = tr.sbu_id
WHERE tr.requesting_unit_id IS NOT NULL
  AND tr.status IN ('COMPLETED', 'COMPLETED_WITH_VARIANCE')
GROUP BY
  tr.requesting_unit_id, tr.sbu_id, gli.product_id,
  p.name, p.sku, p.unit_of_measure, p.unit_cost, p.is_active, p.expiry_date,
  u.name, u.code, s.name, s.code;

COMMENT ON VIEW public.unit_stock IS
  'Stock physically received by each sbu_unit via submitted GRNs. Does not deduct returns '
  '(return deduction is at SBU level). See sbu_stock for net SBU holdings.';

GRANT SELECT ON public.unit_stock TO authenticated;

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
combined AS (
  SELECT sbu_id, product_id FROM sku_tagged
  UNION
  SELECT sbu_id, product_id FROM seeded
  UNION
  SELECT sbu_id, product_id FROM issued
)
SELECT
  c.sbu_id,
  c.product_id,
  GREATEST(
    COALESCE(t.tagged_quantity, 0)
    + COALESCE(s.total_seeded,  0)
    + COALESCE(i.total_issued,  0)
    - COALESCE(r.total_returned, 0),
    0
  )::integer       AS quantity,
  p.name           AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  p.expiry_date,
  sb.name          AS sbu_name,
  sb.code          AS sbu_code
FROM combined c
LEFT JOIN sku_tagged t  ON t.sbu_id   = c.sbu_id  AND t.product_id = c.product_id
LEFT JOIN seeded s      ON s.sbu_id   = c.sbu_id  AND s.product_id = c.product_id
LEFT JOIN issued i      ON i.sbu_id   = c.sbu_id  AND i.product_id = c.product_id
LEFT JOIN returned r    ON r.sbu_id   = c.sbu_id  AND r.product_id = c.product_id
JOIN public.products p  ON p.id       = c.product_id
JOIN public.sbus sb     ON sb.id      = c.sbu_id;

COMMENT ON VIEW public.sbu_stock IS
  'Net stock for each SBU per product: warehouse SKU-tagged qty + GRN-seeded qty + transfer-issued qty - returned qty.';

GRANT SELECT ON public.sbu_stock TO authenticated;

COMMIT;
