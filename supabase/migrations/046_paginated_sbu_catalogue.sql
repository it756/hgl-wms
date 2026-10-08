BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Existing Supabase projects may already have pg_trgm in a different schema.
DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_products_active_name_search ON public.products USING gin (name %I.gin_trgm_ops) WHERE is_active = true',
    v_schema
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_products_active_sku_search ON public.products USING gin (sku %I.gin_trgm_ops) WHERE is_active = true',
    v_schema
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_active_catalogue_order
  ON public.products (name, id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_supplier_grns_approved_sbu
  ON public.supplier_grns (sbu_id, id) WHERE status = 'GRN_APPROVED';
CREATE INDEX IF NOT EXISTS idx_supplier_grn_lines_product_grn
  ON public.supplier_grn_line_items (product_id, supplier_grn_id);

-- Membership stays in the database; no product-ID list crosses the HTTP boundary.
CREATE OR REPLACE FUNCTION public.search_sbu_catalogue(
  p_sbu_id uuid,
  p_search text DEFAULT '',
  p_after_name text DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 51
)
RETURNS TABLE (
  id uuid,
  name text,
  sku text,
  uom text,
  unit_cost numeric,
  stock_quantity integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pattern text;
BEGIN
  IF p_sbu_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 101 THEN
    RAISE EXCEPTION 'Invalid catalogue scope or page size' USING ERRCODE = '22023';
  END IF;
  IF (p_after_name IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_search, '')) > 100 THEN
    RAISE EXCEPTION 'Catalogue search exceeds 100 characters' USING ERRCODE = '22023';
  END IF;

  -- Treat user-entered LIKE wildcards as literal name/SKU characters.
  v_pattern := '%' || replace(replace(replace(
    COALESCE(p_search, ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  RETURN QUERY
  SELECT p.id, p.name, p.sku, p.unit_of_measure, p.unit_cost, p.stock_quantity
  FROM public.products p
  WHERE p.is_active = true
    AND (p_search = '' OR p_search IS NULL
      OR p.name ILIKE v_pattern ESCAPE E'\\'
      OR p.sku ILIKE v_pattern ESCAPE E'\\')
    AND (p_after_id IS NULL OR (p.name, p.id) > (p_after_name, p_after_id))
    AND (
      EXISTS (
        SELECT 1 FROM public.sbu_stock ss
        WHERE ss.sbu_id = p_sbu_id AND ss.product_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.supplier_grn_line_items li
        JOIN public.supplier_grns g ON g.id = li.supplier_grn_id
        WHERE li.product_id = p.id AND g.sbu_id = p_sbu_id
          AND g.status = 'GRN_APPROVED'
      )
    )
  ORDER BY p.name, p.id
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_sbu_catalogue(uuid, text, text, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_sbu_catalogue(uuid, text, text, uuid, integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
