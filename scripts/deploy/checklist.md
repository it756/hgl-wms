# Deployment Checklist — Harvest WMS

Use this checklist before every production deployment to Railway.

---

## 1. Environment Variables

Verify all required vars are set in the Railway project settings:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `SMTP_FROM`
- [ ] `NODE_ENV=production`

---

## 2. Database Migrations

Run migrations in order against the production Supabase project:

- [ ] `000_initial_schema.sql` — full schema + RLS + seed data
- [ ] `001_decrement_stock.sql` — `decrement_stock` RPC
- [ ] `002_process_issuance.sql` — `process_issuance` RPC
- [ ] `003_increment_stock_after_grn.sql` — `increment_stock_after_grn` RPC
- [ ] `004_decrement_stock_batch.sql` — `decrement_stock_batch` RPC
- [ ] Verify `transfer_requests.status` CHECK includes all required values
- [ ] Verify `app_settings` has default rows (finance threshold, session timeout, low-stock flag)

Apply via CLI:

```bash
supabase db push --project-ref <project-ref>
```

---

## 3. Supabase Configuration

- [ ] RLS is enabled on all tables (verify in Supabase dashboard → Table Editor → RLS)
- [ ] Service role key has not been committed to source control
- [ ] Auth → Email templates customised if needed
- [ ] Auth → JWT expiry set appropriately (recommend 1 hour)
- [ ] Auth → Email confirmation disabled or configured for internal use

---

## 4. Build Verification

Run locally before pushing:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

All commands must exit with code 0.

---

## 5. Railway Deployment

- [ ] `railway up` or push to the linked branch (if auto-deploy is configured)
- [ ] Monitor build logs for errors
- [ ] Confirm the `start` command is `npm run start` (or `node .next/standalone/server.js` if standalone output is enabled)
- [ ] Set `PORT` if Railway does not inject it automatically

---

## 6. Post-Deploy Smoke Tests

### Auth

- [ ] `POST /api/auth/register` with ADMIN token → creates user
- [ ] Log in as the new user and receive a valid JWT

### Transfer Flow

- [ ] BU Manager creates transfer request (`POST /api/transfer-requests`) → reference number `TRF-YYYY-NNNNN`
- [ ] If value ≥ finance threshold → status is `PENDING_APPROVAL`; Finance Manager can approve
- [ ] WH Manager sees approved transfer in queue and can issue goods

### GRN Flow

- [ ] Unit Staff submits GRN for ISSUED transfer (`POST /api/grns`) → transfer transitions to COMPLETED or COMPLETED_WITH_VARIANCE
- [ ] Variance transfers appear in admin variance queue

### Supplier GRN Flow

- [ ] WH Manager creates supplier GRN (`POST /api/supplier-grns`) → status `AWAITING_FINANCE_APPROVAL`
- [ ] Finance Manager approves → stock updated via `increment_stock_after_grn` RPC

### Admin

- [ ] `/admin/users` — list and create users
- [ ] `/admin/products` — stock adjustment saves correctly
- [ ] `/admin/settings` — finance threshold update persists
- [ ] `/admin/exports` — CSV download returns valid data

---

## 7. Rollback Plan

If a deployment causes critical issues:

1. Revert to the previous Railway deployment via the Railway dashboard (Deployments → previous build → Re-deploy)
2. If a migration caused data issues, restore from Supabase automated backup (Project Settings → Backups)
3. **Do not** run migrations in reverse — create a new forward migration to correct the state
