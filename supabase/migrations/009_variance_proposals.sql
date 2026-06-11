-- Migration: 009_variance_proposals.sql
-- Purpose: Enhanced variance reconciliation workflow.
--   - Proposers (BU_MANAGER / WAREHOUSE_MANAGER / ADMIN) raise structured
--     resolution proposals with per-line recommended outcomes.
--   - Finance Manager reviews, optionally overrides per-line decisions, then
--     approves (executes atomically) or rejects.
--   - Approved damage lines are written to `damage_ledger` with full asset
--     write-off metadata; excess lines increment warehouse stock with a
--     product-level audit trail.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend transaction_documents CHECK constraint to accept 'variance_proposal'
-- ─────────────────────────────────────────────────────────────────────────────
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
    'variance_proposal'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLE: variance_proposals
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.variance_proposals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id  uuid        NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  grn_id               uuid        NOT NULL REFERENCES public.grns(id) ON DELETE CASCADE,
  proposed_by          uuid        NOT NULL REFERENCES auth.users(id),
  proposal_notes       text,
  status               text        NOT NULL DEFAULT 'PENDING_FINANCE_REVIEW'
                                   CHECK (status IN (
                                     'PENDING_FINANCE_REVIEW',
                                     'APPROVED',
                                     'REJECTED'
                                   )),
  reviewed_by          uuid        REFERENCES auth.users(id),
  reviewed_at          timestamptz,
  review_notes         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variance_proposals IS
  'Structured resolution proposals raised by BU Managers, Warehouse Managers, or Admins '
  'for COMPLETED_WITH_VARIANCE transfers. Each line carries a recommended outcome that '
  'the Finance Manager can override before approving.';

-- Only one active (pending) proposal per variance transfer at a time.
-- Resolved proposals (APPROVED/REJECTED) are retained for audit history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_variance_proposals_active_transfer
  ON public.variance_proposals (transfer_request_id)
  WHERE status = 'PENDING_FINANCE_REVIEW';

