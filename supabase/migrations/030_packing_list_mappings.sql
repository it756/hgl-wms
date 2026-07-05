-- Migration: 030_packing_list_mappings.sql
-- Purpose: Stores per-supplier column-mapping rules for the packing-list CSV parser.
--          Each row maps one supplier's CSV header name to a canonical GRN field.
--
-- The packing-list converter uses these to deterministically parse a supplier's
-- CSV without LLM assistance for well-known suppliers.
--
-- Canonical GRN fields:
--   product_code, description, quantity, unit, batch_number, expiry_date, weight, notes
--
-- Rollback:
--   DROP TABLE IF EXISTS public.packing_list_mappings;

BEGIN;

CREATE TABLE IF NOT EXISTS public.packing_list_mappings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name       text NOT NULL,
  -- Unique per supplier so we can upsert by supplier_name
  UNIQUE (supplier_name),
  -- JSONB column: { "CSV Header": "canonical_field", ... }
  -- e.g. { "Item Code": "product_code", "Qty": "quantity", "Exp Date": "expiry_date" }
  column_map          jsonb NOT NULL DEFAULT '{}',
  created_by          uuid REFERENCES auth.users(id),
  updated_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packing_list_mappings_supplier
  ON public.packing_list_mappings(supplier_name);

COMMENT ON TABLE public.packing_list_mappings IS
  'Per-supplier column mapping rules for the packing-list CSV parser. '
  'column_map is a JSON object: { "CSV Header": "canonical_grn_field" }.';

-- RLS: admins and warehouse managers can manage mappings
ALTER TABLE public.packing_list_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packing_list_mappings_select"
  ON public.packing_list_mappings FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN (
      'ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'
    )
  );

CREATE POLICY "packing_list_mappings_write"
  ON public.packing_list_mappings FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER')
  );

COMMIT;
