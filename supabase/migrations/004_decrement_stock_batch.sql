-- Migration: 004_decrement_stock_batch.sql
-- Atomic multi-line stock decrement. Called by process_issuance internally
-- but also exposed for direct use.
--
-- Usage:
--   SELECT decrement_stock_batch('[{"product_id":"<uuid>","decrement_by":5}, ...]'::json);

CREATE OR REPLACE FUNCTION decrement_stock_batch(p_items json)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item        json;
  v_product_id  uuid;
  v_decrement   integer;
  v_current     integer;
BEGIN
  FOR v_item IN SELECT * FROM json_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_decrement  := (v_item->>'decrement_by')::integer;

    -- Lock the row to serialise concurrent updates
    SELECT stock_quantity
      INTO v_current
      FROM products
     WHERE id = v_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF v_current < v_decrement THEN
      RAISE EXCEPTION
        'Insufficient stock for product %: have %, need %',
        v_product_id, v_current, v_decrement;
    END IF;

    UPDATE products
       SET stock_quantity = stock_quantity - v_decrement,
           updated_at     = now()
     WHERE id = v_product_id;
  END LOOP;
END;
$$;
