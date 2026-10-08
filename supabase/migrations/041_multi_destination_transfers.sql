-- Migration: 041_multi_destination_transfers.sql
-- Purpose: Allow a single transfer request to fan out to multiple destination
--          sbu_units by moving the destination from the transfer_requests header
--          down to transfer_line_items, and scoping GRNs to a single destination
--          unit so each destination can independently confirm receipt of its
--          own lines without waiting on the others.

BEGIN;

-- 1. transfer_line_items: each line now carries its own destination unit.
ALTER TABLE public.transfer_line_items
  ADD COLUMN IF NOT EXISTS destination_unit_id uuid REFERENCES public.sbu_units(id);

-- Backfill existing rows from the (previously single) header destination.
UPDATE public.transfer_line_items tli
SET destination_unit_id = tr.requesting_unit_id
FROM public.transfer_requests tr
WHERE tli.transfer_request_id = tr.id
  AND tli.destination_unit_id IS NULL;

ALTER TABLE public.transfer_line_items
  ALTER COLUMN destination_unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tli_destination_unit_id
  ON public.transfer_line_items(destination_unit_id);

COMMENT ON COLUMN public.transfer_requests.requesting_unit_id IS
  'The unit that raised/owns this request. Actual fulfilment destinations are '
  'per line item (see transfer_line_items.destination_unit_id) — a single '
  'request may fan out to several destination units.';

-- 2. issuance_line_items: preserve destination at the moment of issuance so
--    warehouse dispatch and reporting can be sliced per destination unit.
ALTER TABLE public.issuance_line_items
  ADD COLUMN IF NOT EXISTS destination_unit_id uuid REFERENCES public.sbu_units(id);

-- 3. grns: a GRN now belongs to exactly one destination unit, so several
--    units on the same transfer request can each submit their own receipt.
ALTER TABLE public.grns
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.sbu_units(id);

UPDATE public.grns g
SET unit_id = tr.requesting_unit_id
FROM public.transfer_requests tr
WHERE g.transfer_request_id = tr.id
  AND g.unit_id IS NULL;

ALTER TABLE public.grns
  ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grns_unit_id ON public.grns(unit_id);

-- A unit can only submit one GRN per transfer request.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grns_transfer_unit_unique
  ON public.grns(transfer_request_id, unit_id);

-- 4. transfer_requests.status: add PARTIALLY_RECEIVED for the window after
--    issuance where some (but not all) destination units have submitted a GRN.
ALTER TABLE public.transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_status_check;

ALTER TABLE public.transfer_requests
  ADD CONSTRAINT transfer_requests_status_check
  CHECK (status IN (
    'PENDING_BU_APPROVAL',
    'PENDING',
    'PENDING_APPROVAL',
    'APPROVED_FOR_ISSUE',
    'ISSUED',
    'PARTIALLY_RECEIVED',
    'CANCELLED',
    'COMPLETED',
    'COMPLETED_WITH_VARIANCE'
  ));

COMMIT;
