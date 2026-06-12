-- Migration: 013_expiry_dates.sql
-- Purpose: Track product/batch expiry dates and enable WhatsApp notification routing.
--   - expiry_date on supplier_grn_line_items captures the batch-level expiry recorded
--     when the Warehouse Manager logs a Supplier GRN.
--   - expiry_date on products is a nullable convenience field (can hold the nearest
--     batch expiry; populated by application code if desired).
--   - whatsapp_number on profiles enables per-user WhatsApp delivery via the
--     channels abstraction (lib/notifications/whatsapp.ts).

BEGIN;

ALTER TABLE public.supplier_grn_line_items
  ADD COLUMN IF NOT EXISTS expiry_date date;

COMMENT ON COLUMN public.supplier_grn_line_items.expiry_date IS
  'Optional batch expiry date for goods received from a supplier. Captured at GRN time.';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS expiry_date date;

COMMENT ON COLUMN public.products.expiry_date IS
  'Optional nearest-batch expiry date for the product (nullable). For multi-batch tracking '
  'see supplier_grn_line_items.expiry_date.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.profiles.whatsapp_number IS
  'E.164-formatted WhatsApp number (e.g. +260977000000) used by the notification '
  'channels layer when WhatsApp delivery is enabled.';

COMMIT;
