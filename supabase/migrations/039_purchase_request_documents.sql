BEGIN;

ALTER TABLE public.transaction_documents
  DROP CONSTRAINT IF EXISTS transaction_documents_transaction_type_check;

ALTER TABLE public.transaction_documents
  ADD CONSTRAINT transaction_documents_transaction_type_check
  CHECK (transaction_type IN (
    'transfer_request',
    'issuance',
    'grn',
    'supplier_grn',
    'return_request',
    'variance_proposal',
    'purchase_request'
  ));

CREATE OR REPLACE FUNCTION public.has_transaction_access(
  p_user_id          uuid,
  p_transaction_type text,
  p_transaction_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_user_sbu uuid;
  v_tx_sbu   uuid;
BEGIN
  SELECT role, sbu_id
    INTO v_role, v_user_sbu
    FROM public.profiles
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role IN ('WAREHOUSE_MANAGER', 'FINANCE_MANAGER', 'ADMIN') THEN
    RETURN true;
  END IF;

  CASE p_transaction_type
    WHEN 'transfer_request' THEN
      SELECT sbu_id INTO v_tx_sbu
        FROM public.transfer_requests
       WHERE id = p_transaction_id;

    WHEN 'issuance' THEN
      SELECT tr.sbu_id INTO v_tx_sbu
        FROM public.issuances i
        JOIN public.transfer_requests tr ON tr.id = i.transfer_request_id
       WHERE i.id = p_transaction_id;

    WHEN 'grn' THEN
      SELECT tr.sbu_id INTO v_tx_sbu
        FROM public.grns g
        JOIN public.transfer_requests tr ON tr.id = g.transfer_request_id
       WHERE g.id = p_transaction_id;

    WHEN 'supplier_grn' THEN
      SELECT sbu_id INTO v_tx_sbu
        FROM public.supplier_grns
       WHERE id = p_transaction_id;

    WHEN 'return_request' THEN
      SELECT sbu_id INTO v_tx_sbu
        FROM public.return_requests
       WHERE id = p_transaction_id;

    WHEN 'purchase_request' THEN
      SELECT sbu_id INTO v_tx_sbu
        FROM public.purchase_requests
       WHERE id = p_transaction_id;

    ELSE
      RETURN false;
  END CASE;

  RETURN (v_tx_sbu IS NOT NULL AND v_tx_sbu = v_user_sbu);
END;
$$;

COMMIT;