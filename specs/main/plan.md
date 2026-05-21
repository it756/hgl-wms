# Implementation Plan: Warehouse Transfer Management System

**Branch**: `001-warehouse-transfer` | **Date**: 2026-05-20 | **Spec**: [spec.md](spec.md)

## Summary

Deliver Harvest WMS v1.0 providing a single-warehouse transfer workflow: request → issuance → GRN. Focus on secure RBAC, immutable audit trail, reliable notifications (in-app + email), and clear SBU-scoped visibility. Ship an MVP that supports 4–10 SBUs and is extensible to multi-warehouse in v2.

## Technical Context

- Frontend + Backend: Single Next.js repo (App Router) hosting UI and API routes under `app/` and server helpers in `lib/`
- Database: Supabase Postgres (managed) — use Supabase SQL migrations in `supabase/migrations/` (do not use Prisma)
- Auth: Supabase Auth for user management + server-side verification using Supabase service role key
- Email: Nodemailer (SMTP) or Resend
- Hosting: Railway (app + Postgres)

**Performance Targets**: Dashboard load < 2s under normal load; support 50 concurrent users.

Note: "Normal load" is defined as 50 concurrent active users performing typical dashboard actions. Measure at 95th percentile page load time in the staging environment when validating releases.

## Constitution Check (Gates)

This plan enforces Constitution principles: P1 (Scoped Visibility), P2 (Audit Trail First), P3 (Transfer Request Required), P4 (GRN Closes the Loop), P6 (Notifications), P7 (Role Integrity). Phase 0 research must include a constitution validation step.

## Deliverables by Phase

Phase 1 — Setup (T001–T005)

- Project skeleton: single Next.js project at repository root (App Router) (T001–T003)
- Linting/CI (T004–T005)

Phase 2 — Foundational (T006–T013)

- DB schema and Supabase SQL migrations (T006, T013)
- Authentication + RBAC middleware (T007, T008)
- Core models: User, SBU, Product (T009)
 - Extend `User` model and admin UI to support `Finance Manager` role and RBAC scopes (T046)
- Audit service (T010) and Notification model/service (T011)
- Email config and templates (T012)

Phase 3 — Transfer Request Flow (T014–T020)

- Implement TransferRequest and LineItem models and `transferService` (T014–T016)
- API endpoint `POST /api/transfer-requests` (T017)
- Frontend forms and list views (T018–T019)
- Integration tests (T020)
 - Add finance-approval UI and server endpoints for reviewing and approving requests (T047)

Phase 4 — Issuance (T021–T025)

- Issuance models and service (T021–T022)
- API endpoint `POST /api/issuances` (T023)
- Warehouse queue UI (T024)
- Tests (T025)
 - Update issuance flow to respect finance approvals (no issuance until `APPROVED_FOR_ISSUE`) and record approval metadata (T043)

Phase 5 — GRN (T026–T030)

- GRN models and service (T026–T027)
- API endpoint `POST /api/grns` (T028)
- GRN UI and tests (T029–T030)
 - Add Supplier GRN flow: Warehouse Manager records supplier receipt which remains `AWAITING_FINANCE_APPROVAL` until Finance Manager approves; stock increment is gated behind Finance approval (T048, T048a)

Phase 6 — Cross-cutting & Admin (T031–T036)

- Notification worker, email templates, Admin UI, seed scripts, exports, audit UI

Phase 7 — Tests & Polish (T037–T041)

New Acceptance Criteria (Finance)
- Transfers flagged `requires_finance_approval` must remain non-issuable until a Finance Manager approves; include integration tests in M2.
- Supplier GRNs only increment SBU-attributable stock after Finance approval; rejections must be auditable and notify relevant parties.

## Implementation Notes & Risk Mitigations

- Concurrency & stock safety: implement an atomic DB-side `decrement_stock(product_id, by)` function (SQL / Supabase RPC) that rejects when insufficient stock. Use DB transactions for issuance flows. (See tasks T006/T013 to include RPC and migration.)
- Notification reliability: worker with retry/backoff and dead-letter logging; store in-app notifications persistently before attempting email sends. (T031/T032)
- Variance reconciliation: define a simple admin workflow for resolving `COMPLETED_WITH_VARIANCE` transfers and recording corrections in the audit log. Add tasks to T036 and a follow-up task to implement a variance resolution UI.
- Auth & roles: enforce single-role invariant at creation (ADM-02) and validate server-side RBAC on every API route (T007/T008).

## Milestones & Acceptance

- M1 (Foundation Ready): Phase 2 complete, DB migrations applied, auth and RBAC working.
- M2 (MVP End-to-End): Phases 3–5 complete with integration tests passing; ability to perform request→issuance→GRN flows in test environment.
- M3 (Admin & Polish): Phase 6–7 complete, documentation updated, accessibility checks passed.

Acceptance Criteria for M2:

- End-to-end flow documented and tested via automated integration tests (T020, T025, T030).
- No negative stock conditions observed under simulated concurrent issuance tests.
- Notifications delivered to in-app store and email delivery attempted.

## Tasks Mapping

Refer to `tasks.md` for the full task list (T001–T050). Each task maps to the phase above and to specific files. Tasks marked `[P]` are parallelizable.

## Rollout Plan

1. Deploy to staging with seeded data and one SBU + test users.
2. Run integration test suite; perform concurrency test on issuance.
3. Demo to Warehouse Manager and one BU Manager for acceptance.
4. Address feedback, then promote to production.

## Estimated Effort (rough)

- Foundation: 3–5 dev days
- Transfer flow (end-to-end): 5–8 dev days
- GRN + variance handling: 2–3 dev days
- Admin, notifications, tests, polish: 3–5 dev days

## Migration / DB Notes

- Add tables: `transfer_requests`, `transfer_line_items`, `issuances`, `issuance_line_items`, `grns`, `grn_line_items`, `notifications`, `audit_logs`.
- Add RPC `decrement_stock(product_id, decrement_by)` implemented in SQL to ensure atomic, consistent stock updates.

---

**Owner**: Development Lead / System Administrator
