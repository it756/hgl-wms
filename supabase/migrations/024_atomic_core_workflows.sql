-- Migration: 024_atomic_core_workflows.sql
-- Purpose: Move multi-step inventory workflows behind transaction-safe RPCs.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Transfer request create: header + line items in one transaction.
-- Reference format remains API-generated in this phase.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_transfer_request_atomic(
  p_actor_id            uuid,
  p_reference_number    text,
  p_requesting_unit_id  uuid,
  p_required_date       date,
  p_notes               text,
  p_estimated_value     numeric,
  p_lines               jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       RECORD;
  v_unit        RECORD;
  v_line        RECORD;
  v_product     RECORD;
  v_transfer_id uuid;
  v_status      text;
BEGIN
  IF p_reference_number IS NULL OR btrim(p_reference_number) = '' THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: reference_number is required';
  END IF;

  IF p_requesting_unit_id IS NULL THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: requesting_unit_id is required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: at least one line item is required';
  END IF;

  SELECT id, role, sbu_id, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: active actor profile not found';
  END IF;

  IF v_actor.role NOT IN ('BU_MANAGER', 'UNIT_STAFF') THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: forbidden role %', v_actor.role;
  END IF;

  IF v_actor.sbu_id IS NULL THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: actor has no SBU assigned';
  END IF;

  SELECT id, sbu_id, is_active
    INTO v_unit
    FROM public.sbu_units
   WHERE id = p_requesting_unit_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: requesting unit not found';
  END IF;

  IF v_unit.sbu_id IS DISTINCT FROM v_actor.sbu_id THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: requesting unit does not belong to actor SBU';
  END IF;

  IF COALESCE(v_unit.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'create_transfer_request_atomic: requesting unit is inactive';
  END IF;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(product_id uuid, requested_quantity integer)
  LOOP
    IF v_line.product_id IS NULL OR v_line.requested_quantity IS NULL OR v_line.requested_quantity <= 0 THEN
      RAISE EXCEPTION 'create_transfer_request_atomic: each line needs product_id and requested_quantity > 0';
    END IF;

    SELECT id, name, stock_quantity
      INTO v_product
      FROM public.products
     WHERE id = v_line.product_id
     FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'create_transfer_request_atomic: product not found %', v_line.product_id;
    END IF;

    IF v_product.stock_quantity < v_line.requested_quantity THEN
      RAISE EXCEPTION 'create_transfer_request_atomic: insufficient stock for "%": requested %, available %',
        v_product.name, v_line.requested_quantity, v_product.stock_quantity;
    END IF;
  END LOOP;

  v_status := CASE WHEN v_actor.role = 'UNIT_STAFF' THEN 'PENDING_BU_APPROVAL' ELSE 'PENDING_APPROVAL' END;

  INSERT INTO public.transfer_requests (
    reference_number,
    sbu_id,
    requesting_unit_id,
    raised_by,
    status,
    required_date,
    notes,
    estimated_value,
    requires_finance_approval,
    created_at,
    updated_at
  ) VALUES (
    p_reference_number,
    v_actor.sbu_id,
    p_requesting_unit_id,
    p_actor_id,
    v_status,
    p_required_date,
    p_notes,
    p_estimated_value,
    true,
    now(),
    now()
  )
  RETURNING id INTO v_transfer_id;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(product_id uuid, requested_quantity integer)
  LOOP
    INSERT INTO public.transfer_line_items (
      transfer_request_id,
      product_id,
      requested_quantity,
      created_at
    ) VALUES (
      v_transfer_id,
      v_line.product_id,
      v_line.requested_quantity,
      now()
    );
  END LOOP;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, new_value, created_at)
  VALUES (
    'transfer_request',
    v_transfer_id::text,
    'create',
    p_actor_id,
    jsonb_build_object('reference_number', p_reference_number, 'status', v_status),
    now()
  );

  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'reference_number', p_reference_number,
    'status', v_status,
    'sbu_id', v_actor.sbu_id,
    'requires_finance_approval', true
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SBU GRN submit: GRN + lines + transfer status + variance proposal in one tx.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_grn_atomic(
  p_actor_id             uuid,
  p_transfer_request_id  uuid,
  p_date_received        date,
  p_condition_notes      text,
  p_items                jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       RECORD;
  v_transfer    RECORD;
  v_item        RECORD;
  v_grn_id      uuid;
  v_has_variance boolean := false;
  v_status      text;
  v_line_id     uuid;
  v_delta       integer;
  v_proposal_id uuid;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'submit_grn_atomic: at least one line item is required';
  END IF;

  SELECT id, role, sbu_id, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'submit_grn_atomic: active actor profile not found';
  END IF;

  IF v_actor.role IS DISTINCT FROM 'UNIT_STAFF' THEN
    RAISE EXCEPTION 'submit_grn_atomic: forbidden role %', v_actor.role;
  END IF;

  SELECT *
    INTO v_transfer
    FROM public.transfer_requests
   WHERE id = p_transfer_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submit_grn_atomic: transfer request not found';
  END IF;

  IF v_transfer.status IS DISTINCT FROM 'ISSUED' THEN
    RAISE EXCEPTION 'submit_grn_atomic: transfer must be ISSUED (current: %)', v_transfer.status;
  END IF;

  IF v_actor.sbu_id IS DISTINCT FROM v_transfer.sbu_id THEN
    RAISE EXCEPTION 'submit_grn_atomic: actor SBU does not match transfer SBU';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, issued_quantity integer, quantity_received integer, variance_notes text)
  LOOP
    IF v_item.product_id IS NULL
       OR v_item.issued_quantity IS NULL
       OR v_item.quantity_received IS NULL
       OR v_item.issued_quantity < 0
       OR v_item.quantity_received < 0 THEN
      RAISE EXCEPTION 'submit_grn_atomic: each item needs product_id, issued_quantity >= 0, quantity_received >= 0';
    END IF;

    IF v_item.issued_quantity IS DISTINCT FROM v_item.quantity_received THEN
      v_has_variance := true;
    END IF;
  END LOOP;

  INSERT INTO public.grns (
    transfer_request_id,
    received_by,
    date_received,
    condition_notes,
    has_variance,
    acknowledged,
    created_at,
    updated_at
  ) VALUES (
    p_transfer_request_id,
    p_actor_id,
    COALESCE(p_date_received, CURRENT_DATE),
    p_condition_notes,
    v_has_variance,
    true,
    now(),
    now()
  )
  RETURNING id INTO v_grn_id;

  v_status := CASE WHEN v_has_variance THEN 'COMPLETED_WITH_VARIANCE' ELSE 'COMPLETED' END;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, issued_quantity integer, quantity_received integer, variance_notes text)
  LOOP
    INSERT INTO public.grn_line_items (
      grn_id,
      product_id,
      issued_quantity,
      quantity_received,
      variance_notes,
      created_at
    ) VALUES (
      v_grn_id,
      v_item.product_id,
      v_item.issued_quantity,
      v_item.quantity_received,
      v_item.variance_notes,
      now()
    )
    RETURNING id INTO v_line_id;

    v_delta := v_item.quantity_received - v_item.issued_quantity;

    IF v_delta <> 0 THEN
      IF v_proposal_id IS NULL THEN
        INSERT INTO public.variance_proposals (
          transfer_request_id,
          grn_id,
          proposed_by,
          proposal_notes,
          status,
          created_at,
          updated_at
        ) VALUES (
          p_transfer_request_id,
          v_grn_id,
          p_actor_id,
          COALESCE(p_condition_notes, 'Auto-raised from receipt - variance detected when staff confirmed quantities.'),
          'PENDING_FINANCE_REVIEW',
          now(),
          now()
        )
        RETURNING id INTO v_proposal_id;
      END IF;

      INSERT INTO public.variance_proposal_lines (
        proposal_id,
        grn_line_item_id,
        product_id,
        variance_quantity,
        recommended_resolution,
        created_at
      ) VALUES (
        v_proposal_id,
        v_line_id,
        v_item.product_id,
        v_delta,
        CASE WHEN v_delta < 0 THEN 'damage_writeoff' ELSE 'stock_reintegration' END,
        now()
      );
    END IF;
  END LOOP;

  UPDATE public.transfer_requests
     SET status = v_status,
         updated_at = now()
   WHERE id = p_transfer_request_id;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, new_value, created_at)
  VALUES (
    'grn',
    v_grn_id::text,
    'create',
    p_actor_id,
    jsonb_build_object(
      'transfer_request_id', p_transfer_request_id,
      'has_variance', v_has_variance,
      'status', v_status,
      'proposal_id', v_proposal_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'grn_id', v_grn_id,
    'status', v_status,
    'has_variance', v_has_variance,
    'proposal_id', v_proposal_id
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Return request create: header + line items in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_return_request_atomic(
  p_actor_id                      uuid,
  p_reference_number              text,
  p_original_transfer_request_id  uuid,
  p_reason                        text,
  p_notes                         text,
  p_items                         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     RECORD;
  v_transfer  RECORD;
  v_item      RECORD;
  v_return_id uuid;
BEGIN
  IF p_reference_number IS NULL OR btrim(p_reference_number) = '' THEN
    RAISE EXCEPTION 'create_return_request_atomic: reference_number is required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'create_return_request_atomic: reason is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'create_return_request_atomic: at least one line item is required';
  END IF;

  SELECT id, role, sbu_id, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'create_return_request_atomic: active actor profile not found';
  END IF;

  IF v_actor.role IS DISTINCT FROM 'UNIT_STAFF' THEN
    RAISE EXCEPTION 'create_return_request_atomic: forbidden role %', v_actor.role;
  END IF;

  IF v_actor.sbu_id IS NULL THEN
    RAISE EXCEPTION 'create_return_request_atomic: actor has no SBU assigned';
  END IF;

  IF p_original_transfer_request_id IS NOT NULL THEN
    SELECT id, sbu_id, status
      INTO v_transfer
      FROM public.transfer_requests
     WHERE id = p_original_transfer_request_id
     FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'create_return_request_atomic: transfer request not found';
    END IF;

    IF v_transfer.sbu_id IS DISTINCT FROM v_actor.sbu_id THEN
      RAISE EXCEPTION 'create_return_request_atomic: transfer does not belong to actor SBU';
    END IF;

    IF v_transfer.status NOT IN ('COMPLETED', 'COMPLETED_WITH_VARIANCE') THEN
      RAISE EXCEPTION 'create_return_request_atomic: returns can only be raised against completed transfers';
    END IF;
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_to_return integer)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity_to_return IS NULL OR v_item.quantity_to_return < 1 THEN
      RAISE EXCEPTION 'create_return_request_atomic: each item needs product_id and quantity_to_return >= 1';
    END IF;
  END LOOP;

  INSERT INTO public.return_requests (
    reference_number,
    original_transfer_request_id,
    sbu_id,
    raised_by,
    status,
    reason,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_reference_number,
    p_original_transfer_request_id,
    v_actor.sbu_id,
    p_actor_id,
    'PENDING_APPROVAL',
    btrim(p_reason),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    now(),
    now()
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_to_return integer)
  LOOP
    INSERT INTO public.return_line_items (
      return_request_id,
      product_id,
      quantity_to_return,
      created_at
    ) VALUES (
      v_return_id,
      v_item.product_id,
      v_item.quantity_to_return,
      now()
    );
  END LOOP;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, new_value, created_at)
  VALUES (
    'return_request',
    v_return_id::text,
    'create',
    p_actor_id,
    jsonb_build_object('reference_number', p_reference_number, 'status', 'PENDING_APPROVAL', 'sbu_id', v_actor.sbu_id),
    now()
  );

  RETURN jsonb_build_object('id', v_return_id, 'reference_number', p_reference_number, 'status', 'PENDING_APPROVAL');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Supplier GRN create/update and Finance decision.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_actor       RECORD;
  v_item        RECORD;
  v_grn_id      uuid;
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

CREATE OR REPLACE FUNCTION public.update_supplier_grn_atomic(
  p_grn_id                      uuid,
  p_actor_id                    uuid,
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
  v_actor  RECORD;
  v_grn    RECORD;
  v_item   RECORD;
BEGIN
  IF p_supplier_name IS NULL OR btrim(p_supplier_name) = '' THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: supplier_name is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: at least one line item is required';
  END IF;

  SELECT id, role, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: active actor profile not found';
  END IF;

  IF v_actor.role NOT IN ('WAREHOUSE_MANAGER', 'ADMIN') THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: forbidden role %', v_actor.role;
  END IF;

  SELECT id, status, reference_number
    INTO v_grn
    FROM public.supplier_grns
   WHERE id = p_grn_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: supplier GRN not found';
  END IF;

  IF v_grn.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: only GRNs awaiting Finance approval can be edited';
  END IF;

  IF p_sbu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sbus WHERE id = p_sbu_id) THEN
    RAISE EXCEPTION 'update_supplier_grn_atomic: SBU not found';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_received integer, unit_cost numeric, expiry_date date)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity_received IS NULL OR v_item.quantity_received < 1 THEN
      RAISE EXCEPTION 'update_supplier_grn_atomic: each item needs product_id and quantity_received > 0';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id) THEN
      RAISE EXCEPTION 'update_supplier_grn_atomic: product not found %', v_item.product_id;
    END IF;
  END LOOP;

  UPDATE public.supplier_grns
     SET supplier_name = btrim(p_supplier_name),
         supplier_invoice_reference = p_supplier_invoice_reference,
         invoice_amount = p_invoice_amount,
         date_received = COALESCE(p_date_received, date_received),
         sbu_id = p_sbu_id,
         updated_at = now()
   WHERE id = p_grn_id;

  DELETE FROM public.supplier_grn_line_items
   WHERE supplier_grn_id = p_grn_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity_received integer, unit_cost numeric, expiry_date date)
  LOOP
    INSERT INTO public.supplier_grn_line_items (
      supplier_grn_id,
      product_id,
      quantity_received,
      unit_cost,
      expiry_date,
      created_at
    ) VALUES (
      p_grn_id,
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
    p_grn_id::text,
    'update',
    p_actor_id,
    jsonb_build_object('supplier_name', p_supplier_name, 'item_count', jsonb_array_length(p_items)),
    now()
  );

  RETURN jsonb_build_object('id', p_grn_id, 'reference_number', v_grn.reference_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_supplier_grn_atomic(
  p_grn_id       uuid,
  p_actor_id     uuid,
  p_action       text,
  p_notes        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       RECORD;
  v_grn         RECORD;
  v_line        RECORD;
  v_new_status  text;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'decide_supplier_grn_atomic: action must be approve or reject';
  END IF;

  SELECT id, role, is_active
    INTO v_actor
    FROM public.profiles
   WHERE id = p_actor_id
   FOR SHARE;

  IF NOT FOUND OR COALESCE(v_actor.is_active, false) IS FALSE THEN
    RAISE EXCEPTION 'decide_supplier_grn_atomic: active actor profile not found';
  END IF;

  IF v_actor.role NOT IN ('FINANCE_MANAGER', 'ADMIN') THEN
    RAISE EXCEPTION 'decide_supplier_grn_atomic: forbidden role %', v_actor.role;
  END IF;

  SELECT *
    INTO v_grn
    FROM public.supplier_grns
   WHERE id = p_grn_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'decide_supplier_grn_atomic: supplier GRN not found';
  END IF;

  IF v_grn.status IS DISTINCT FROM 'AWAITING_FINANCE_APPROVAL' THEN
    RAISE EXCEPTION 'decide_supplier_grn_atomic: supplier GRN is not awaiting approval (current: %)', v_grn.status;
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'GRN_APPROVED' ELSE 'GRN_REJECTED' END;

  IF p_action = 'approve' THEN
    FOR v_line IN
      SELECT * FROM public.supplier_grn_line_items
       WHERE supplier_grn_id = p_grn_id
    LOOP
      PERFORM 1
        FROM public.products
       WHERE id = v_line.product_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'decide_supplier_grn_atomic: product not found %', v_line.product_id;
      END IF;

      UPDATE public.products
         SET stock_quantity = stock_quantity + v_line.quantity_received,
             updated_at = now()
       WHERE id = v_line.product_id;
    END LOOP;
  END IF;

  UPDATE public.supplier_grns
     SET status = v_new_status,
         approved_by = p_actor_id,
         approved_at = now(),
         approval_notes = p_notes,
         updated_at = now()
   WHERE id = p_grn_id;

  INSERT INTO public.audit_logs(entity_type, entity_id, action, performed_by, new_value, created_at)
  VALUES (
    'supplier_grn',
    p_grn_id::text,
    'finance_' || p_action,
    p_actor_id,
    jsonb_build_object('status', v_new_status, 'notes', p_notes),
    now()
  );

  RETURN jsonb_build_object('id', p_grn_id, 'reference_number', v_grn.reference_number, 'status', v_new_status);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Expiry write-off: stock decrement + expiry ledger in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_actor       RECORD;
  v_product     RECORD;
  v_unit_cost   numeric;
  v_ledger_id   uuid;
  v_new_stock   integer;
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

  SELECT id, name, sku, stock_quantity, unit_cost
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: product not found';
  END IF;

  IF v_product.stock_quantity < p_quantity_expired THEN
    RAISE EXCEPTION 'expire_product_batch_atomic: insufficient stock (available: %, requested: %)',
      v_product.stock_quantity, p_quantity_expired;
  END IF;

  v_unit_cost := COALESCE(p_unit_cost, v_product.unit_cost, 0);
  v_new_stock := v_product.stock_quantity - p_quantity_expired;

  UPDATE public.products
     SET stock_quantity = v_new_stock,
         updated_at = now()
   WHERE id = p_product_id;

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
    p_expiry_date,
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
    jsonb_build_object('stock_quantity', v_product.stock_quantity),
    jsonb_build_object(
      'reference_number', p_reference_number,
      'product_id', p_product_id,
      'quantity_expired', p_quantity_expired,
      'stock_quantity', v_new_stock,
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

REVOKE ALL ON FUNCTION public.create_transfer_request_atomic(uuid, text, uuid, date, text, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_grn_atomic(uuid, uuid, date, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_return_request_atomic(uuid, text, uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_supplier_grn_atomic(uuid, text, text, text, numeric, date, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_supplier_grn_atomic(uuid, uuid, text, text, numeric, date, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_supplier_grn_atomic(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_product_batch_atomic(uuid, uuid, text, integer, date, uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_transfer_request_atomic(uuid, text, uuid, date, text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_grn_atomic(uuid, uuid, date, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_return_request_atomic(uuid, text, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_supplier_grn_atomic(uuid, text, text, text, numeric, date, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_supplier_grn_atomic(uuid, uuid, text, text, numeric, date, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_supplier_grn_atomic(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_product_batch_atomic(uuid, uuid, text, integer, date, uuid, numeric, text) TO service_role;

COMMIT;
