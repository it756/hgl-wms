-- Migration: 015_expiry_ledger.sql
-- Purpose: Track expired stock as a permanent loss ledger.
--   When a batch (or quantity) of a product is identified as expired, the
--   Warehouse Manager / Admin moves it to this ledger; product stock is
--   decremented and a financial loss snapshot is recorded.

BEGIN;

CREATE TABLE IF NOT EXISTS public.expiry_ledger (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number            text          NOT NULL UNIQUE,
  product_id                  uuid          NOT NULL REFERENCES public.products(id),
  -- Optional pointer to the originating supplier GRN line item (if traceable)
  supplier_grn_line_item_id   uuid          REFERENCES public.supplier_grn_line_items(id),
  quantity_expired            integer       NOT NULL CHECK (quantity_expired > 0),
  expiry_date                 date,
  -- Financial snapshot — locked at write-off time
  unit_cost_at_expiry         numeric(14,4),
  value_expired               numeric(14,4),
  currency                    text          NOT NULL DEFAULT 'ZMW',
  expired_by                  uuid          NOT NULL REFERENCES auth.users(id),
  expired_at                  timestamptz   NOT NULL DEFAULT now(),
  notes                       text,
  created_at                  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expiry_ledger IS
  'Immutable ledger of stock written off due to expiry. unit_cost_at_expiry and '
  'value_expired are snapshotted at the moment of write-off.';

CREATE INDEX IF NOT EXISTS idx_expiry_ledger_product       ON public.expiry_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_expiry_ledger_expiry_date   ON public.expiry_ledger(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiry_ledger_expired_at    ON public.expiry_ledger(expired_at);
CREATE INDEX IF NOT EXISTS idx_expiry_ledger_grn_line_item ON public.expiry_ledger(supplier_grn_line_item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — readable by ADMIN, WAREHOUSE_MANAGER, FINANCE_MANAGER
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.expiry_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expiry_ledger_select"
  ON public.expiry_ledger FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN (
      'ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'
    )
  );

CREATE POLICY "expiry_ledger_insert"
  ON public.expiry_ledger FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER')
  );

COMMIT;
