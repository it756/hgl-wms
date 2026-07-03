# Main Spec: Harvest WMS Current State

**Project**: `hgl-wms`
**Status**: Current implementation snapshot
**Version**: 1.0
**Last Updated**: 2026-07-03

## Overview

Harvest WMS is a Next.js 16 App Router application for warehouse operations at Harvest Glory Limited. The current codebase supports inter-SBU transfer requests, warehouse issuances, GRN submission, supplier GRNs with finance approval, returns, audit logging, notifications, and admin configuration.

The repository is organized as a single Next.js app with server routes under `app/api/`, UI pages under `app/`, business logic in `lib/`, database migrations in `supabase/migrations/`, and tests in `tests/`.

## Current Roles

The application currently recognizes these roles:

- `ADMIN`
- `BU_MANAGER`
- `WAREHOUSE_MANAGER`
- `UNIT_STAFF`
- `FINANCE_MANAGER`

## Implemented User Flows

### Authentication and Session Handling

- Supabase Auth is used for sign-in and session verification.
- Login routes users to role-specific areas after authentication.
- Password reset is exposed through `/forgot-password` and `POST /api/auth/reset-password`.
- User activation and registration helpers exist under `app/api/auth/*`.
- The current UI also includes demo login fallbacks for local testing.

### Transfer Requests

- BU users can create and manage transfer requests from `app/requests/new` and `app/requests`.
- Transfer requests are exposed through `app/api/transfer-requests` and `app/api/transfer-requests/[id]`.
- Core transfer types live in `lib/models/transferRequest.ts` and `lib/models/transferLineItem.ts`.
- Transfer processing logic lives in `lib/services/transferService.ts`.
- Transfer status handling includes pending, approval-gated, issued, cancelled, completed, and variance-completed states.

### Finance Approval

- Finance review is available at `app/finance/queue` and `app/api/finance/approvals`.
- Finance can approve or reject transfer requests that require approval.
- Finance can also approve or reject supplier GRNs.
- Administrative settings expose finance approval configuration through `app/api/admin/settings`.

### Warehouse Issuance

- Warehouse work is surfaced at `app/warehouse`, `app/warehouse/queue`, and `app/api/issuances`.
- Issuance logic is implemented in `lib/services/issuanceService.ts`.
- Issuance records live in `lib/models/issuance.ts`.
- The system supports shortfall reasons, stock decrement flows, and approval-gated issuance for transfers that need finance review.

### GRN Processing

- Unit staff submit GRNs through `app/grn/submit` and `app/api/grns`.
- GRN logic is implemented in `lib/services/grnService.ts`.
- GRN types live in `lib/models/grn.ts`.
- Variance handling is represented in the model and admin UI, with completed and completed-with-variance outcomes for transfer receipts.

### Supplier GRNs

- Warehouse managers can create supplier GRNs at `app/warehouse/supplier-grn` and `app/api/supplier-grns`.
- Supplier GRNs begin in `AWAITING_FINANCE_APPROVAL` and are only stock-effective after finance approval.
- Supplier GRN entities include supplier invoice reference, invoice amount, approval metadata, and SBU linkage.

### Returns

- Return requests are present in `app/returns`, `app/returns/new`, `app/returns/approvals`, `app/warehouse/returns`, and `app/api/return-requests`.
- Returns are scoped to an SBU and can be linked to completed transfers.
- Return approvals and receive flows are represented in dedicated API routes under `app/api/return-requests/*`.

### Admin and Reference Data

- Admin pages exist for users, SBUs, products, settings, exports, audit, and variance review.
- Admin CRUD API routes exist for users, SBUs, products, settings, and variance.
- The product catalogue is exposed read-only to operational users when raising requests.
- Seed data is generated through `scripts/seed/seed_data.ts`.

### Notifications and Audit

- Notifications are persisted and surfaced through `app/notifications` and `app/api/notifications`.
- Notification delivery logic lives in `lib/services/notificationService.ts` and `lib/workers/notificationWorker.ts`.
- Audit logging lives in `lib/services/auditService.ts` and `app/api/audit`.
- Export support exists under `app/api/exports` and `app/admin/exports`.

## Current Data Model Surface

The current TypeScript models include:

- `User`
- `SBU`
- `Product`
- `TransferRequest`
- `TransferLineItem`
- `Issuance`
- `IssuanceLineItem`
- `GRN`
- `GRNLineItem`
- `SupplierGRN`
- `SupplierGRNLineItem`
- `Notification`
- `AuditLog`

Notable current fields include finance approval metadata, SBU scoping, optional warehouse scoping, and status fields for transfer, GRN, and supplier GRN workflows.

## Database and Migrations

The repository uses Supabase SQL migrations in `supabase/migrations/`.

Current migration history includes:

- `000_initial_schema.sql`
- `001_decrement_stock.sql`
- `002_process_issuance.sql`
- `003_increment_stock_after_grn.sql`
- `004_decrement_stock_batch.sql`
- `005_return_requests.sql`
- `006_unit_staff_request_flow.sql`
- `007_sbu_units.sql`

These migrations cover the core operational tables, stock movement helpers, return request flow, and SBU/unit relationships.

## Tooling and Scripts

Current package scripts include:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run seed`

## Test Surface

The repository currently includes:

- Unit tests for RBAC, audit service, and notification service.
- Integration tests for transfer request creation, issuance recording, finance approval, concurrent issuance, and GRN submission.

Current test files live under `tests/unit/` and `tests/integration/`.

## Active Constraints

- The app relies on Supabase Auth and a bearer access token stored client-side for API access.
- Role checks are enforced in API routes.
- Finance approval is a live gate for both transfer issuance and supplier GRNs.
- Return requests are tied to SBU membership and completed transfer history.
- The current implementation favors a single-warehouse deployment while keeping `warehouse_id` fields in the data model for future expansion.

## Notes for Maintainers

This document should be treated as the canonical snapshot of what the repository currently implements, not a future roadmap. If the code changes materially, update this file alongside the code so the spec continues to describe the live system.
