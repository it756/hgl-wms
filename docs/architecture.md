# Architecture — hgl-wms

**See also:** [Data Models](./data-models.md) · [API Contracts](./api-contracts.md) · [Source Tree](./source-tree-analysis.md)

## Executive Summary

hgl-wms is a single Next.js 16 App Router monolith. UI pages and API routes ship in the same deploy; there is no separate client/server or gateway layer. Authentication is Supabase JWT bearer tokens; authorization is enforced per-route (not via middleware); business logic lives in `lib/services/*`; the database is Postgres via Supabase, with some multi-table transitions implemented as Postgres RPC functions rather than application code.

## Request flow (typical write operation)

```
Browser (page.tsx, "use client")
  → fetch("/api/...", { headers: { Authorization: `Bearer ${token}` } })
      (token read from localStorage per call site — no shared API client)
  → app/api/.../route.ts
      1. getUserFromAuthHeader(req)          [lib/supabaseServer.ts]
           → supabaseAdmin.auth.getUser(token)   (verifies JWT)
           → fetch profiles row (role, sbu_id, unit_id, license fields)
           → evaluateLicenseAccess()              [lib/licensePolicy.ts]
           → merged AppAuthResult (ok / UNAUTHENTICATED / license-denied)
      2. inline role check against user.user_metadata.role
           (lib/rbac.ts helpers exist but are NOT used here — dead code)
      3. inline request validation
      4. delegate to lib/services/*Service.ts
           → supabaseAdmin.from(...) / supabaseAdmin.rpc(...)
           → auditService.writeAuditLog(...)      (best-effort, never throws)
           → notificationService.createNotification(...)
               → lib/notifications/channels.ts → email / whatsapp
      5. NextResponse.json(data | { error }, { status })
  ← 401 handled globally client-side by components/AuthGuard.tsx
      (monkey-patches window.fetch, clears localStorage + redirects on 401)
```

## Auth & Authorization

- **Auth**: Supabase Auth. Client (`lib/supabaseClient.ts`, anon key) signs in and holds the session; the JWT is sent as `Authorization: Bearer <token>` on every API call, read from `localStorage.getItem("access_token")` at each call site (not centralized).
- **Server verification**: `lib/supabaseServer.ts` (`supabaseAdmin`, service-role key, bypasses RLS) — `getUserFromAuthHeader()` is the single chokepoint: verifies the JWT, loads the `profiles` row, runs license-access evaluation, and returns a discriminated result routes branch on.
- **Authorization**: **Not centralized.** No `middleware.ts` exists. Every route handler inline-compares `user.user_metadata.role` against an allowed-roles array, then further scopes queries by `sbu_id`/`unit_id` looked up server-side (never trusting client-supplied scoping). `lib/rbac.ts` (`hasRole`, `hasAnyRole`, `isAdmin`, etc.) is defined but unused outside its own unit test — a known inconsistency worth fixing before this pattern spreads further.
- **External actors**: `app/api/external/procurement/[token]/*` lets non-WMS-user partners (procurement contacts) act via a single-use, hashed, expiring token (`lib/services/externalTokenService.ts`) delivered by email — a separate, parallel auth path from Supabase sessions.

## Data & stock-movement architecture

Multi-table, invariant-sensitive transitions (stock decrement/increment, issuance processing, variance disposition, intra-warehouse transfer) are implemented as **Postgres RPC functions** (`SECURITY DEFINER`, row-locking `FOR UPDATE`) rather than in `lib/services/*` — e.g. `issuanceService.processIssuance` is a thin wrapper that just calls `supabaseAdmin.rpc("process_issuance", ...)`. This keeps concurrency-sensitive stock math atomic in the database rather than relying on application-level locking. See [Data Models](./data-models.md) for the full entity/RPC/RLS picture.

RLS is enabled across tables but is defense-in-depth, not the primary access control — the app always connects via the service-role key, which bypasses RLS; the real gate is the per-route role check described above.

## Notification architecture

`notificationService.createNotification` always persists an in-app row; `dispatchChannels: true` additionally fans out through `lib/notifications/channels.ts` to email (Nodemailer, retry/backoff, dead-letter to `audit_logs`) and/or WhatsApp (Twilio, stub mode without credentials), each channel isolated so one failing never blocks another. `lib/workers/notificationWorker.ts` exists as a batch sender for unread notifications but **is not wired to any cron route or scheduler** in this repo — it needs an external trigger to run.

## UI architecture

Route-colocated: almost no shared component library (`components/` at repo root has only `AuthGuard.tsx`, `DashboardLayout.tsx`, `DamageWriteOffModal.tsx`, `DocumentUpload.tsx`). Every other page builds its own UI inline with Tailwind utility classes against the `@theme` design tokens in `app/globals.css`. Data fetching is `fetch()` directly in `"use client"` pages, repeating the token-attachment pattern ~36 times across the codebase rather than through a shared API client — a natural target for consolidation as the app grows.

## Testing architecture

Unit tests (`tests/unit/`) cover pure logic/services. Integration tests (`tests/integration/`) exercise route/service logic against an in-memory Supabase-shaped stub (`makeChain`) — no real DB or network calls. E2E (`tests/e2e/`) is a single Playwright smoke test. CI (`ci.yml`, `ui.yml`) runs lint/format/typecheck/unit+integration tests/build/e2e-smoke/OpenAPI-drift-check on every push; `promotion-guard.yml` enforces strict `dev → staging → QA → prod` branch promotion; `environment-gates.yml` is a placeholder for future deploy gating.

## Deployment

README states Railway, but no Dockerfile/railway config is committed — deployment is configured entirely outside this repo (Railway dashboard). `environment-gates.yml`'s placeholder steps confirm deploy automation isn't wired into CI yet.

## Known architectural inconsistencies worth knowing before you touch this code

1. **`lib/rbac.ts` is dead code** for the API layer — every route reimplements role checks inline instead of calling these helpers. Don't assume changing `rbac.ts` affects route behavior.
2. **Two overlapping variance mechanisms** exist (`variance_proposals` and the older `variance_dispositions`/`stock_losses` pair) — check which one a feature request actually means before extending either.
3. **No shared API client** — auth-header attachment is copy-pasted per page. A bug fix to token handling needs to be applied ~36 times unless refactored.
4. **`notificationWorker.ts` has no trigger** — if a feature assumes queued notifications get emailed on a schedule, that schedule doesn't exist yet.
