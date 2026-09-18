-- Migration: 042_unit_stock_multi_destination.sql
-- Purpose: A transfer request can now fan out to several destination units, so
--          each GRN belongs to a single unit (grns.unit_id) rather than the
--          request's (now purely administrative) requesting_unit_id. Re-derive
--          unit_stock from grns.unit_id, and rely on GRN existence itself
--          (rather than the header-level status) to signal that a given unit
--          has received its goods, since sibling destinations on the same
--          request may still be PARTIALLY_RECEIVED.

BEGIN;

CREATE OR REPLACE VIEW public.unit_stock AS
SELECT
  gr.unit_id                                    AS unit_id,
  u.sbu_id                                       AS sbu_id,
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
JOIN public.sbu_units u          ON u.id = gr.unit_id
JOIN public.sbus s                ON s.id = u.sbu_id
WHERE tr.status <> 'CANCELLED'
GROUP BY
  gr.unit_id, u.sbu_id, gli.product_id,
  p.name, p.sku, p.unit_of_measure, p.unit_cost, p.is_active,
  u.name, u.code, s.name, s.code;

COMMENT ON VIEW public.unit_stock IS
  'Stock physically received by each sbu_unit via its own submitted GRN '
  '(grns.unit_id), independent of sibling destinations on the same multi-'
  'destination transfer request. Does not deduct returns or sales — see '
  'sbu_stock for net SBU holdings and unit_sales for consumption.';

GRANT SELECT ON public.unit_stock TO authenticated;

COMMIT;
