-- Migration: 043_unit_sales.sql
-- Purpose: Track goods sold out of a unit store (captured via CSV import from
--          an external POS export, there is no live POS integration) so that
--          BU Managers and Finance can see quantity issued vs. sold vs.
--          on-hand balance per unit/product. The app writes through
--          lib/supabaseServer.ts (service role), so RLS below only guards
--          direct client access — mirrors the convention in
--          027_rls_policies_for_gap_tables.sql / 035_product_price_history.sql.

BEGIN;

-- ─────────────────────────────────────────────
-- TABLE: sales_import_batches
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_import_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sbu_id       uuid REFERENCES public.sbus(id),
  unit_id      uuid REFERENCES public.sbu_units(id),
  file_name    text,
  row_count    integer NOT NULL DEFAULT 0,
  imported_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sales_import_batches IS
  'One row per CSV sales upload; unit_sales rows reference the batch that created them.';

-- ─────────────────────────────────────────────
-- TABLE: unit_sales
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid REFERENCES public.sales_import_batches(id) ON DELETE SET NULL,
  unit_id         uuid NOT NULL REFERENCES public.sbu_units(id),
  sbu_id          uuid NOT NULL REFERENCES public.sbus(id),
  product_id      uuid NOT NULL REFERENCES public.products(id),
  quantity_sold   integer NOT NULL CHECK (quantity_sold > 0),
  unit_price      numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  sale_date       date NOT NULL,
  imported_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.unit_sales IS
  'Goods sold out of a unit store, imported from an external POS CSV export. '
  'unit_price is captured at time of sale so historical amounts stay accurate '
  'even if catalogue pricing changes later.';

CREATE INDEX IF NOT EXISTS idx_unit_sales_unit_product_date
  ON public.unit_sales(unit_id, product_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_unit_sales_sbu_date
  ON public.unit_sales(sbu_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_unit_sales_batch_id
  ON public.unit_sales(batch_id);

ALTER TABLE public.sales_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_sales ENABLE ROW LEVEL SECURITY;

-- Read: ADMIN/FINANCE_MANAGER/WAREHOUSE_MANAGER see all; BU_MANAGER/UNIT_STAFF
-- limited to their own SBU. Write: service role only (via /api/sales/import).
CREATE POLICY "sales_import_batches_select"
  ON public.sales_import_batches FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'FINANCE_MANAGER', 'WAREHOUSE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "unit_sales_select"
  ON public.unit_sales FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'FINANCE_MANAGER', 'WAREHOUSE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

COMMIT;
