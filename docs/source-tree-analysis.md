# Source Tree Analysis — hgl-wms

```
hgl-wms/
├── app/                          Next.js App Router — pages AND API routes
│   ├── page.tsx                  Login page; routes post-login by role (routeForRole())
│   ├── layout.tsx                Root layout — fonts, AuthGuard, globals.css
│   ├── globals.css               Tailwind v4 @theme design tokens (MD3-style)
│   │
│   ├── api/                      REST API routes (61 route.ts files)
│   │   ├── admin/                Privileged CRUD: users, SBUs, products, licenses,
│   │   │                         damage/expiry ledgers, variance, settings (ADMIN-gated)
│   │   ├── audit/                Read audit log entries
│   │   ├── auth/                 session/profile/register/password/deactivate
│   │   ├── bu/                   Business-unit scoped: staff, stock, units, catalogue, approvals
│   │   ├── documents/            Generic document upload/retrieval (Supabase Storage)
│   │   ├── exports/              CSV export (transfers)
│   │   ├── external/procurement/[token]/   Token-based external partner actions (no login)
│   │   ├── finance/               Finance-manager approval queue
│   │   ├── grns/                  Goods-received-notes (SBU receiving from warehouse)
│   │   ├── issuances/             Warehouse stock issuance records
│   │   ├── notifications/         User notification center
│   │   ├── purchase-requests/      PR lifecycle: create/list/submit
│   │   ├── return-requests/        Returns lifecycle: approve/finance-approve/receive
│   │   ├── supplier-grns/          Supplier GRNs incl. CSV import (warehouse receiving from supplier)
│   │   ├── support/                Support/issue tickets
│   │   ├── transfer-requests/      Inter-unit/SBU transfer request CRUD
│   │   └── warehouse/              Warehouse stats, intra-transfers, losses
│   │
│   ├── admin/                    Admin UI: audit, damage, expiry, exports, licenses,
│   │                             products, purchase-requests, sbus, settings, users, variance
│   ├── bu/                       BU_MANAGER/UNIT_STAFF: queue, stock
│   ├── external/procurement/     External procurement portal (token-based, no WMS login)
│   ├── finance/                  FINANCE_MANAGER: catalogue, approval queue
│   ├── forgot-password/          Unauthenticated password reset
│   ├── grn/submit/               GRN submission UI
│   ├── notifications/            Notification center UI
│   ├── profile/                  User profile/account settings
│   ├── purchase-requests/new/    Create/list purchase requests
│   ├── requests/[id]/new/units/  Transfer requests: list, detail+edit, create, unit config
│   ├── returns/new/approvals/    Returns: list, create, approvals
│   └── warehouse/                WAREHOUSE_MANAGER: queue, expected-orders, intra-transfer,
│                                 losses, returns, supplier-grn
│
├── components/                   Shared UI — only 4 files (everything else colocated per-route)
│   ├── AuthGuard.tsx              Global 401 handler (patches window.fetch, clears session)
│   ├── DashboardLayout.tsx        Nav shell (sidebar, notifications bell, avatar menu)
│   ├── DamageWriteOffModal.tsx
│   └── DocumentUpload.tsx
│
├── lib/
│   ├── models/                   TypeScript interfaces mirroring DB tables
│   │   ├── user.ts, sbu.ts, product.ts, transferRequest.ts, transferLineItem.ts,
│   │   │   issuance.ts, grn.ts, purchaseRequest.ts, shared.ts (Notification, AuditLog)
│   ├── services/                 Business logic — thin over Supabase, one file per domain
│   │   ├── transferService.ts, issuanceService.ts, grnService.ts,
│   │   │   purchaseRequestService.ts (largest — full PR state machine),
│   │   │   licenseService.ts, notificationService.ts, auditService.ts,
│   │   │   externalTokenService.ts
│   ├── notifications/            Delivery channels
│   │   ├── channels.ts            Fan-out dispatcher (email + whatsapp, isolated failures)
│   │   ├── emailTemplate.ts       Branded HTML email builder (XSS-escaped)
│   │   ├── messages.ts            Per-entity human-readable message builders
│   │   └── whatsapp.ts            Twilio adapter (stub mode without credentials)
│   ├── workers/notificationWorker.ts   Batch sender — NOT wired to any cron/scheduler yet
│   ├── api/openapi-types.ts       Generated types only (openapi-typescript) — not a client
│   ├── rbac.ts                    Role helpers — defined but unused by API routes (dead code)
│   ├── licensePolicy.ts           evaluateLicenseAccess() — gates auth on license status
│   ├── supabaseClient.ts          Browser Supabase client (anon key)
│   ├── supabaseServer.ts          Server Supabase admin client (service-role) + getUserFromAuthHeader
│   ├── email.ts                   Nodemailer transport, retry/backoff, dead-letter logging
│   └── currency.ts, hooks/useCurrency.ts
│
├── supabase/migrations/          29 SQL migrations, 000 (base schema) → 028 (license management)
│                                 See data-models.md for the full narrative
│
├── tests/
│   ├── unit/                     6 files — service/logic-level (rbac, audit, license policy,
│   │                             notification messages/service, auth routing)
│   ├── integration/              10 files — route/service logic against an in-memory
│   │                             Supabase stub (no real DB/network)
│   └── e2e/                      1 file — Playwright smoke test (public-smoke.spec.ts)
│
├── scripts/
│   ├── seed/seed_data.ts         Seeds 4 SBUs, 6 products, an admin user
│   └── reports/email-activity-report.ts
│
├── .github/workflows/
│   ├── ci.yml                    lint → format:check → test → build
│   ├── ui.yml                    typecheck → biome:check → test → build → e2e:smoke → openapi:check
│   ├── environment-gates.yml     QA/prod manual-approval gates (placeholder steps)
│   └── promotion-guard.yml       Enforces dev → staging → QA → prod branch promotion only
│
├── docs/                         Project documentation (this scan + pre-existing docs)
├── .claude/skills/, _bmad/       BMAD-METHOD agent/workflow skills (vendored, see repo root)
└── docs/openapi/openapi.json     OpenAPI spec (drift-checked in CI against lib/api/openapi-types.ts)
```

## Entry points

- `app/page.tsx` — login / role-based landing router
- `app/layout.tsx` — root layout, wraps every page in `AuthGuard`
- `app/api/*/route.ts` — one entry point per REST endpoint (no central router/middleware)

## Notes

- No `src/` — routes live directly under `app/`.
- No `pages/` (legacy Pages Router) — fully App Router.
- `components/` is at repo root (aliased `@/components/*`), not under `app/`.
