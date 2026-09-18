-- Migration: 034_repair_create_supplier_grn_atomic.sql
-- Purpose: Repair environments where migration 024 is recorded as applied but
--          public.create_supplier_grn_atomic is missing from the database or
--          PostgREST schema cache.

BEGIN;

ALTER TABLE public.supplier_grn_line_items
  ADD COLUMN IF NOT EXISTS expiry_date date;

CREATE OR REPLACE FUNCTION public.create_supplier_grn_atomic(
  p_actor_id                    uuid,
  p_reference_number            text,
  p_supplier_name               text,
  p_supplier_invoice_reference  text,
  p_invoice_amount              numeric,
  p_date_received               date,
  p_sbu_id                      uuid,
  p_items                       jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        RECORD;
  v_item         RECORD;
  v_grn_id       uuid;
  v_has_variance boolean := false;
BEGIN
  IF p_reference_number IS NULL OR btrim(p_reference_number) = '' THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: reference_number is required';
  END IF;

  IF p_supplier_name IS NULL OR btrim(p_supplier_name) = '' THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: supplier_name is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: at least one line item is required';
  END IF;

  SELECT id, role, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: active actor profile not found';
  END IF;

  IF v_actor.role NOT IN ('WAREHOUSE_MANAGER', 'ADMIN') THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: forbidden role %', v_actor.role;
  END IF;

  IF p_sbu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sbus WHERE id = p_sbu_id) THEN
    RAISE EXCEPTION 'create_supplier_grn_atomic: SBU not found';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_received integer, quantity_expected integer, unit_cost numeric, expiry_date date)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity_received IS NULL OR v_item.quantity_received < 1 THEN
      RAISE EXCEPTION 'create_supplier_grn_atomic: each item needs product_id and quantity_received > 0';
    END IF;

    IF v_item.quantity_expected IS NOT NULL AND v_item.quantity_expected IS DISTINCT FROM v_item.quantity_received THEN
      v_has_variance := true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id) THEN
      RAISE EXCEPTION 'create_supplier_grn_atomic: product not found %', v_item.product_id;
    END IF;
  END LOOP;

  INSERT INTO public.supplier_grns (
    reference_number,
    supplier_name,
    supplier_invoice_reference,
    invoice_amount,
    received_by,
    date_received,
    status,
    sbu_id,
    created_at,
    updated_at
  ) VALUES (
    p_reference_number,
    btrim(p_supplier_name),
    p_supplier_invoice_reference,
    p_invoice_amount,
    p_actor_id,
    COALESCE(p_date_received, CURRENT_DATE),
    'AWAITING_FINANCE_APPROVAL',
    p_sbu_id,
    now(),
    now()
  )
  RETURNING id INTO v_grn_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_received integer, quantity_expected integer, unit_cost numeric, expiry_date date)
  LOOP
    INSERT INTO public.supplier_grn_line_items (
      supplier_grn_id,
      product_id,
      quantity_received,
      unit_cost,
      expiry_date,
      created_at
    ) VALUES (
      v_grn_id,
      v_item.product_id,
      v_item.quantity_received,
      v_item.unit_cost,
      v_item.expiry_date,
      now()
    );
  END LOOP;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, new_value, created_at)
  VALUES (
    'supplier_grn',
    v_grn_id::text,
    'create',
    p_actor_id,
    jsonb_build_object(
      'reference_number', p_reference_number,
      'status', 'AWAITING_FINANCE_APPROVAL',
      'supplier_name', p_supplier_name,
      'has_packing_variance', v_has_variance
    ),
    now()
  );

  RETURN jsonb_build_object(
    'id', v_grn_id,
    'reference_number', p_reference_number,
    'has_packing_variance', v_has_variance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_supplier_grn_atomic(uuid, text, text, text, numeric, date, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_supplier_grn_atomic(uuid, text, text, text, numeric, date, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;