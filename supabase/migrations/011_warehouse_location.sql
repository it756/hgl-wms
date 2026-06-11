-- Migration 011: Add warehouse_location to products
-- Tracks the physical bin/area label (format: [A-Z][1-2]) where each product is stored.
-- e.g. A1, B2, Z1 — one product maps to exactly one fixed location.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS warehouse_location text NOT NULL DEFAULT 'A1'
    CHECK (warehouse_location ~ '^[A-Z][12]$');

COMMENT ON COLUMN public.products.warehouse_location IS
  'Physical warehouse area label in format [A-Z][1-2] (e.g. A1, B2). '
  'Existing products default to A1 — reassign via admin catalogue.';
