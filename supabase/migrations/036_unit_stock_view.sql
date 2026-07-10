-- Migration: 036_unit_stock_view.sql
-- Purpose: Adds a unit_stock view that shows net stock held per sbu_unit,
--          derived from transfer requests issued to each unit.
--
-- Note: Return deduction is not applied at unit level because return_requests
--       does not yet track requesting_unit_id (SBU-level sbu_stock already handles
--       returns). A future migration can add requesting_unit_id to return_requests
--       and update this view accordingly.
--
-- UNIT_STAFF users should see only items that were sent to their unit.
-- BU_MANAGERS continue to see SBU-level stock via the existing sbu_stock view.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.unit_stock;

BEGIN;

CREATE OR REPLACE VIEW public.unit_stock AS
SELECT
  tr.requesting_unit_id                     AS unit_id,
  tr.sbu_id,
  ili.product_id,
  SUM(ili.quantity_issued)::integer         AS quantity,
  p.name                                    AS product_name,
  p.sku,
  p.unit_of_measure,
  p.unit_cost,
  p.is_active,
  u.name                                    AS unit_name,
  u.code                                    AS unit_code,
  s.name                                    AS sbu_name,
  s.code                                    AS sbu_code
FROM public.issuance_line_items ili
JOIN public.issuances i          ON ili.issuance_id = i.id
JOIN public.transfer_requests tr ON i.transfer_request_id = tr.id
JOIN public.products   p         ON p.id = ili.product_id
JOIN public.sbu_units  u         ON u.id = tr.requesting_unit_id
JOIN public.sbus       s         ON s.id = tr.sbu_id
WHERE tr.requesting_unit_id IS NOT NULL
GROUP BY
  tr.requesting_unit_id, tr.sbu_id, ili.product_id,
  p.name, p.sku, p.unit_of_measure, p.unit_cost, p.is_active,
  u.name, u.code, s.name, s.code;

COMMENT ON VIEW public.unit_stock IS
  'Stock issued to each sbu_unit via transfer requests. Does not deduct returns '
  '(return deduction is at SBU level). See sbu_stock for net SBU holdings.';

GRANT SELECT ON public.unit_stock TO authenticated;

COMMIT;