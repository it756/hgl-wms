-- Migration: 000_initial_schema.sql
-- Purpose: Full schema for Harvest WMS v1.0
-- Run via: supabase db push or psql
-- NOTE: Supabase Auth manages the auth.users table.
--       This migration creates application tables that reference auth.users(id).

BEGIN;

-- ─────────────────────────────────────────────
-- ENUMERATIONS (as text with CHECK constraints)
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- TABLE: sbus (Strategic Business Units)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sbus (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  code          text NOT NULL UNIQUE,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sbus IS 'Strategic Business Units that can raise transfer requests.';

-- ─────────────────────────────────────────────
-- TABLE: profiles (extends auth.users)
-- Role: BU_MANAGER | WAREHOUSE_MANAGER | UNIT_STAFF | FINANCE_MANAGER | ADMIN
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  role          text NOT NULL CHECK (role IN (
                  'BU_MANAGER','WAREHOUSE_MANAGER','UNIT_STAFF','FINANCE_MANAGER','ADMIN'
                )),
  sbu_id        uuid REFERENCES public.sbus(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Application user profiles with roles and SBU assignments.';

-- ─────────────────────────────────────────────
-- TABLE: products
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  sku                   text NOT NULL UNIQUE,
  description           text,
  unit_of_measure       text NOT NULL DEFAULT 'units',
  stock_quantity        integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold   integer NOT NULL DEFAULT 10,
  unit_cost             numeric(12,2),
  is_active             boolean NOT NULL DEFAULT true,
  warehouse_id          uuid,          -- nullable for v1, extensible to multi-warehouse in v2
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.products IS 'Central warehouse product catalogue with stock quantities.';

-- ─────────────────────────────────────────────
-- TABLE: app_settings
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('finance_approval_threshold', '1000', 'Monetary threshold above which transfers require Finance Manager approval'),
  ('finance_approval_scope', 'global', 'global | per_sbu'),
  ('session_timeout_minutes', '30', 'User session timeout in minutes'),
  ('low_stock_alert_enabled', 'true', 'Enable low-stock in-app alerts for Warehouse Manager')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- TABLE: sbu_settings (per-SBU overrides)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sbu_settings (
  sbu_id                      uuid NOT NULL REFERENCES public.sbus(id) ON DELETE CASCADE,
  finance_approval_threshold  numeric(12,2),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sbu_id)
);

-- ─────────────────────────────────────────────
-- TABLE: transfer_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transfer_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number            text NOT NULL UNIQUE,
  sbu_id                      uuid NOT NULL REFERENCES public.sbus(id),
  raised_by                   uuid NOT NULL REFERENCES auth.users(id),
  status                      text NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN (
                                  'PENDING','PENDING_APPROVAL','APPROVED_FOR_ISSUE',
                                  'ISSUED','CANCELLED','COMPLETED','COMPLETED_WITH_VARIANCE'
                                )),
  required_date               date,
  notes                       text,
  estimated_value             numeric(12,2),
  requires_finance_approval   boolean NOT NULL DEFAULT false,
  approved_by                 uuid REFERENCES auth.users(id),
  approved_at                 timestamptz,
  finance_approval_notes      text,
  warehouse_id                uuid,          -- nullable for v1
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_sbu_id  ON public.transfer_requests(sbu_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status  ON public.transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_raised_by ON public.transfer_requests(raised_by);
COMMENT ON TABLE public.transfer_requests IS 'Transfer requests raised by BU Managers.';

-- ─────────────────────────────────────────────
-- TABLE: transfer_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transfer_line_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES public.products(id),
  requested_quantity  integer NOT NULL CHECK (requested_quantity > 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tli_transfer_request_id ON public.transfer_line_items(transfer_request_id);

-- ─────────────────────────────────────────────
-- TABLE: issuances
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.issuances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id uuid NOT NULL REFERENCES public.transfer_requests(id),
  issued_by           uuid NOT NULL REFERENCES auth.users(id),
  issue_date          timestamptz NOT NULL DEFAULT now(),
  logistics_notes     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issuances_transfer_request_id ON public.issuances(transfer_request_id);

-- ─────────────────────────────────────────────
-- TABLE: issuance_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.issuance_line_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_id      uuid NOT NULL REFERENCES public.issuances(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES public.products(id),
  quantity_issued  integer NOT NULL CHECK (quantity_issued >= 0),
  shortfall_reason text,    -- populated when quantity_issued < requested_quantity
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ili_issuance_id ON public.issuance_line_items(issuance_id);

-- ─────────────────────────────────────────────
-- TABLE: grns (Goods Received Notes — from SBU staff)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id uuid NOT NULL REFERENCES public.transfer_requests(id),
  received_by         uuid NOT NULL REFERENCES auth.users(id),
  date_received       date NOT NULL DEFAULT CURRENT_DATE,
  condition_notes     text,
  has_variance        boolean NOT NULL DEFAULT false,
  acknowledged        boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grns_transfer_request_id ON public.grns(transfer_request_id);

-- ─────────────────────────────────────────────
-- TABLE: grn_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grn_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id            uuid NOT NULL REFERENCES public.grns(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES public.products(id),
  issued_quantity   integer NOT NULL,
  quantity_received integer NOT NULL CHECK (quantity_received >= 0),
  variance_notes    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grn_li_grn_id ON public.grn_line_items(grn_id);

-- ─────────────────────────────────────────────
-- TABLE: supplier_grns (Warehouse Manager records receipt from suppliers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_grns (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number          text NOT NULL UNIQUE,
  supplier_name             text NOT NULL,
  supplier_invoice_reference text,
  invoice_amount            numeric(12,2),
  received_by               uuid NOT NULL REFERENCES auth.users(id),
  date_received             date NOT NULL DEFAULT CURRENT_DATE,
  status                    text NOT NULL DEFAULT 'AWAITING_FINANCE_APPROVAL'
                              CHECK (status IN (
                                'AWAITING_FINANCE_APPROVAL','GRN_APPROVED','GRN_REJECTED'
                              )),
  approved_by               uuid REFERENCES auth.users(id),
  approved_at               timestamptz,
  approval_notes            text,
  sbu_id                    uuid REFERENCES public.sbus(id),
  warehouse_id              uuid,  -- nullable for v1
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLE: supplier_grn_line_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_grn_line_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_grn_id     uuid NOT NULL REFERENCES public.supplier_grns(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES public.products(id),
  quantity_received   integer NOT NULL CHECK (quantity_received > 0),
  unit_cost           numeric(12,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLE: notifications
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id),      -- specific user; NULL means role-broadcast
  user_role         text,                                  -- role broadcast if user_id is null
  type              text NOT NULL,
  message           text NOT NULL,
  related_entity_id uuid,
  is_read           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_role ON public.notifications(user_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON public.notifications(is_read);
COMMENT ON TABLE public.notifications IS 'In-app and email notification records. Cannot be deleted.';

-- ─────────────────────────────────────────────
-- TABLE: audit_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id),
  entity_type    text NOT NULL,
  entity_id      text,
  action         text NOT NULL,
  performed_by   uuid REFERENCES auth.users(id),
  previous_value jsonb,
  new_value      jsonb,
  details        jsonb,
  ip_address     inet,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON public.audit_logs(created_at);
COMMENT ON TABLE public.audit_logs IS 'Immutable audit log; records must never be deleted or updated.';

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (stubs — full policies applied in separate migration)
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbus                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issuances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issuance_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_grns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_grn_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- Allow service-role full access (service role key bypasses RLS automatically in Supabase)
-- Client-facing policies are additive; the service role key always bypasses them.

COMMIT;
