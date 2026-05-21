-- Migration: Create atomic decrement_stock RPC
-- Requires: `products` table with `id UUID`, `current_stock_quantity integer`, `updated_at timestamptz`
-- Optional: `audit_logs` table for recording stock adjustments

BEGIN;

-- Create function that atomically decrements stock and rejects when insufficient
CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id uuid,
  p_decrement_by integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_qty integer;
BEGIN
  IF p_decrement_by < 0 THEN
    RAISE EXCEPTION 'decrement_stock: decrement must be non-negative';
  END IF;

  UPDATE products
  SET current_stock_quantity = current_stock_quantity - p_decrement_by,
      updated_at = now()
  WHERE id = p_product_id
    AND current_stock_quantity >= p_decrement_by
  RETURNING current_stock_quantity INTO new_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'decrement_stock: insufficient_stock';
  END IF;

  -- Optional: write an audit log if table exists
  BEGIN
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, previous_value, new_value, created_at)
    VALUES (
      NULL, -- caller should write user-specific audit entries at application layer when possible
      'decrement_stock',
      'product',
      p_product_id::text,
      NULL,
      json_build_object('current_stock_quantity', new_qty),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    -- audit_logs does not exist; skip audit insertion
    NULL;
  END;

  RETURN new_qty;
END;
$$;

COMMIT;
