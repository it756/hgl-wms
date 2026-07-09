# Project Overview — hgl-wms

**Generated:** 2026-07-06 (deep scan) · See [index.md](./index.md) for navigation.

## What this is

Harvest WMS is a warehouse management system for **Harvest Glory Limited**, built to replace spreadsheet/email/phone-call coordination of goods movement with a single, auditable, role-based digital workflow.

**The core problem it solves**: a central warehouse serves multiple Strategic Business Units (SBUs — Harvest Glory's operating units/branches). Before this system, moving stock from warehouse to SBU, confirming what actually arrived, and getting finance sign-off on high-value movements had no single source of truth. Every meaningful action is now request → approve → issue → confirm, with a permanent audit trail and automatic notifications at each handoff.

**The core loop** (see `docs/stakeholder-brief.md` for the original narrative): a **Business Unit Manager** raises a transfer request → if it's above a configurable value threshold, a **Finance Manager** must approve it first → the **Warehouse Manager** issues the goods (decrementing stock) → **Unit Staff** confirm physical receipt via a Goods Received Note (GRN), closing the loop as `COMPLETED` or `COMPLETED_WITH_VARIANCE` if quantities don't match. An **Administrator** manages users, SBUs, the product catalogue, and system settings.

**How far it's grown past the original v1.0 scope**: `docs/stakeholder-brief.md` (May 2026) describes the initial single-warehouse, transfer-request-only vision. Since then the product has grown substantially — it now also covers: supplier goods receipt with finance approval (separate from SBU-to-SBU transfers), returns, a full purchase-request/procurement workflow with an **external, non-logged-in procurement contact** acting via emailed one-time links, staff license management, expiry-date tracking with a dedicated write-off ledger, damage write-offs and physical recall tracking, intra-warehouse stock reassignment between SBUs, and WhatsApp as a second notification channel alongside email. `docs/user-flow-training-guide.md` (3 July 2026) is the more current reference for every flow actually in the system today.

Technically, it's implemented as a Next.js 16 (App Router) monolith — no separate client/server repos.

## Repository type

**Monolith.** One Next.js app: UI pages and API routes (`app/api/`) live in the same codebase and deploy together. There is no `client/`+`server/` split.

## Tech stack

| Category   | Technology                                                    | Notes                                                                                                           |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                                       | React 19                                                                                                        |
| Database   | Supabase (Postgres + Auth)                                    | Service-role key used server-side; RLS enabled as defense-in-depth but app relies on route-level checks         |
| Styling    | Tailwind CSS v4                                               | Material-Design-3-style semantic tokens via `@theme` in `app/globals.css`; no component library (no shadcn/CVA) |
| Email      | Nodemailer (SMTP)                                             | Retry/backoff + dead-letter logging                                                                             |
| Messaging  | Twilio (WhatsApp), stub mode for dev                          | `lib/notifications/whatsapp.ts`                                                                                 |
| Testing    | Vitest 4 (unit/integration), Playwright (e2e smoke)           | Integration tests mock Supabase via an in-memory query-chain stub                                               |
| Tooling    | ESLint, Biome (CI-only checks), Prettier, Husky + lint-staged |                                                                                                                 |
| CI         | GitHub Actions (4 workflows)                                  | Branch-promotion guard enforces `dev → staging → QA → prod`                                                     |
| Deployment | Railway (per README)                                          | No committed Railway/Docker config — managed via Railway dashboard                                              |

## Architecture pattern

Route-handler-centric monolith: `app/api/*/route.ts` handlers authenticate + authorize inline, then delegate business logic to `lib/services/*.ts`. No middleware.ts — auth/RBAC is enforced per-route, not centrally. See [architecture.md](./architecture.md) for detail.

## Roles

`ADMIN`, `BU_MANAGER`, `WAREHOUSE_MANAGER`, `UNIT_STAFF`, `FINANCE_MANAGER` — plus an external, tokenized (non-login) actor class for procurement partners.

## Links

- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