CREATE INDEX IF NOT EXISTS idx_variance_proposals_transfer
  ON public.variance_proposals (transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_variance_proposals_status
  ON public.variance_proposals (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLE: variance_proposal_lines
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.variance_proposal_lines (
  id                      uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id             uuid     NOT NULL REFERENCES public.variance_proposals(id) ON DELETE CASCADE,
  grn_line_item_id        uuid     NOT NULL REFERENCES public.grn_line_items(id) ON DELETE CASCADE,
  product_id              uuid     NOT NULL REFERENCES public.products(id),
  -- Signed delta: positive = excess received, negative = shortage
  variance_quantity       integer  NOT NULL,
  recommended_resolution  text     NOT NULL
                          CHECK (recommended_resolution IN ('damage_writeoff', 'stock_reintegration')),
  -- Finance Manager can override; NULL until the proposal is actioned
  finance_decision        text     CHECK (finance_decision IN ('damage_writeoff', 'stock_reintegration')),
  finance_decision_notes  text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variance_proposal_lines IS
  'One row per GRN line item in a variance proposal. '
  'variance_quantity is signed (positive = excess, negative = shortage). '
  'finance_decision overrides recommended_resolution when set by the Finance Manager.';

CREATE INDEX IF NOT EXISTS idx_variance_proposal_lines_proposal
  ON public.variance_proposal_lines (proposal_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLE: damage_ledger
--    Full asset write-off record for damage_writeoff resolutions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.damage_ledger (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_line_id      uuid          NOT NULL REFERENCES public.variance_proposal_lines(id),
  product_id            uuid          NOT NULL REFERENCES public.products(id),
  quantity              integer       NOT NULL CHECK (quantity > 0),
  -- Snapshot of products.unit_cost at the moment of write-off for historical accuracy
  unit_cost_at_writeoff numeric(12,2) NOT NULL DEFAULT 0,
  -- Computed value kept as a plain column (not GENERATED) for broad Postgres compatibility
  estimated_value       numeric(14,2) NOT NULL DEFAULT 0,
  currency              text          NOT NULL DEFAULT 'ZMW',
  writeoff_reason       text,
  -- Denormalised transfer reference for reporting without joins
  transfer_reference    text,
  written_off_by        uuid          REFERENCES auth.users(id),
  written_off_at        timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.damage_ledger IS
  'Immutable asset write-off ledger. One row per damage_writeoff variance proposal line. '
  'unit_cost_at_writeoff is snapshotted so historical valuations are accurate even if the '
  'product cost changes later.';

CREATE INDEX IF NOT EXISTS idx_damage_ledger_product
  ON public.damage_ledger (product_id);
CREATE INDEX IF NOT EXISTS idx_damage_ledger_written_off_at
  ON public.damage_ledger (written_off_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: execute_variance_resolution
--    Atomically executes all line decisions for an approved variance proposal.
--    Called only from the Finance approval API route.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_variance_resolution(
  p_proposal_id  uuid,
  p_reviewed_by  uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal       RECORD;
  v_transfer_ref   text;
  v_line           RECORD;
  v_decision       text;
  v_product        RECORD;
  v_stock_before   integer;
  v_stock_after    integer;
BEGIN
  -- Lock proposal row and assert it is still pending
  SELECT * INTO v_proposal
  FROM public.variance_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'execute_variance_resolution: proposal not found (id: %)', p_proposal_id;
  END IF;

  IF v_proposal.status IS DISTINCT FROM 'PENDING_FINANCE_REVIEW' THEN
    RAISE EXCEPTION 'execute_variance_resolution: proposal is not pending (status: %)', v_proposal.status;
  END IF;

  -- Fetch the transfer reference number for denormalisation
  SELECT reference_number INTO v_transfer_ref
  FROM public.transfer_requests
  WHERE id = v_proposal.transfer_request_id;

  -- ── Process each line ────────────────────────────────────────────────────
  FOR v_line IN
    SELECT * FROM public.variance_proposal_lines
    WHERE proposal_id = p_proposal_id
  LOOP
    -- Finance decision takes priority; fall back to proposer's recommendation
    v_decision := COALESCE(v_line.finance_decision, v_line.recommended_resolution);

    IF v_decision = 'damage_writeoff' THEN
      -- ── Damage write-off ─────────────────────────────────────────────────
      SELECT unit_cost INTO v_product
      FROM public.products
      WHERE id = v_line.product_id;

      INSERT INTO public.damage_ledger (
        proposal_line_id,
        product_id,
        quantity,
        unit_cost_at_writeoff,
        estimated_value,
        currency,
        writeoff_reason,
        transfer_reference,
        written_off_by,
        written_off_at
      ) VALUES (
        v_line.id,
        v_line.product_id,
        ABS(v_line.variance_quantity),
        COALESCE(v_product.unit_cost, 0),
        ABS(v_line.variance_quantity) * COALESCE(v_product.unit_cost, 0),
        'ZMW',
        COALESCE(v_line.finance_decision_notes, 'Variance write-off via Finance approval'),
        v_transfer_ref,
        p_reviewed_by,
        now()
      );

    ELSIF v_decision = 'stock_reintegration' AND v_line.variance_quantity > 0 THEN
      -- ── Stock reintegration (excess only) ────────────────────────────────
      -- Lock the product row and capture before-value
      SELECT stock_quantity INTO v_stock_before
      FROM public.products
      WHERE id = v_line.product_id
      FOR UPDATE;

      UPDATE public.products
      SET
        stock_quantity = stock_quantity + v_line.variance_quantity,
        updated_at     = now()
      WHERE id = v_line.product_id
      RETURNING stock_quantity INTO v_stock_after;

      -- Product-level audit trail (mirrors decrement_stock pattern)
      INSERT INTO public.audit_logs (
        entity_type,
        entity_id,
        action,
        performed_by,
        previous_value,
        new_value,
        details,
        created_at
      ) VALUES (
        'product',
        v_line.product_id::text,
        'variance_reintegration',
        p_reviewed_by,
        json_build_object('stock_quantity', v_stock_before),
        json_build_object('stock_quantity', v_stock_after),
        json_build_object(
          'proposal_id',       p_proposal_id,
          'transfer_reference', v_transfer_ref,
          'grn_line_item_id',  v_line.grn_line_item_id
        ),
        now()
      );
    END IF;
    -- Lines with stock_reintegration but variance_quantity <= 0 are skipped silently;
    -- the API layer validates this before calling the RPC.
  END LOOP;

  -- ── Mark proposal approved ───────────────────────────────────────────────
  UPDATE public.variance_proposals
  SET
    status      = 'APPROVED',
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    updated_at  = now()
  WHERE id = p_proposal_id;

  -- ── Close the parent transfer ─────────────────────────────────────────────
  UPDATE public.transfer_requests
  SET
    status     = 'COMPLETED',
    updated_at = now()
  WHERE id = v_proposal.transfer_request_id;

  -- ── Proposal-level audit entry ────────────────────────────────────────────
  INSERT INTO public.audit_logs (
    entity_type,
    entity_id,
    action,
    performed_by,
    details,
    created_at
  ) VALUES (
    'variance_proposal',
    p_proposal_id::text,
    'variance_proposal_approved',
    p_reviewed_by,
    json_build_object('transfer_reference', v_transfer_ref),
    now()
  );

  RETURN p_proposal_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.variance_proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variance_proposal_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_ledger            ENABLE ROW LEVEL SECURITY;

-- variance_proposals: global roles see all; BU_MANAGER sees only their SBU
CREATE POLICY "variance_proposals_select"
  ON public.variance_proposals FOR SELECT TO authenticated
  USING (
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'BU_MANAGER'
      AND (
        SELECT sbu_id FROM public.transfer_requests WHERE id = transfer_request_id
      ) = (
        SELECT sbu_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "variance_proposals_insert"
  ON public.variance_proposals FOR INSERT TO authenticated
  WITH CHECK (
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('ADMIN', 'WAREHOUSE_MANAGER', 'BU_MANAGER')
    AND proposed_by = auth.uid()
  );

-- variance_proposal_lines: mirrors parent proposal access
CREATE POLICY "variance_proposal_lines_select"
  ON public.variance_proposal_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.variance_proposals vp
      WHERE vp.id = proposal_id
    )
  );

CREATE POLICY "variance_proposal_lines_insert"
  ON public.variance_proposal_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.variance_proposals vp
      WHERE vp.id = proposal_id
        AND vp.proposed_by = auth.uid()
    )
  );

-- damage_ledger: readable by global roles only; all writes go through RPC (SECURITY DEFINER)
CREATE POLICY "damage_ledger_select"
  ON public.damage_ledger FOR SELECT TO authenticated
  USING (
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
  );

COMMIT;
