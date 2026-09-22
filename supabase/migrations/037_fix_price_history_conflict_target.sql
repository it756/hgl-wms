-- Migration: 037_fix_price_history_conflict_target.sql
-- Purpose: Repair product_price_history conflict inference used by increment_stock_after_grn.
--
-- Migration 035 created a partial unique index on supplier_grn_line_item_id, but
-- the RPC uses ON CONFLICT (supplier_grn_line_item_id). PostgreSQL cannot infer
-- that partial index without the matching predicate, producing 42P10 during
-- Supplier GRN Finance approval. A full unique index is valid here because
-- PostgreSQL unique indexes allow multiple NULL values.

BEGIN;

DROP INDEX IF EXISTS public.idx_pph_unique_grn_line;

CREATE UNIQUE INDEX idx_pph_unique_grn_line
  ON public.product_price_history(supplier_grn_line_item_id);

COMMIT;