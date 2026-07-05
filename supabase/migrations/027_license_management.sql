-- Migration: 027_license_management.sql
-- Purpose: Adds licensed-staff tracking to the profiles table and introduces a
--          license_audit_log table for a full history of license assignments and
--          revocations.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.license_audit_log;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS licensed,
--     DROP COLUMN IF EXISTS license_type,
--     DROP COLUMN IF EXISTS license_issued_at,
--     DROP COLUMN IF EXISTS license_expires_at;

BEGIN;

-- ─────────────────────────────────────────────
-- Extend profiles with license fields
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS licensed           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_type       text,
  ADD COLUMN IF NOT EXISTS license_issued_at  timestamptz,
  ADD COLUMN IF NOT EXISTS license_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.licensed           IS 'True if this staff member currently holds an active licence.';
COMMENT ON COLUMN public.profiles.license_type       IS 'Type/category of licence (e.g. "PHARMACEUTICAL", "CONTROLLED_SUBSTANCES").';
COMMENT ON COLUMN public.profiles.license_issued_at  IS 'Date the licence was issued.';
COMMENT ON COLUMN public.profiles.license_expires_at IS 'Date the licence expires. NULL means no fixed expiry.';

-- ─────────────────────────────────────────────
-- TABLE: license_audit_log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action         text NOT NULL CHECK (action IN ('ASSIGNED', 'UPDATED', 'REVOKED')),
  license_type   text,
  issued_at      timestamptz,
  expires_at     timestamptz,
  performed_by   uuid NOT NULL REFERENCES auth.users(id),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_audit_log_profile_id
  ON public.license_audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_license_audit_log_performed_by
  ON public.license_audit_log(performed_by);

COMMENT ON TABLE public.license_audit_log IS
  'Full audit trail of licence assignments, updates, and revocations for staff profiles.';

-- RLS: only admins can read/insert
ALTER TABLE public.license_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage license_audit_log"
  ON public.license_audit_log
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

COMMIT;
