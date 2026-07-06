-- Migration: 026_pr_printed_at.sql
-- Purpose: Adds a printed_at audit timestamp to purchase_requests so the system
--          can record when a finance-approved PR was printed/exported.
--
-- Rollback:
--   ALTER TABLE public.purchase_requests DROP COLUMN IF EXISTS printed_at;

BEGIN;

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS printed_at timestamptz;

COMMENT ON COLUMN public.purchase_requests.printed_at IS
  'Timestamp of the most recent print/export of this purchase request. '
  'NULL if the request has never been printed.';

COMMIT;
