DO $$
DECLARE
  v_sbu uuid := '11111111-1111-1111-1111-111111111111';
  v_after_name text := NULL;
  v_after_id uuid := NULL;
  v_row record;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_page_count integer;
  v_zero_stock integer := 0;
BEGIN
  LOOP
    v_page_count := 0;
    FOR v_row IN SELECT * FROM public.search_sbu_catalogue(
      v_sbu, 'lace', v_after_name, v_after_id, 50
    ) LOOP
      IF v_row.id = ANY(v_ids) THEN RAISE EXCEPTION 'Duplicate page item'; END IF;
      v_ids := array_append(v_ids, v_row.id);
      v_zero_stock := v_zero_stock + CASE WHEN v_row.stock_quantity = 0 THEN 1 ELSE 0 END;
      v_after_name := v_row.name;
      v_after_id := v_row.id;
      v_page_count := v_page_count + 1;
    END LOOP;
    EXIT WHEN v_page_count < 50;
  END LOOP;
  IF cardinality(v_ids) <> 1204 THEN RAISE EXCEPTION 'Expected 1204 lace products, got %', cardinality(v_ids); END IF;
  IF v_zero_stock <> 602 THEN RAISE EXCEPTION 'Zero stock products were lost'; END IF;

  IF (SELECT count(*) FROM public.search_sbu_catalogue(v_sbu, '%_', NULL, NULL, 50)) <> 1 THEN
    RAISE EXCEPTION 'Wildcard search was not literal';
  END IF;
  IF (SELECT count(*) FROM public.search_sbu_catalogue(v_sbu, 'ejbl-1203', NULL, NULL, 50)) <> 1 THEN
    RAISE EXCEPTION 'Case-insensitive SKU search failed';
  END IF;
  IF (SELECT count(*) FROM public.search_sbu_catalogue(v_sbu, 'GRN product', NULL, NULL, 50)) <> 1 THEN
    RAISE EXCEPTION 'GRN membership, status filtering, or deduplication failed';
  END IF;
  IF (SELECT count(*) FROM public.search_sbu_catalogue(v_sbu, 'Transferred', NULL, NULL, 50)) <> 1 THEN
    RAISE EXCEPTION 'Stock membership was lost';
  END IF;
  IF EXISTS (SELECT 1 FROM public.search_sbu_catalogue(v_sbu, 'Other SBU', NULL, NULL, 50)) THEN
    RAISE EXCEPTION 'Cross-SBU products leaked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.search_sbu_catalogue(v_sbu, 'Inactive', NULL, NULL, 50)) THEN
    RAISE EXCEPTION 'Inactive product was included';
  END IF;
  IF (SELECT count(*) FROM public.search_sbu_catalogue(v_sbu, '', NULL, NULL, 51)) <> 51 THEN
    RAISE EXCEPTION 'Lookahead page was not bounded';
  END IF;
  BEGIN
    PERFORM * FROM public.search_sbu_catalogue(v_sbu, '', NULL, NULL, 102);
    RAISE EXCEPTION 'Invalid limit accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.search_sbu_catalogue(v_sbu, '', 'Lace', NULL, 50);
    RAISE EXCEPTION 'Partial cursor accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF has_function_privilege('authenticated', 'public.search_sbu_catalogue(uuid,text,text,uuid,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.search_sbu_catalogue(uuid,text,text,uuid,integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.search_sbu_catalogue(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC execution grants are incorrect';
  END IF;
  RAISE NOTICE 'Catalogue SQL assertions passed: >1200 rows, stable cursors, membership, search, limits, grants';
END;
$$;
