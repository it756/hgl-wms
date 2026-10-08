-- Minimal membership fixture, only for an isolated, disposable test database.
CREATE TABLE public.sbus (id uuid PRIMARY KEY, code text NOT NULL);
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  sku text NOT NULL,
  unit_of_measure text NOT NULL DEFAULT 'unit',
  unit_cost numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.supplier_grns (id uuid PRIMARY KEY, sbu_id uuid, status text);
CREATE TABLE public.supplier_grn_line_items (product_id uuid, supplier_grn_id uuid);
CREATE TABLE public.stock_membership (sbu_id uuid, product_id uuid);
CREATE VIEW public.sbu_stock AS
  SELECT s.id AS sbu_id, p.id AS product_id
  FROM public.sbus s JOIN public.products p ON p.sku LIKE (s.code || '-%')
  WHERE p.is_active
  UNION
  SELECT sbu_id, product_id FROM public.stock_membership;

INSERT INTO public.sbus VALUES
  ('11111111-1111-1111-1111-111111111111', 'EJBL'),
  ('22222222-2222-2222-2222-222222222222', 'OTHER');
INSERT INTO public.products (id, name, sku, stock_quantity)
SELECT ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'Lace', 'EJBL-' || n, n % 2
FROM generate_series(1, 1203) n;
INSERT INTO public.products (id, name, sku, stock_quantity, is_active) VALUES
  ('33333333-3333-3333-3333-333333333331', 'Approved GRN product', 'SHARED-1', 0, true),
  ('33333333-3333-3333-3333-333333333332', 'Transferred product', 'SHARED-2', 10, true),
  ('33333333-3333-3333-3333-333333333333', 'Other SBU product', 'OTHER-1', 9, true),
  ('33333333-3333-3333-3333-333333333334', 'Inactive', 'EJBL-inactive', 9, false),
  ('33333333-3333-3333-3333-333333333335', 'Pending GRN product', 'SHARED-3', 0, true),
  ('33333333-3333-3333-3333-333333333336', 'Rejected GRN product', 'SHARED-4', 0, true),
  ('33333333-3333-3333-3333-333333333337', 'Literal 50%_lace', 'EJBL-special', 0, true);
INSERT INTO public.supplier_grns VALUES
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'GRN_APPROVED'),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', 'AWAITING_FINANCE_APPROVAL'),
  ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', 'GRN_REJECTED'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'GRN_APPROVED');
INSERT INTO public.supplier_grn_line_items VALUES
  ('33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444441'),
  ('33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444441'),
  ('33333333-3333-3333-3333-333333333335', '44444444-4444-4444-4444-444444444442'),
  ('33333333-3333-3333-3333-333333333336', '44444444-4444-4444-4444-444444444443'),
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
INSERT INTO public.stock_membership VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333332');
