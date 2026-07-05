  -- Migration: 025_sbu_finance_threshold.sql
-- The Admin → SBUs screen and /api/admin/sbus/[id] already read/write
-- sbus.finance_approval_threshold, but the column was never created, so
-- saving an SBU threshold failed and nothing could read it.
-- Transfers valued at or above this threshold require Finance approval;
-- NULL means the SBU uses the global finance_approval_threshold app setting.

ALTER TABLE public.sbus
  ADD COLUMN IF NOT EXISTS finance_approval_threshold numeric(12,2);

COMMENT ON COLUMN public.sbus.finance_approval_threshold IS
  'Per-SBU finance approval threshold; NULL falls back to the global app_settings value.';
