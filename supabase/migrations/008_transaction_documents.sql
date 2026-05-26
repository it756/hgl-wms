-- Transaction Documents
-- Stores metadata for files uploaded to Supabase Storage (bucket: hgl-wms)
-- tied to any stock movement transaction.

CREATE TABLE IF NOT EXISTS public.transaction_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT        NOT NULL
                               CHECK (transaction_type IN (
                                 'transfer_request',
                                 'issuance',
                                 'grn',
                                 'supplier_grn',
                                 'return_request'
                               )),
  transaction_id   UUID        NOT NULL,
  storage_path     TEXT        NOT NULL,  -- path inside the hgl-wms bucket
  file_name        TEXT        NOT NULL,  -- original filename shown in UI
  file_size        INTEGER,               -- bytes
  mime_type        TEXT        NOT NULL,
  document_label   TEXT,                  -- optional: "Invoice", "Delivery Note", etc.
  uploaded_by      UUID        REFERENCES auth.users (id) ON DELETE SET NULL,  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by parent transaction
CREATE INDEX idx_transaction_documents_lookup
  ON public.transaction_documents (transaction_type, transaction_id);

-- Prevent duplicate storage paths
CREATE UNIQUE INDEX idx_transaction_documents_path
  ON public.transaction_documents (storage_path);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;

-- Helper: returns true when p_user_id is allowed to read documents attached to
-- a given transaction.  Called from the SELECT policy below.
--
-- Global roles (WAREHOUSE_MANAGER, FINANCE_MANAGER, ADMIN) receive access to
-- all documents regardless of SBU, because those actors legitimately review
-- transactions across every business unit.
--
-- SBU-scoped roles (BU_MANAGER, UNIT_STAFF) may only read documents whose
-- parent transaction belongs to their own SBU, as resolved by joining the
-- relevant transaction table on transaction_type.
--
-- SECURITY DEFINER is required so the function can query the parent
-- transaction tables without being blocked by their own RLS policies.
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

  -- Global roles: cross-SBU visibility is intentional
  IF v_role IN ('WAREHOUSE_MANAGER', 'FINANCE_MANAGER', 'ADMIN') THEN
    RETURN true;
  END IF;

  -- SBU-scoped roles: resolve the parent transaction's SBU then compare
  CASE p_transaction_type
    WHEN 'transfer_request' THEN
      SELECT sbu_id INTO v_tx_sbu
        FROM public.transfer_requests
       WHERE id = p_transaction_id;

    WHEN 'issuance' THEN
      -- Issuances carry no direct sbu_id; join through their transfer request
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

    ELSE
      RETURN false;
  END CASE;

  RETURN (v_tx_sbu IS NOT NULL AND v_tx_sbu = v_user_sbu);
END;
$$;

-- Users may read a document when:
--   (a) they uploaded it themselves, OR
--   (b) they have role-based access to the parent transaction
-- This enforces defense-in-depth at the DB layer; the API layer continues to
-- apply its own RBAC checks on top.
CREATE POLICY "Authenticated users can view documents"
  ON public.transaction_documents
  FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_transaction_access(auth.uid(), transaction_type, transaction_id)
  );

-- Users can only insert rows they own
CREATE POLICY "Authenticated users can insert own documents"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Users can only delete their own rows; the API additionally enforces that
-- the parent transaction must be in an early (non-final) status
CREATE POLICY "Uploader can delete own documents"
  ON public.transaction_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- ─── Storage bucket policies (applied via Supabase dashboard / migrations) ────
-- These mirror the config.toml bucket definition for completeness.

-- Allow authenticated users to upload objects to hgl-wms
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hgl-wms',
  'hgl-wms',
  false,
  20971520, -- 20 MiB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated read (SELECT) on all objects in the bucket
CREATE POLICY "Authenticated users can read hgl-wms"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'hgl-wms');

-- Authenticated insert (upload) on objects in the bucket
CREATE POLICY "Authenticated users can upload to hgl-wms"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hgl-wms');

-- Users can only delete their own uploaded objects (matched via owner metadata)
CREATE POLICY "Uploader can delete own objects in hgl-wms"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hgl-wms'
    AND owner = auth.uid()
  );
