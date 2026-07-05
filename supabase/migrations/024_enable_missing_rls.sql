-- Migration: 024_enable_missing_rls.sql
-- Purpose: Close the RLS coverage gap. Several tables added across migrations
--          007, 005, 012, and 023 never received an
--          `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement, unlike their
--          siblings in 000_initial_schema.sql / 008 / 009 / 010 / 015 / 016 / 017.
--          This was an oversight, not an intentional exception — the app only
--          ever talks to Postgres via `supabaseAdmin` (the service role key,
--          see lib/supabaseServer.ts), which always bypasses RLS regardless of
--          whether it's enabled. Enabling it here is a zero-behavior-change,
--          defense-in-depth fix: if the anon/publishable key were ever used to
--          query these tables directly (e.g. via the REST API), they would
--          otherwise be fully readable/writable by anyone holding that key.
--
-- No CREATE POLICY statements are added, matching the existing stub pattern
-- used for most tables in 000_initial_schema.sql: RLS enabled + zero policies
-- means "deny all" for the anon/authenticated roles, while the service role
-- (used exclusively by the app) is unaffected. Bespoke policies can be added
-- later for any table that genuinely needs direct client-side access.

BEGIN;

ALTER TABLE public.sbu_units                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbu_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_line_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variance_dispositions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_losses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_action_tokens      ENABLE ROW LEVEL SECURITY;

COMMIT;
