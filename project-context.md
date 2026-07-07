---
project_name: "hgl-wms"
user_name: ""
date: "2026-07-06"
sections_completed:
  [
    "technology_stack",
    "language_rules",
    "framework_rules",
    "testing_rules",
    "quality_rules",
    "workflow_rules",
    "anti_patterns",
  ]
status: "complete"
rule_count: 30
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing code in hgl-wms. See `docs/index.md` for full architecture/data-model documentation — this file is the lean, unobvious-details companion, not a replacement._

---

## Technology Stack & Versions

- Next.js **16.2.6** (App Router only — no `pages/`), React **19.2.4**, TypeScript **5** (`strict: true`)
- Supabase (`@supabase/supabase-js` ^2.106, `@supabase/ssr` ^0.10) — Postgres + Auth
- Tailwind CSS **v4** (`@theme` token block, not a `tailwind.config.js` theme object)
- Vitest **4** (jsdom, globals) + `@testing-library/react`; Playwright **1.61** for e2e smoke only
- ESLint (flat config, `eslint.config.mjs`, `eslint-config-next`) + Prettier **3** + Biome **2** (scoped to `.github/workflows/ui.yml`, `biome.json`, `playwright.config.ts`, `tests/e2e/**`, `docs/openapi/**` only — Biome does NOT lint the rest of the codebase, ESLint/Prettier do)
- Husky + lint-staged on pre-commit (`npx lint-staged --concurrent false`)
- Nodemailer (email) + Twilio (WhatsApp, stub mode without credentials)

## Critical Implementation Rules

### Language-Specific Rules

- `strict: true` in `tsconfig.json` — no implicit `any`. ESLint has `@typescript-eslint/no-explicit-any` at `"warn"` (not error) — don't treat existing `any` usage as license to add more.
- Path alias `@/*` maps to repo root (not `src/`), e.g. `@/lib/services/transferService`.
- No schema-validation library (no Zod/Yup) anywhere in API routes — request bodies are validated with manual field checks. Match this pattern rather than introducing a new validation approach in one route.

### Framework-Specific Rules

- **No `middleware.ts` exists.** Auth and role checks are NOT centralized — every `app/api/*/route.ts` handler must independently call `getUserFromAuthHeader(req)` (`lib/supabaseServer.ts`) first, then inline-check `user.user_metadata.role` against an allowed-roles array. Do not assume a shared middleware layer will catch an unguarded route.
- `lib/rbac.ts` (`hasRole`, `hasAnyRole`, `isAdmin`, etc.) exists but is **not used by any route handler** — it's effectively dead code outside its own unit test. Don't assume changing it affects live authorization; if you use it in new code, you're the first.
- Never trust client-supplied `sbu_id`/`unit_id` for scoping — always resolve the user's own `sbu_id`/`unit_id` server-side from their `profiles` row.
- Multi-table stock-affecting transitions (issuance, GRN stock increment, variance disposition, intra-warehouse transfer) are implemented as **Postgres RPC functions** (`supabaseAdmin.rpc(...)`), not application code — e.g. `issuanceService.processIssuance` just calls `rpc("process_issuance", ...)`. If a change touches stock quantities, check whether an RPC already owns that transition before writing new decrement/increment logic in TypeScript.
- Two variance-reconciliation mechanisms coexist: `variance_proposals` (Finance-reviewed, current) and the older `variance_dispositions`/`stock_losses` pair. Confirm which one a feature request means before extending either — don't assume there's only one.
- Write-path services (`transferService`, `grnService`, `purchaseRequestService`, etc.) call `auditService.writeAuditLog(...)` and, where relevant, `notificationService.createNotification(...)`. New write paths should follow this — omitting either breaks the audit trail or leaves users unnotified silently.
- `auditService.writeAuditLog` swallows its own errors (logs, doesn't throw) — auditing failure must never block the business operation it's auditing.
- No shared frontend API client exists — every `"use client"` page reads `localStorage.getItem("access_token")` and attaches `Authorization: Bearer` manually per fetch call (~36 call sites). Match this existing pattern for new pages; don't invent a one-off wrapper for a single new page.
- `components/AuthGuard.tsx` centrally handles 401s (patches `window.fetch`, clears session, redirects) — don't add per-page 401 handling, it's redundant.
- No shared UI component library (no Button/Input/Card primitives, no shadcn/CVA) — only 4 files in root `components/`. New UI is built inline with Tailwind utility classes against the `@theme` tokens in `app/globals.css`; match an existing page's inline pattern rather than assuming a component to import exists.
- `lib/workers/notificationWorker.ts` is not wired to any cron route or scheduler — don't assume queued notifications get emailed on a schedule unless you also wire the trigger.

### Testing Rules

- Integration tests (`tests/integration/`) mock Supabase entirely via an in-memory query-chain stub (`makeChain`) mocking `supabaseAdmin.from`/`.rpc`/`auth.admin.getUserById` — they never hit a real DB or network. New integration tests should extend this stub rather than reaching for a real Supabase test instance.
- Unit tests (`tests/unit/`) are for pure logic/service-level behavior without DB mocking scaffolding.
- E2E (`tests/e2e/`) is a single Playwright smoke spec (`public-smoke.spec.ts`), run via `npm run test:e2e:smoke --project=chromium` — it requires the app actually running; it's not part of `npm test`.
- `npm test` (Vitest) covers unit + integration only, not e2e.

### Code Quality & Style Rules

- Prettier: double quotes off (`singleQuote: false`, i.e. double quotes), semicolons on, trailing commas everywhere, 100 print width, 2-space indent. Don't hand-format against these.
- ESLint flat config extends `eslint-config-next` (`core-web-vitals` + `typescript`); several React-hooks rules are `"warn"` (`set-state-in-effect`, `immutability`, `purity`) — treat warnings as real signals to fix, not noise, since they're intentionally kept as warn (not error) to avoid blocking CI while still being visible.
- Biome only touches CI/e2e/OpenAPI-adjacent files (see Technology Stack) — don't run `biome check --write` across the whole repo expecting it to reformat application code; it will no-op outside its configured `includes`.
- `docs/openapi/openapi.json` is the source of truth for `lib/api/openapi-types.ts` (generated via `openapi-typescript`). If an API route's request/response shape changes, update the OpenAPI spec and regenerate (`npm run openapi:types`) — CI's `openapi:check` fails the build on drift.

### Development Workflow Rules

- Branch flow is strictly `dev → staging → QA → prod`, enforced by `.github/workflows/promotion-guard.yml` — PRs that merge backward (e.g. staging → dev) or skip a stage will be blocked. Feature branches follow `feature/*` or `fix/*` naming and target `dev`.
- Commit style is mostly Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) — match this for new commits.
- Pre-commit (Husky + lint-staged) auto-fixes ESLint + Prettier on staged `.ts/.tsx/.js/.jsx` and Prettier on `.json/.md/.yml/.yaml/.css`; don't fight the auto-fix by hand-formatting differently.
- CI (`ci.yml`, `ui.yml`) runs on every push to `dev`/`staging`/`QA`/`prod`: lint, format check, typecheck, unit+integration tests, build, e2e smoke, and OpenAPI drift check — a PR failing any of these won't merge cleanly.
- No committed deployment config (Railway-managed outside the repo) — don't add Docker/Railway config assuming none exists; check with the team first, since it's a deliberate gap noted in `docs/deployment-guide.md`, not an oversight to "fix" unilaterally.

