-- Migration: 025_rls_policies_for_gap_tables.sql
-- Purpose: Add real RLS policies (mirroring the app's own RBAC / SBU-scoping
--          rules) for the tables that had RLS enabled with zero policies in
--          024_enable_missing_rls.sql. This ensures that if these tables are
--          ever queried directly with a user JWT (not just the service role
--          the app uses today via lib/supabaseServer.ts), access is correctly
--          scoped instead of blanket-denied — matching, not restricting,
--          current application behavior.
--
-- Convention: policies read role/sbu_id from `auth.jwt() -> 'user_metadata'`,
-- matching the pattern established in 010_damage_recalls.sql,
-- 015_expiry_ledger.sql, and 016_intra_warehouse_transfers.sql. The service
-- role always bypasses RLS, so none of this changes current app behavior —
-- these policies only take effect for direct client (authenticated JWT)
-- access, which the app does not currently use for data queries.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- sbu_units — read: global roles see all, BU_MANAGER/UNIT_STAFF see own SBU only.
-- Write: ADMIN, or BU_MANAGER for their own SBU (matches app/api/bu/units).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "sbu_units_select"
  ON public.sbu_units FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "sbu_units_insert"
  ON public.sbu_units FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
    OR (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'BU_MANAGER'
      AND sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
    )
  );

CREATE POLICY "sbu_units_update"
  ON public.sbu_units FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
    OR (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'BU_MANAGER'
      AND sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- app_settings — global config. Readable by any signed-in user (drives UI
-- behaviour for all roles); writable by ADMIN only (Section 6.5 Settings page).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "app_settings_select"
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "app_settings_insert"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN');

CREATE POLICY "app_settings_update"
  ON public.app_settings FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN');

-- ─────────────────────────────────────────────────────────────────────────────
-- sbu_settings — per-SBU finance-threshold override.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "sbu_settings_select"
  ON public.sbu_settings FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "sbu_settings_insert"
  ON public.sbu_settings FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN');

CREATE POLICY "sbu_settings_update"
  ON public.sbu_settings FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN');

-- ─────────────────────────────────────────────────────────────────────────────
-- return_requests — Unit Staff raise (own SBU); BU Manager approves (own SBU);
-- Warehouse Manager confirms receipt; Finance Manager credits stock; Admin all.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "return_requests_insert"
  ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('UNIT_STAFF', 'BU_MANAGER', 'ADMIN')
    AND raised_by = auth.uid()
    AND sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "return_requests_update"
  ON public.return_requests FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'BU_MANAGER'
      AND sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- return_line_items — mirrors parent return_requests access.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "return_line_items_select"
  ON public.return_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.return_requests rr
      WHERE rr.id = return_request_id
        AND (
          (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
          OR rr.sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
        )
    )
  );

CREATE POLICY "return_line_items_insert"
  ON public.return_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.return_requests rr
      WHERE rr.id = return_request_id
        AND rr.raised_by = auth.uid()
    )
  );

CREATE POLICY "return_line_items_update"
  ON public.return_line_items FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- variance_dispositions / stock_losses — legacy tables retired per spec
-- GAP-02 (BU Manager variance-disposition flow superseded by
-- variance_proposals). Read-only for global roles for historical audit
-- access; deliberately no INSERT/UPDATE policies since the app no longer
-- writes to these tables.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "variance_dispositions_select"
  ON public.variance_dispositions FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
  );

CREATE POLICY "stock_losses_select"
  ON public.stock_losses FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- purchase_requests — BU Manager raises (own SBU); Admin does internal
-- control; Warehouse/Finance need visibility (Expected Orders / oversight).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "purchase_requests_select"
  ON public.purchase_requests FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
    OR sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
  );

CREATE POLICY "purchase_requests_insert"
  ON public.purchase_requests FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('BU_MANAGER', 'ADMIN')
    AND created_by = auth.uid()
  );

CREATE POLICY "purchase_requests_update"
  ON public.purchase_requests FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
    OR (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'BU_MANAGER'
      AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- purchase_request_line_items — mirrors parent purchase_requests access.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "purchase_request_line_items_select"
  ON public.purchase_request_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_id
        AND (
          (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER')
          OR pr.sbu_id::text = (auth.jwt() -> 'user_metadata' ->> 'sbu_id')
        )
    )
  );

CREATE POLICY "purchase_request_line_items_insert"
  ON public.purchase_request_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_id
        AND pr.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- external_action_tokens — intentionally NO policies added.
-- Contains hashed single-use tokens for unauthenticated external actors
-- (procurement contacts). Must never be readable/writable by any
-- authenticated or anon role — only the service role (via
-- lib/services/externalTokenService.ts) should ever touch this table.
-- RLS enabled + zero policies = deny-all for authenticated/anon, which is the
-- correct, intentional posture here.
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;
