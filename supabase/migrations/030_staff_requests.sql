-- Migration: 030_staff_requests.sql
-- Purpose: Replaces direct "Add Staff" capability for BU Managers with a
--          request-based workflow mirroring the admin user-creation flow.
--          BU Managers submit a staff request; only Admins can approve and
--          trigger the actual user account creation.
--
-- Flow:
--   BU_MANAGER submits → status: PENDING
--   ADMIN reviews  → status: APPROVED (triggers user creation) or REJECTED
--
-- Rollback:
--   DROP TABLE IF EXISTS public.staff_requests;

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_sbu_id   uuid REFERENCES public.sbus(id)     ON DELETE SET NULL,
  requested_user_info   jsonb NOT NULL,
  requested_roles       text[] NOT NULL,
  status                text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by           uuid REFERENCES auth.users(id),
  reviewed_at           timestamptz,
  notes                 text,
  created_by            uuid NOT NULL REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_requests_status
  ON public.staff_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_requests_created_by
  ON public.staff_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_requests_sbu_id
  ON public.staff_requests(requested_by_sbu_id);

COMMENT ON TABLE public.staff_requests IS
  'Staff addition requests raised by BU Managers. Admins review and approve/reject. '
  'Only on APPROVED does the Admin create the actual user account.';
COMMENT ON COLUMN public.staff_requests.requested_user_info IS
  'JSONB capturing proposed user details: full_name, email, role, etc.';
COMMENT ON COLUMN public.staff_requests.requested_roles IS
  'Array of requested roles (e.g. ["UNIT_STAFF"]). Admin may adjust at approval time.';

-- RLS
ALTER TABLE public.staff_requests ENABLE ROW LEVEL SECURITY;

-- BU Managers can insert requests scoped to their own SBU
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff_requests'
      AND policyname = 'BU Managers can create staff requests'
  ) THEN
    CREATE POLICY "BU Managers can create staff requests"
      ON public.staff_requests FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'BU_MANAGER'
            AND p.sbu_id = requested_by_sbu_id
        )
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- BU Managers can read their own SBU's requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff_requests'
      AND policyname = 'BU Managers can view their SBU staff requests'
  ) THEN
    CREATE POLICY "BU Managers can view their SBU staff requests"
      ON public.staff_requests FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'BU_MANAGER'
            AND p.sbu_id = requested_by_sbu_id
        )
      );
  END IF;
END $$;

-- Admins have full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff_requests'
      AND policyname = 'Admins can manage all staff requests'
  ) THEN
    CREATE POLICY "Admins can manage all staff requests"
      ON public.staff_requests FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;
