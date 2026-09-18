-- Migration: 038_unit_stock_from_grn_receipts.sql
-- Purpose: Make unit-level stock reflect goods actually received by Unit Staff
--          on GRN submission, instead of quantities merely issued by warehouse.

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
  p.name, p.sku, p.unit_of_measure, p.unit_cost, p.is_active,
  u.name, u.code, s.name, s.code;

COMMENT ON VIEW public.unit_stock IS
  'Stock physically received by each sbu_unit via submitted GRNs. Does not deduct returns '
  '(return deduction is at SBU level). See sbu_stock for net SBU holdings.';

GRANT SELECT ON public.unit_stock TO authenticated;

COMMIT;