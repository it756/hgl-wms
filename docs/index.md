# Project Documentation Index

**Generated:** 2026-07-06 · Scan level: Deep · Mode: Initial scan

## Project Overview

- **What it's for:** Replaces spreadsheet/email/phone coordination of warehouse-to-SBU stock movement with an auditable, role-based digital workflow (request → finance approval → issue → GRN confirm), plus supplier receipt, returns, procurement, licensing, expiry/damage tracking, and intra-warehouse transfers. See [project-overview.md](./project-overview.md) for the full "what and why."
- **Type:** Monolith (single Next.js 16 App Router app — UI + API in one deploy)
- **Primary Language:** TypeScript
- **Architecture:** Route-handler-centric — inline auth/authz per route, business logic in `lib/services/`, some multi-table transitions as Postgres RPCs

## Quick Reference

- **Tech Stack:** Next.js 16, React 19, Supabase (Postgres + Auth), Tailwind v4, Vitest + Playwright, Nodemailer + Twilio
- **Entry Point:** `app/page.tsx` (login, role-routed), `app/layout.tsx` (root layout)
- **Roles:** ADMIN, BU_MANAGER, WAREHOUSE_MANAGER, UNIT_STAFF, FINANCE_MANAGER, + tokenized external procurement actors

## Generated Documentation (this scan)

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)

## Existing Documentation

- [README.md](../README.md) — setup, roles, project structure, CI pipeline
- [ci-cd-governance.md](./ci-cd-governance.md) — guarded branch-promotion flow
- [demo-guide.md](./demo-guide.md) — stakeholder demo script
- [stakeholder-brief.md](./stakeholder-brief.md) — product brief for stakeholders
- [stitch-ui-prompt.md](./stitch-ui-prompt.md) — AI UI-generation style prompt
- [user-flow-training-guide.md](./user-flow-training-guide.md) — end-to-end user flows by role, for training/flow diagrams
- [openapi/openapi.json](./openapi/openapi.json) — OpenAPI spec (drift-checked in CI)

## Known architectural inconsistencies

Tracked in [tech-debt.md](./tech-debt.md) with risk + fix direction for each:

1. `lib/rbac.ts` is unused dead code — routes reimplement role checks inline.
2. Two overlapping variance mechanisms (`variance_proposals` vs. `variance_dispositions`/`stock_losses`).
3. No shared API client — auth-header attachment copy-pasted across ~36 call sites.
4. `notificationWorker.ts` has no cron/scheduler trigger wired up.

Also noted (not in tech-debt.md, deliberate gap not accidental debt): no committed deployment config (Railway-managed outside the repo); `environment-gates.yml` deploy steps are placeholders — see [deployment-guide.md](./deployment-guide.md).

## Getting Started

1. Read [project-overview.md](./project-overview.md) for the high-level shape, then [architecture.md](./architecture.md) for how a request flows end-to-end.
2. For a specific feature area, check [data-models.md](./data-models.md) (schema/state machines) and [api-contracts.md](./api-contracts.md) (route groups) together — most features touch both.
3. For local setup, see [development-guide.md](./development-guide.md).
4. When planning new features with the vendored BMAD skills, point `bmad-create-prd` / `bmad-create-architecture` at this index as brownfield context.