### Critical Don't-Miss Rules

- **Auth chokepoint**: `getUserFromAuthHeader()` in `lib/supabaseServer.ts` does JWT verification AND profile/role/license enrichment in one call — it's the only place that should ever resolve "who is this user and are they allowed to be here." Don't re-implement token parsing elsewhere.
- **License gating**: `evaluateLicenseAccess()` (`lib/licensePolicy.ts`) can deny auth even for a valid JWT if the user's license has lapsed — a 401-shaped failure from `getUserFromAuthHeader` isn't always "bad token," check the `AppAuthResult` reason.
- **External actors have no `auth.users` row**: procurement-portal actions (`app/api/external/procurement/[token]/*`) authenticate via single-use hashed tokens, not Supabase sessions — audit entries from these have `performed_by: undefined` by design, not a bug.
- **RLS is defense-in-depth, not the access gate**: the app always connects via the service-role key (`supabaseAdmin`), which bypasses RLS. The real authorization boundary is the per-route role check — don't rely on RLS policies alone when reasoning about what a change permits.
- **Stock math is DB-owned**: don't write ad hoc `UPDATE products SET stock_quantity = ...` from TypeScript for anything issuance/GRN/variance/transfer-related — use the existing RPC (`process_issuance`, `increment_stock_after_grn`, `process_variance_disposition`, `process_intra_transfer`, or the `024_atomic_core_workflows.sql` functions) or add a new RPC following the same row-locking (`FOR UPDATE`) pattern.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code in this repo.
- Follow these rules exactly; when a rule and observed code conflict, treat the rule as the intended standard and the code as the drift to fix (unless the task says otherwise).
- When in doubt, prefer the more restrictive/explicit option (e.g. don't trust client-supplied scoping, don't skip audit logging).
- Cross-reference `docs/index.md` for full architecture, data model, and API contract detail — this file stays intentionally lean.

**For Humans:**

- Update this file when the tech stack, auth model, or a documented convention changes.
- Review periodically and remove rules that have become obvious or superseded (e.g. once `lib/rbac.ts` is actually wired up, delete that bullet).

Last Updated: 2026-07-06
