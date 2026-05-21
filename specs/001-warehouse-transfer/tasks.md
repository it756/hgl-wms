# Tasks: Warehouse Transfer Management System

**Input**: Design documents from `/specs/001-warehouse-transfer/` (spec.md)

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Initialize Next.js project at repository root (App Router) and ensure `app/`, `lib/`, and `public/` exist
- [x] T002 Configure repository `package.json` scripts for dev, build, and test; add `supabase` CLI config
- [x] T003 Create `supabase/` folder and initial SQL migration scaffolding in `supabase/migrations/`
- [x] T004 [P] Configure linting and formatting: `.eslintrc.*` and `prettier.config.*` at repo root
- [x] T005 [P] Add CI workflow: `.github/workflows/ci.yml` to run lint and tests

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T006 Setup database schema and migrations using Supabase SQL migrations in `supabase/migrations/`
- [x] T007 [P] Implement authentication and session management using Supabase Auth and server helpers at `lib/supabaseServer.ts` and API routes under `app/api/auth/*`
- [x] T008 [P] Implement RBAC middleware and server-side guards in `lib/rbac.ts` and API route middleware under `app/api/*`
- [x] T009 [P] Create core models and types under `lib/models/*` or `app/(server)/*` (e.g., `lib/models/user.ts`, `lib/models/product.ts`)
- [x] T010 [P] Implement audit logging service `lib/services/auditService.ts`
- [x] T011 [P] Implement notification persistence model and service `lib/services/notificationService.ts`
- [x] T012 Configure email service and template folder `lib/email/*`
- [x] T013 [P] Create database migration scripts in `supabase/migrations/`
- [x] T013a Create Supabase SQL RPC `decrement_stock(product_id, decrement_by)` and add DB-level test/migration in `supabase/migrations/001_decrement_stock.sql`
- [x] T046 Add `Finance Manager` role to `User` model, admin UI to assign role, and add RBAC scope checks for finance actions (`lib/models/user.ts`, `lib/rbac.ts`, `app/admin/users/*`)

**Checkpoint**: Foundational tasks complete — user story work may begin.

## Phase 3: User Story 1 - Raise Transfer Request (Priority: P1) 🎯 MVP

- [x] T014 [P] [US1] Create `TransferRequest` model in `lib/models/transferRequest.ts`
- [x] T015 [P] [US1] Create `TransferLineItem` model in `lib/models/transferLineItem.ts`
- [x] T016 [US1] Implement `transferService` in `lib/services/transferService.ts` (creation, validation, reference numbering)
- [x] T017 [US1] Implement API endpoint `POST /api/transfer-requests` in `app/api/transfer-requests/route.ts`
- [x] T018 [US1] Implement frontend New Transfer Request form at `app/requests/new/page.tsx`
- [x] T019 [US1] Implement frontend Active Requests list at `app/requests/page.tsx`
- [x] T020 [US1] Add integration test for request creation at `tests/integration/test_create_transfer_request.test.ts`

## Phase 4: User Story 2 - Record Goods Issuance (Priority: P1)

- [x] T021 [P] [US2] Create `Issuance` and `IssuanceLineItem` models at `lib/models/issuance.ts`
- [x] T022 [US2] Implement `issuanceService` in `lib/services/issuanceService.ts` (record issuance, decrement stock, shortfall reasons)
- [x] T023 [US2] Implement API endpoint `POST /api/issuances` in `app/api/issuances/route.ts`
- [x] T024 [US2] Implement Warehouse Manager queue UI at `app/warehouse/queue/page.tsx`
- [x] T025 [US2] Add integration test for recording issuance at `tests/integration/test_record_issuance.test.ts`
- [x] T042 [US2] Implement a multi-line atomic stock decrement RPC (`decrement_stock_batch`) and migration in `supabase/migrations/004_decrement_stock_batch.sql`
- [x] T043 [US2] Update `issuanceService` and `POST /api/issuances` to use the batch RPC so issuance creation and stock updates run atomically in a single DB transaction at `lib/services/issuanceService.ts`
- [x] T044 [US2] Add concurrency integration tests simulating concurrent issuances at `tests/integration/test_concurrent_issuance.test.ts`
- [x] T047 Implement finance-approval UI and API for transfer requests (Finance review queue) at `app/finance/queue/*` and `app/api/finance/approvals/route.ts`
- [x] T048 Implement Supplier GRN flow: `POST /api/supplier-grns` and UI at `app/warehouse/supplier-grn/*`; ensure GRNs are `AWAITING_FINANCE_APPROVAL` until finance approves (see `supabase/migrations/` for flags)
- [x] T048a Implement stock-increment RPC gated by finance approval and add migration `supabase/migrations/003_increment_stock_after_grn.sql`
- [x] T049 Update issuance service (`lib/services/issuanceService.ts`) and `app/api/issuances/route.ts` to enforce `APPROVED_FOR_ISSUE` status before issuing and to record `approved_by`/`approved_at` metadata
- [x] T050 Add integration tests for finance approval flows and supplier GRN approvals at `tests/integration/test_finance_approval.test.ts`

## Phase 5: User Story 3 - Submit GRN (Priority: P1)

- [x] T026 [P] [US3] Create `GRN` and `GRNLineItem` models at `lib/models/grn.ts`
- [x] T027 [US3] Implement `grnService` in `lib/services/grnService.ts` (compare issued vs received, flag variances)
- [x] T028 [US3] Implement API endpoint `POST /api/grns` in `app/api/grns/route.ts`
- [x] T029 [US3] Implement GRN submission UI at `app/grn/submit/page.tsx`
- [x] T030 [US3] Add integration test for GRN submission at `tests/integration/test_submit_grn.test.ts`

## Phase 6: Cross-cutting & Admin

- [x] T031 [P] Implement notifications delivery worker `lib/workers/notificationWorker.ts`
- [x] T032 Implement email templates at `lib/email/templates/` for transfer events
- [x] T033 [P] Implement Admin panel pages in `app/admin/*` for Users, SBUs, Products, Settings
- [x] T034 [P] Seed product catalogue and initial SBUs script at `scripts/seed/seed_data.ts`
- [x] T035 Implement export CSV endpoints `app/api/exports/*` and frontend export UI `app/admin/exports/page.tsx`
- [x] T036 [P] Implement audit log query API `app/api/audit/route.ts` and UI `app/admin/audit/page.tsx`
- [x] T045 [US3] Implement variance reconciliation UI and API for admin review at `app/admin/variance/*` and `app/api/admin/variance/route.ts`

## Phase 7: Tests, Docs & Polish

- [x] T037 [P] Add unit tests for services in `tests/unit/`
- [ ] T038 [P] Add end-to-end tests for main flows in `tests/e2e/`
- [x] T039 Update documentation: `README.md` updated with full setup guide, roles, architecture, and script reference
- [ ] T040 Accessibility and WCAG checks: `app/styles/` and review
- [x] T041 Final deployment checklist: `scripts/deploy/checklist.md`

## Dependencies & Execution Order

- Setup → Foundational → User Stories (can run in parallel after foundation) → Cross-cutting → Polish

## Parallel Opportunities

- Tasks marked `[P]` can be executed in parallel by separate engineers.

**Notes**: Each task should be implemented in its specified file path. Tests should be added concurrently with implementation tasks where feasible.
