-- ─────────────────────────────────────────────────────────────────
-- Migration: 018_variance_resolution_notes.sql
--
-- Purpose: Add the `variance_resolution_notes` column to
-- `transfer_requests`. This column is written by the
-- `process_variance_disposition` RPC introduced in migration 012,
-- but the column itself was never declared, causing the RPC to
-- fail at runtime with:
--   ERROR: column "variance_resolution_notes" of relation
--   "transfer_requests" does not exist (SQLSTATE 42703)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS variance_resolution_notes text;

COMMENT ON COLUMN public.transfer_requests.variance_resolution_notes
  IS 'Free-text summary written when a COMPLETED_WITH_VARIANCE transfer is resolved via process_variance_disposition.';
