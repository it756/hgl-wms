# Development Guide — hgl-wms

## Prerequisites

- Node.js (repo tested with v20.x)
- A Supabase project (Postgres + Auth)
- SMTP credentials (for email notifications); Twilio credentials optional (WhatsApp — falls back to stub mode without them)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` (or `.env`) and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASS= / SMTP_FROM=
```

Apply migrations in order (`supabase db push`, or manually via `supabase/migrations/000_initial_schema.sql` through `028_license_management.sql`), then optionally seed:

```bash
npx tsx scripts/seed/seed_data.ts
```

Run the dev server:

```bash
npm run dev
```

**Known gotcha**: if `node_modules/.bin` is missing (symptom: `'next' is not recognized`), `npm install` was interrupted — re-run `npm install` to regenerate the binary shims.

## Common commands

| Command                                   | Purpose                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                             | Dev server                                                                              |
| `npm run build` / `npm run start`         | Production build / start                                                                |
| `npm run typecheck`                       | `next typegen` + `tsc --noEmit`                                                         |
| `npm run lint`                            | ESLint                                                                                  |
| `npm run biome:check`                     | Biome check on CI-config files, `tests/e2e`, `docs/openapi`                             |
| `npm run format` / `format:check`         | Prettier write / check                                                                  |
| `npm test`                                | Vitest run (unit + integration)                                                         |
| `npm run test:watch` / `test:coverage`    | Vitest watch / coverage                                                                 |
| `npm run test:e2e:smoke`                  | Playwright smoke test (chromium)                                                        |
| `npm run openapi:types` / `openapi:check` | Regenerate / drift-check `lib/api/openapi-types.ts` against `docs/openapi/openapi.json` |
| `npm run seed`                            | Seed 4 SBUs, 6 products, an admin user                                                  |

## Testing approach

- **Unit** (`tests/unit/`): pure logic/service tests.
- **Integration** (`tests/integration/`): route/service logic against an in-memory Supabase-shaped stub (`makeChain`) — no real DB or network calls, so these are safe/fast to run locally without credentials.
- **E2E** (`tests/e2e/`): one Playwright smoke spec; requires the app actually running.

## Adding a new API route

Follow the existing pattern (see `docs/architecture.md` request-flow diagram and `docs/api-contracts.md`):

1. `getUserFromAuthHeader(req)` from `lib/supabaseServer.ts` first — 401 if null.
2. Inline role check against `user.user_metadata.role` — 403 if not allowed. (Note: `lib/rbac.ts` helpers exist but aren't used anywhere yet; using them consistently going forward would be an improvement, not a regression.)
3. Scope any query further by the user's own `sbu_id`/`unit_id` — never trust client-supplied scoping.
4. Delegate the actual write/transition to a `lib/services/*.ts` function; keep the route handler thin.
5. Have the service call `auditService.writeAuditLog` and, where relevant, `notificationService.createNotification`.

## Pre-commit

Husky + lint-staged run ESLint (`--fix`) and Prettier on staged files; Biome check on CI/e2e/OpenAPI-related files.
