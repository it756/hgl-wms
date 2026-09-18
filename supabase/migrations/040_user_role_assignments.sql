-- Migration: 040_user_role_assignments.sql
-- Purpose: Let one Auth account hold multiple roles across multiple SBUs
--          (e.g. BU_MANAGER in SBU A and UNIT_STAFF in SBU B at the same time).
--          profiles.role/sbu_id/unit_id continue to represent the user's current
--          ACTIVE working context; user_role_assignments is the full set of
--          role/SBU/unit combinations they can switch between.
--
-- Rollback:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS active_assignment_id;
--   DROP TABLE IF EXISTS public.user_role_assignments;

BEGIN;

-- ─────────────────────────────────────────────
-- TABLE: user_role_assignments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN (
                  'BU_MANAGER','WAREHOUSE_MANAGER','UNIT_STAFF','FINANCE_MANAGER',
                  'ADMIN','INTERNAL_CONTROL_OFFICER'
                )),
  sbu_id        uuid REFERENCES public.sbus(id) ON DELETE CASCADE,
  unit_id       uuid REFERENCES public.sbu_units(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (role = 'UNIT_STAFF' AND sbu_id IS NOT NULL AND unit_id IS NOT NULL)
    OR (role = 'BU_MANAGER' AND sbu_id IS NOT NULL AND unit_id IS NULL)
    OR (role IN ('WAREHOUSE_MANAGER','FINANCE_MANAGER','ADMIN','INTERNAL_CONTROL_OFFICER')
        AND sbu_id IS NULL AND unit_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id
  ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_sbu_id
  ON public.user_role_assignments(sbu_id);

-- One row per distinct user+role+sbu+unit combo (NULLs normalized to a sentinel
-- so two global-role rows for the same user/role are still caught as duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignments_combo
  ON public.user_role_assignments (
    user_id,
    role,
    COALESCE(sbu_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(unit_id, '00000000-0000-0000-0000-000000000000')
  );

COMMENT ON TABLE public.user_role_assignments IS
  'One row per role a user holds, optionally scoped to an SBU and unit. '
  'Lets one Auth account hold multiple roles across multiple SBUs.';

-- ─────────────────────────────────────────────
-- profiles: track which assignment is mirrored as the active context
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_assignment_id uuid;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_active_assignment;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_active_assignment
  FOREIGN KEY (active_assignment_id)
  REFERENCES public.user_role_assignments(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_assignment_id IS
  'The user_role_assignments row the user last explicitly selected as their active '
  'working context. profiles.role/sbu_id/unit_id always hold the live values for '
  'that context; this column is bookkeeping for the context switcher UI.';

-- ─────────────────────────────────────────────
-- Backfill: give every existing profile one assignment matching its current
-- role/sbu/unit, and mark it as the active assignment.
-- ─────────────────────────────────────────────
INSERT INTO public.user_role_assignments (user_id, role, sbu_id, unit_id, is_active, created_at, updated_at)
SELECT p.id, p.role, p.sbu_id, p.unit_id, p.is_active, p.created_at, p.updated_at
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_role_assignments ura
  WHERE ura.user_id = p.id
    AND ura.role = p.role
    AND ura.sbu_id IS NOT DISTINCT FROM p.sbu_id
    AND ura.unit_id IS NOT DISTINCT FROM p.unit_id
);

UPDATE public.profiles p
SET active_assignment_id = ura.id
FROM public.user_role_assignments ura
WHERE ura.user_id = p.id
  AND ura.role = p.role
  AND ura.sbu_id IS NOT DISTINCT FROM p.sbu_id
  AND ura.unit_id IS NOT DISTINCT FROM p.unit_id
  AND p.active_assignment_id IS NULL;

-- ─────────────────────────────────────────────
-- RLS (service role used by the API bypasses this; kept as defense in depth)
-- ─────────────────────────────────────────────
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role assignments"
  ON public.user_role_assignments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all role assignments"
  ON public.user_role_assignments
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

COMMIT;
