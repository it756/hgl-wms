-- Migration: 023_purchase_requests.sql
-- Purpose: Introduces the purchase request workflow.
--   Flow: SBU_MANAGER creates → PENDING_PROCUREMENT_APPROVAL
--         External Procurement approves via token link → PENDING_INTERNAL_CONTROL_APPROVAL
--         ADMIN (internal control) approves → APPROVED_FOR_PURCHASE / EXPECTED_ORDER
--         Warehouse receives goods, creates supplier GRN (linked or ad hoc)
--         FINANCE_MANAGER / ADMIN approves GRN → stock posted

BEGIN;

-- ─────────────────────────────────────────────
-- TABLE: purchase_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number                text NOT NULL UNIQUE,
  sbu_id                          uuid NOT NULL REFERENCES public.sbus(id),
  created_by                      uuid NOT NULL REFERENCES auth.users(id),
  status                          text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT',
      'PENDING_PROCUREMENT_APPROVAL',
      'PROCUREMENT_CHANGES_REQUESTED',
      'PENDING_INTERNAL_CONTROL_APPROVAL',
      'INTERNAL_CONTROL_REJECTED',
      'APPROVED_FOR_PURCHASE',
      'EXPECTED_ORDER',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
      'REJECTED'
    )),
  supplier_name                   text,
  supplier_email                  text,
  procurement_email               text NOT NULL,
  notes                           text,
  estimated_total                 numeric(12,2),

  -- Procurement (external) audit
  procurement_actioned_at         timestamptz,
  procurement_action              text CHECK (procurement_action IN ('APPROVED','REJECTED','CHANGES_REQUESTED')),
  procurement_notes               text,
  procurement_document_url        text,

  -- Internal control (Admin) audit
  internal_control_actioned_by    uuid REFERENCES auth.users(id),
  internal_control_actioned_at    timestamptz,
  internal_control_action         text CHECK (internal_control_action IN ('APPROVED','REJECTED')),
  internal_control_notes          text,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_sbu_id   ON public.purchase_requests(sbu_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status   ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_by ON public.purchase_requests(created_by);

COMMENT ON TABLE public.purchase_requests IS
  'Purchase requests raised by SBU Managers. External procurement approves via token link; Admin handles internal control.';

-- ─────────────────────────────────────────────
-- TABLE: purchase_request_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_request_line_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id  uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id           uuid REFERENCES public.products(id),
  product_name         text NOT NULL,
  sku                  text,
  quantity_requested   integer NOT NULL CHECK (quantity_requested > 0),
  unit_cost            numeric(12,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  unit_of_measure      text NOT NULL DEFAULT 'units',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prli_purchase_request_id ON public.purchase_request_line_items(purchase_request_id);

COMMENT ON TABLE public.purchase_request_line_items IS
  'Line items for purchase requests. product_id is nullable to allow requesting items not yet in the catalogue.';

-- ─────────────────────────────────────────────
-- TABLE: external_action_tokens
-- Stores hashed tokens for external (procurement) actions. Raw token sent by email only.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.external_action_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text NOT NULL UNIQUE,
  entity_type     text NOT NULL,    -- e.g. 'purchase_request'
  entity_id       uuid NOT NULL,
  actor_email     text NOT NULL,
  actor_type      text NOT NULL,    -- e.g. 'PROCUREMENT'
  allowed_actions text[] NOT NULL,  -- e.g. ARRAY['APPROVE','REJECT','CHANGES_REQUESTED','UPLOAD']
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,      -- set when an approval/rejection action is taken (single-use)
  revoked_at      timestamptz,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_viewed_at  timestamptz,
  last_actor_ip   text,
  last_user_agent text
);

CREATE INDEX IF NOT EXISTS idx_external_tokens_entity   ON public.external_action_tokens(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_tokens_hash     ON public.external_action_tokens(token_hash);

COMMENT ON TABLE public.external_action_tokens IS
  'Secure hashed tokens for external actors (e.g. procurement) to approve/reject purchase requests without a WMS login.';

-- ─────────────────────────────────────────────
-- Add purchase_request_id to supplier_grns
-- Nullable FK — allows both linked and ad hoc GRNs
-- ─────────────────────────────────────────────
ALTER TABLE public.supplier_grns
  ADD COLUMN IF NOT EXISTS purchase_request_id uuid REFERENCES public.purchase_requests(id);

CREATE INDEX IF NOT EXISTS idx_supplier_grns_purchase_request_id
  ON public.supplier_grns(purchase_request_id);

COMMENT ON COLUMN public.supplier_grns.purchase_request_id IS
  'Optional link to an approved purchase request / expected order. NULL for ad hoc GRNs.';

COMMIT;
