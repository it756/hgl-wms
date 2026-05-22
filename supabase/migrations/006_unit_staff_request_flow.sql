-- Migration: 006_unit_staff_request_flow.sql
-- Purpose: Adds support for UNIT_STAFF-raised transfer requests with a
--          BU Manager approval step before Finance approval.
--          Flow: UNIT_STAFF raises → PENDING_BU_APPROVAL
--                BU_MANAGER approves → PENDING_APPROVAL (existing Finance queue)
--                FINANCE_MANAGER approves → APPROVED_FOR_ISSUE
--                WAREHOUSE_MANAGER issues → ISSUED

BEGIN;

-- 1. Drop the old CHECK constraint on transfer_requests.status
ALTER TABLE public.transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_status_check;

-- 2. Re-add with PENDING_BU_APPROVAL included
ALTER TABLE public.transfer_requests
  ADD CONSTRAINT transfer_requests_status_check
  CHECK (status IN (
    'PENDING_BU_APPROVAL',
    'PENDING',
    'PENDING_APPROVAL',
    'APPROVED_FOR_ISSUE',
    'ISSUED',
    'CANCELLED',
    'COMPLETED',
    'COMPLETED_WITH_VARIANCE'
  ));

-- 3. Add BU approval audit columns
ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS bu_approved_by      uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS bu_approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS bu_approval_notes   text;

COMMENT ON COLUMN public.transfer_requests.bu_approved_by    IS 'BU_MANAGER who approved or rejected the unit-staff request.';
COMMENT ON COLUMN public.transfer_requests.bu_approved_at    IS 'Timestamp of BU Manager approval/rejection.';
COMMENT ON COLUMN public.transfer_requests.bu_approval_notes IS 'Notes left by BU Manager at approval or rejection.';

COMMIT;
