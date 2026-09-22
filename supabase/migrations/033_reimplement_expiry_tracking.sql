-- Migration: 033_reimplement_expiry_tracking.sql
-- Purpose: Re-harden expiry tracking after supplier GRN approval and expiry write-off.
--   - Finance approval keeps products.expiry_date aligned with received batch expiry dates.
--   - Expiry write-off validates optional supplier GRN batch references and snapshots
--     expiry/cost details from the batch when not explicitly supplied.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_stock_after_grn(
  p_grn_id uuid,
  p_approved_by uuid,
  p_approval_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_grn RECORD;
  v_line RECORD;
BEGIN
  SELECT * INTO v_grn FROM public.supplier_grns WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'increment_stock_after_grn: supplier grn not found';
  END IF;

  IF v_grn.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'increment_stock_after_grn: grn not awaiting approval (%)', v_grn.status;
  END IF;

  UPDATE public.supplier_grns
  SET status = 'GRN_APPROVED',
      approved_by = p_approved_by,
      approved_at = now(),
      approval_notes = p_approval_notes,
      updated_at = now()
  WHERE id = p_grn_id;

  FOR v_line IN SELECT * FROM public.supplier_grn_line_items WHERE supplier_grn_id = p_grn_id LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity + v_line.quantity_received,
        expiry_date = CASE
          WHEN v_line.expiry_date IS NULL THEN expiry_date
          WHEN expiry_date IS NULL THEN v_line.expiry_date
          ELSE LEAST(expiry_date, v_line.expiry_date)
        END,
        updated_at = now()
    WHERE id = v_line.product_id;
  END LOOP;

  BEGIN
    INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, details, created_at)
    VALUES ('supplier_grn', p_grn_id, 'grn_approve_increment', p_approved_by, json_build_object('notes', p_approval_notes), now());
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN p_grn_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.expire_product_batch_atomic(
  p_product_id                 uuid,
  p_actor_id                   uuid,
  p_reference_number           text,
  p_quantity_expired           integer,
  p_expiry_date                date,
  p_supplier_grn_line_item_id  uuid,
  p_unit_cost                  numeric,
  p_notes                      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor                 RECORD;
  v_product               RECORD;
  v_batch_product_id      uuid;
  v_batch_quantity        integer;
  v_batch_unit_cost       numeric;
  v_batch_expiry_date     date;
  v_unit_cost             numeric;
  v_effective_expiry_date date;
  v_recomputed_expiry     date;
  v_ledger_id             uuid;
  v_new_stock             integer;
BEGIN
  IF p_reference_number IS NULL OR btrim(p_reference_number) = '' THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: reference_number is required';
  END IF;

  IF p_quantity_expired IS NULL OR p_quantity_expired <= 0 THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: quantity_expired must be positive';
  END IF;

  SELECT id, role, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: active actor profile not found';
  END IF;

  IF v_actor.role NOT IN ('WAREHOUSE_MANAGER', 'ADMIN') THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: forbidden role %', v_actor.role;
  END IF;

  SELECT id, name, sku, stock_quantity, unit_cost, expiry_date
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: product not found';
  END IF;

  IF p_supplier_grn_line_item_id IS NOT NULL THEN
    SELECT product_id, quantity_received, unit_cost, expiry_date
      INTO v_batch_product_id, v_batch_quantity, v_batch_unit_cost, v_batch_expiry_date
      FROM public.supplier_grn_line_items
     WHERE id = p_supplier_grn_line_item_id
     FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'expire_product_batch_atomic: supplier GRN line item not found';
    END IF;

    IF v_batch_product_id IS DISTINCT FROM p_product_id THEN
      RAISE EXCEPTION 'expire_product_batch_atomic: supplier GRN line item does not belong to product';
    END IF;

    IF p_quantity_expired > v_batch_quantity THEN
      RAISE EXCEPTION 'expire_product_batch_atomic: quantity_expired exceeds supplier GRN line quantity (%)',
        v_batch_quantity;
    END IF;
  END IF;

  IF v_product.stock_quantity < p_quantity_expired THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: insufficient stock (available: %, requested: %)',
      v_product.stock_quantity, p_quantity_expired;
  END IF;

  v_effective_expiry_date := COALESCE(p_expiry_date, v_batch_expiry_date);
  v_unit_cost := COALESCE(p_unit_cost, v_batch_unit_cost, v_product.unit_cost, 0);
  v_new_stock := v_product.stock_quantity - p_quantity_expired;

  UPDATE public.products
     SET stock_quantity = v_new_stock,
         updated_at = now()
   WHERE id = p_product_id;

  IF v_new_stock = 0 THEN
    UPDATE public.products
       SET expiry_date = NULL,
           updated_at = now()
     WHERE id = p_product_id;
  ELSIF p_supplier_grn_line_item_id IS NOT NULL
    AND p_quantity_expired >= v_batch_quantity
    AND v_product.expiry_date IS NOT DISTINCT FROM v_effective_expiry_date THEN
    SELECT MIN(sgli.expiry_date)
      INTO v_recomputed_expiry
      FROM public.supplier_grn_line_items sgli
      JOIN public.supplier_grns sgrn ON sgrn.id = sgli.supplier_grn_id
     WHERE sgli.product_id = p_product_id
       AND sgli.id <> p_supplier_grn_line_item_id
       AND sgli.expiry_date IS NOT NULL
       AND sgrn.status = 'GRN_APPROVED';

    UPDATE public.products
       SET expiry_date = v_recomputed_expiry,
           updated_at = now()
     WHERE id = p_product_id;
  END IF;

  INSERT INTO public.expiry_ledger (
    reference_number,
    product_id,
    supplier_grn_line_item_id,
    quantity_expired,
    expiry_date,
    unit_cost_at_expiry,
    value_expired,
    currency,
    expired_by,
    notes,
    created_at
  ) VALUES (
    p_reference_number,
    p_product_id,
    p_supplier_grn_line_item_id,
    p_quantity_expired,
    v_effective_expiry_date,
    v_unit_cost,
    p_quantity_expired * v_unit_cost,
    'ZMW',
    p_actor_id,
    p_notes,
    now()
  )
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, previous_value, new_value, created_at)
  VALUES (
    'expiry_ledger',
    v_ledger_id::text,
    'create',
    p_actor_id,
    jsonb_build_object('stock_quantity', v_product.stock_quantity, 'expiry_date', v_product.expiry_date),
    jsonb_build_object(
      'reference_number', p_reference_number,
      'product_id', p_product_id,
      'supplier_grn_line_item_id', p_supplier_grn_line_item_id,
      'quantity_expired', p_quantity_expired,
      'stock_quantity', v_new_stock,
      'expiry_date', v_effective_expiry_date,
      'unit_cost_at_expiry', v_unit_cost
    ),
    now()
  );

  RETURN jsonb_build_object(
    'expiry_ledger_id', v_ledger_id,
    'reference_number', p_reference_number,
    'quantity_expired', p_quantity_expired,
    'new_stock_quantity', v_new_stock,
    'product_name', v_product.name,
    'product_sku', v_product.sku
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_stock_after_grn(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_product_batch_atomic(uuid, uuid, text, integer, date, uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.increment_stock_after_grn(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_product_batch_atomic(uuid, uuid, text, integer, date, uuid, numeric, text) TO service_role;

COMMIT;