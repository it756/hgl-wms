# Feature Specification: Warehouse Transfer Management System

**Feature Branch**: `001-warehouse-transfer`
**Created**: 2026-05-20
**Last Updated**: 2026-06-12
**Status**: Active Development
**Version**: 2.0
**Input**: User-provided specification and updated Constitution (Harvest WMS)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Raise Transfer Request (Priority: P1)

As a Unit Staff member, I want to raise a transfer request for one or more products so that my unit can receive goods from the central warehouse.

As a Business Unit Manager, I want to raise transfer requests on behalf of my SBU, or approve requests raised by Unit Staff.

**Why this priority**: Core business flow enabling transfers; required for any downstream workflows.

**Implementation notes**: Transfer requests are raised against a specific `sbu_unit` (sub-unit/department within an SBU). Unit Staff requests enter `PENDING_BU_APPROVAL` first; BU Manager approval advances them to `PENDING_APPROVAL` (or directly to `APPROVED_FOR_ISSUE` / `PENDING_APPROVAL` where finance applies). BU Managers can also raise requests directly, which skip the BU approval step.

**Independent Test**: Create a new transfer request with multiple line items as Unit Staff and verify it appears as `PENDING_BU_APPROVAL` with a `TRF-` reference. Approve it as BU Manager and verify it advances to the correct next status.

**Acceptance Scenarios**:

1. Given a logged-in Unit Staff member, when they submit a transfer with valid quantities, the system creates a `TRF-YYYY-NNNNN` reference and marks it `PENDING_BU_APPROVAL`.
2. Given a `PENDING_BU_APPROVAL` request, when the BU Manager approves it, the status advances to `PENDING_APPROVAL` (or `APPROVED_FOR_ISSUE` if below the finance threshold).
3. Given the request is created, when the Warehouse Manager views the queue, the request is visible once approved and not editable by the requester.

---

### User Story 2 - Record Goods Issuance (Priority: P1)

As the Warehouse Manager, I want to record issued quantities against an `APPROVED_FOR_ISSUE` request so stock is decremented and the SBU is notified.

**Independent Test**: Record issuance for an `APPROVED_FOR_ISSUE` request; verify stock decremented atomically via `process_issuance` RPC, status becomes `ISSUED`, and notifications are sent to BU Manager and Unit Staff.

**Acceptance Scenarios**:

1. Given an `APPROVED_FOR_ISSUE` request, when the Warehouse Manager records issuance, then the request becomes `ISSUED` and issued quantities are immutable.
2. If issued < requested for any line, then a reason is recorded and the issuance is accepted.

---

### User Story 3 - Submit GRN (Priority: P1)

As Unit Staff, I want to acknowledge receipt via a GRN so the transfer can be closed and variances recorded.

**Independent Test**: Submit GRN for an `ISSUED` transfer; verify status transitions to `COMPLETED` or `COMPLETED_WITH_VARIANCE` and that variances notify the Warehouse Manager.

**Acceptance Scenarios**:

1. Given an `ISSUED` transfer, when Unit Staff confirms exact quantities, then the status becomes `COMPLETED`.
2. Given an `ISSUED` transfer, when Unit Staff reports quantity differences, then the status becomes `COMPLETED_WITH_VARIANCE` and Warehouse Manager is notified.

---

### User Story 4 - Finance Approval & Supplier GRN (Priority: P1)

As a Business Unit Manager, I want transfers above a configured monetary threshold to require Finance Manager approval before the Warehouse Manager can issue goods.

As a Warehouse Manager, when goods are received from suppliers I want to record a Supplier GRN and have the Finance Manager approve it before stock levels are increased.

**Acceptance Scenarios**:

1. Given a transfer with `estimated_value >= finance_approval_threshold`, when submitted, it enters `PENDING_APPROVAL` status and the Finance Manager receives a notification.
2. When the Finance Manager approves a transfer, it moves to `APPROVED_FOR_ISSUE`; if rejected, it moves to `CANCELLED`.
3. Given a Supplier GRN recorded by the Warehouse Manager, when Finance Manager approves, stock levels are incremented and the GRN status becomes `GRN_APPROVED`; if rejected, stock is not changed.

---

### User Story 5 - Variance Disposition (Priority: P1)

As a BU Manager, I want to decide how to handle quantity variances detected in a GRN — either writing them back as a stock correction or recording them as a confirmed stock loss.

**Implementation notes**: After a `COMPLETED_WITH_VARIANCE` GRN, the BU Manager visits the variance queue and makes a per-line disposition decision: `WRITE_BACK` (stock credited back to warehouse) or `LOSS` (written to the `stock_losses` ledger with financial value captured). This is executed atomically via the `process_variance_disposition` RPC.

**Acceptance Scenarios**:

1. Given a `COMPLETED_WITH_VARIANCE` transfer, when the BU Manager submits dispositions for all variance lines, the `variance_dispositions` table is populated and the transfer is marked resolved.
2. For each `LOSS` disposition, a `stock_losses` entry is created with `quantity_lost`, `unit_cost_at_loss`, and `value_lost`.
3. For each `WRITE_BACK`, warehouse stock is incremented by the variance quantity.

---

### User Story 6 - Return Requests (Priority: P1)

As Unit Staff, I want to raise a return request for goods from a completed transfer so they can be sent back to the warehouse.

**Implementation notes**: Returns are raised against `COMPLETED` or `COMPLETED_WITH_VARIANCE` transfers. They require BU Manager approval (`PENDING_APPROVAL` → `APPROVED`) before the Warehouse Manager can physically receive them (`RECEIVED`). Stock is restored atomically via the `process_return_receipt` RPC on receipt.

**Acceptance Scenarios**:

1. Given a completed transfer, when Unit Staff raises a return, a `RTN-YYYY-NNNNN` reference is generated and the return enters `PENDING_APPROVAL`.
2. When the BU Manager approves the return, it moves to `APPROVED` and the Warehouse Manager is notified.
3. When the Warehouse Manager confirms receipt, stock is restored and the return becomes `RECEIVED`.

---

### User Story 7 - Damage Recalls (Priority: P2)

As a Warehouse Manager, I want to initiate a recall of physically damaged goods from a unit so they can be returned to the warehouse for disposal, even though the stock has already been written off.

**Implementation notes**: Damage recalls are created in the `damage_recalls` table as a separate logistics tracking mechanism. They do **not** restore stock (goods are already written off in `damage_ledger`). Lifecycle: `PENDING → IN_TRANSIT → RECEIVED`.

**Acceptance Scenarios**:

1. Given a `damage_ledger` entry, when the Warehouse Manager initiates a recall, a `damage_recalls` record is created with `PENDING` status.
2. When goods are confirmed received, the recall moves to `RECEIVED` and the associated damage ledger entry is updated.

---

### User Story 8 - Document Attachments (Priority: P2)

As any authorised user, I want to attach supporting documents (invoices, delivery notes) to stock movement transactions so there is an auditable paper trail.

**Implementation notes**: Documents are stored in Supabase Storage (`hgl-wms` bucket) with metadata in `transaction_documents`. Supported transaction types: `transfer_request`, `issuance`, `grn`, `supplier_grn`, `return_request`, `variance_proposal`. Access is role-scoped via RLS — global roles (WAREHOUSE_MANAGER, FINANCE_MANAGER, ADMIN) can read all; SBU-scoped roles (BU_MANAGER, UNIT_STAFF) can only read documents for their own SBU's transactions.

**Acceptance Scenarios**:

1. Given any stock movement transaction, when an authorised user uploads a file, a `transaction_documents` record is created with storage path, file name, size, MIME type, and optional label.
2. Given an SBU-scoped user, they cannot access documents belonging to another SBU's transactions.

## Finance Approval Configuration

- `finance_approval_threshold` (numeric): monetary threshold above which transfer requests require Finance Manager approval before issuance. Default: `1000` (application base currency). Admin-configurable; may be overridden per-SBU.
- `finance_approval_scope`: either `global` or `per_sbu` (default `global`). If `per_sbu`, SBUs may set custom thresholds via Admin UI.

Acceptance behaviour:

- Transfers with `estimated_value >= finance_approval_threshold` and `requires_finance_approval = true` enter `PENDING_APPROVAL` and remain non-issuable until a Finance Manager approves.

### Transfer Request Status Lifecycle

```
PENDING_BU_APPROVAL  (Unit Staff raised; awaiting BU Manager)
  → PENDING_APPROVAL (BU approved; awaiting Finance; or BU Manager raised with finance threshold met)
  → APPROVED_FOR_ISSUE (Finance approved; OR below threshold after BU approval)
  → ISSUED (Warehouse Manager recorded issuance)
  → COMPLETED (GRN submitted, quantities match)
  → COMPLETED_WITH_VARIANCE (GRN submitted, quantities differ)
  → CANCELLED (rejected at any pre-issuance step)
```

BU Managers raising requests directly skip `PENDING_BU_APPROVAL` and go straight to `PENDING_APPROVAL` or `APPROVED_FOR_ISSUE`.

### Edge Cases

- Attempt to raise a request for another SBU — must be blocked.
- Attempt to issue more stock than available — Warehouse Manager must be prevented.
- Attempt to edit a submitted request or a submitted GRN — must be disallowed.

## Requirements _(mandatory)_

### Functional Requirements

- **AUTH-01**: All users must authenticate with a unique email address and password.
- **AUTH-02**: Password strength: min 8 chars, one number, one special char.
- **AUTH-03**: Role-based dashboard routing on login.
- **AUTH-04**: Session timeout configurable (default 30 minutes).
- **AUTH-05**: Single-role constraint per user.
- **AUTH-06**: Deactivated users cannot log in but historical attributions remain.
- **AUTH-07**: Password reset via time-limited email link.

- **INV-01**: Admin/Warehouse Manager can add products with full metadata including `warehouse_location` (format `[A-Z][1-2]`, e.g. `A1`, `B2`).
- **INV-02**: Warehouse Manager can adjust stock with mandatory reason; audit recorded.
- **INV-03**: Stock adjustments logged with previous/new quantities.
- **INV-04**: BU Managers and Unit Staff view a read-only active product catalogue when raising requests.
- **INV-05**: Products can be soft-deactivated; hidden from new requests.
- **INV-06**: Configurable low-stock threshold triggers in-app alert to Warehouse Manager.
- **INV-07**: Stock decremented atomically on issuance via `process_issuance` RPC; GRN is acknowledgement only.
- **INV-08**: Each product has a `warehouse_location` physical bin label validated as `[A-Z][1-2]`.

- **SBU-01**: Admin can create and manage SBUs.
- **SBU-02**: Admin can create SBU Units (sub-units/departments) within an SBU.
- **SBU-03**: Users are assigned to an SBU and optionally to an SBU Unit.
- **SBU-04**: Transfer requests must reference the originating SBU Unit.

- **TRF-01**: Transfer requests support multiple line items per request.
- **TRF-02**: Each request receives a unique `TRF-YYYY-NNNNN` reference number.
- **TRF-03**: Unit Staff requests enter `PENDING_BU_APPROVAL`; BU Manager requests skip to `PENDING_APPROVAL` or `APPROVED_FOR_ISSUE`.
- **TRF-04**: Requests can be cancelled by the requester before issuance begins.
- **TRF-05**: Submitted requests are immutable; no editing after submission.
- **TRF-06**: Requests are scoped to the user's SBU; cross-SBU requests are blocked.
- **TRF-07**: BU Manager approves or rejects `PENDING_BU_APPROVAL` requests raised by Unit Staff.
- **TRF-08**: Finance Manager approves or rejects `PENDING_APPROVAL` requests; approval transitions to `APPROVED_FOR_ISSUE`; rejection cancels.
- **TRF-09**: Warehouse Manager views a queue of `APPROVED_FOR_ISSUE` requests with inline stock levels.
- **TRF-10**: Warehouse Manager records issuance quantities (may be less than requested with a reason).
- **TRF-11**: Stock is decremented atomically on issuance; prevents over-issue.
- **TRF-12**: Status transitions to `ISSUED` after issuance; issued quantities are immutable.
- **TRF-13**: BU Manager and Unit Staff are notified when goods are issued.
- **TRF-14**: `estimated_value` and `requires_finance_approval` flag are persisted on the request for finance workflow routing.

- **GRN-01**: Unit Staff views `ISSUED` transfers and submits a GRN.
- **GRN-02**: GRN captures `date_received`, `condition_notes`, and per-line `quantity_received`.
- **GRN-03**: If all quantities match, status becomes `COMPLETED`.
- **GRN-04**: If any quantity differs, status becomes `COMPLETED_WITH_VARIANCE`; `has_variance = true` on the GRN.
- **GRN-05**: Variance detected — Warehouse Manager is notified.
- **GRN-06**: GRN records are locked after submission; no partial GRN in v1.
- **GRN-07**: BU Manager can view variance lines for their SBU and submit dispositions.

- **VAR-01**: BU Manager submits per-line variance dispositions: `WRITE_BACK` or `LOSS`.
- **VAR-02**: `WRITE_BACK` — warehouse stock is incremented by the variance quantity.
- **VAR-03**: `LOSS` — a `stock_losses` entry is created with `quantity_lost`, `unit_cost_at_loss` (snapshotted), and `value_lost`.
- **VAR-04**: Variance disposition is executed atomically via `process_variance_disposition` RPC.
- **VAR-05**: Warehouse Manager and Admin can view the full stock losses ledger.

- **RET-01**: Unit Staff raises return requests against `COMPLETED` or `COMPLETED_WITH_VARIANCE` transfers.
- **RET-02**: Return requests receive a unique `RTN-YYYY-NNNNN` reference.
- **RET-03**: Return requests require a mandatory `reason` and optional `notes`.
- **RET-04**: Return enters `PENDING_APPROVAL`; BU Manager approves/rejects.
- **RET-05**: On BU Manager approval, Warehouse Manager is notified to expect the goods.
- **RET-06**: Warehouse Manager confirms physical receipt; stock restored atomically via `process_return_receipt` RPC; status becomes `RECEIVED`.
- **RET-07**: BU Manager and Unit Staff are notified when the return is received.

- **SGRN-01**: Warehouse Manager records Supplier GRNs with supplier name, invoice reference, invoice amount, date received, SBU, and line items (product, qty, unit cost).
- **SGRN-02**: Supplier GRN enters `AWAITING_FINANCE_APPROVAL`; Finance Manager is notified.
- **SGRN-03**: Finance Manager approves (`GRN_APPROVED`) or rejects (`GRN_REJECTED`).
- **SGRN-04**: On approval, warehouse stock is incremented for each line item.
- **SGRN-05**: On rejection, stock is not changed.

- **DMG-01**: Warehouse Manager can initiate a damage recall for a damage-ledger entry.
- **DMG-02**: Damage recalls track physical return of damaged goods: `PENDING → IN_TRANSIT → RECEIVED`.
- **DMG-03**: Damage recalls do not restore stock — goods are already written off in `damage_ledger`.
- **DMG-04**: Admin, Warehouse Manager, and Finance Manager can view the damage ledger and recall status.

- **DOC-01**: Any authorised user can attach documents to supported transaction types: `transfer_request`, `issuance`, `grn`, `supplier_grn`, `return_request`, `variance_proposal`.
- **DOC-02**: Documents are stored in Supabase Storage (`hgl-wms` bucket); metadata stored in `transaction_documents`.
- **DOC-03**: SBU-scoped roles can only access documents for their own SBU's transactions.
- **DOC-04**: Global roles (WAREHOUSE_MANAGER, FINANCE_MANAGER, ADMIN) can access all documents.

- **EXP-01**: Admin, Warehouse Manager, and Finance Manager can export transfer request data as CSV.
- **EXP-02**: CSV export supports `from`/`to` date range filters.
- **EXP-03**: Exported data includes reference number, status, SBU, raised by, required date, estimated value, finance flag, and timestamps.

- **NOT-01**: In-app notifications delivered to role queues; unread badge shown.
- **NOT-02**: Email notifications sent for key events (issuance, finance decisions).
- **NOT-03**: Notifications cannot be deleted; only marked as read.
- **NOT-04**: Notification content and links are role-appropriate.
- **NOT-05**: Notifications are scoped by role (BU_MANAGER, UNIT_STAFF, WAREHOUSE_MANAGER, FINANCE_MANAGER).

- **ADM-01**: Admin manages users (create, deactivate, assign role/SBU/unit) via UI and CSV bulk import (up to 200 users).
- **ADM-02**: Admin manages SBUs and SBU Units.
- **ADM-03**: Admin manages the product catalogue including warehouse locations.
- **ADM-04**: Admin configures finance approval thresholds in settings.
- **ADM-05**: Admin and Warehouse Manager can view the full audit log with filtering.
- **ADM-06**: Admin can view variance disposition registry and damage ledger.
- **ADM-07**: Admin, Warehouse Manager, and Finance Manager can export data as CSV for any supported date range.

### Key Entities

- `User` — auth.users + `profiles` (id, full_name, role, sbu_id, unit_id, is_active)
- `SBU` — Strategic Business Unit (id, name, code)
- `SBUUnit` — Sub-unit/department within an SBU (id, name, code, sbu_id, is_active)
- `Product` — (id, name, sku, description, unit_of_measure, stock_quantity, low_stock_threshold, unit_cost, warehouse_location, is_active)
- `TransferRequest` — (id, reference_number `TRF-YYYY-NNNNN`, sbu_id, requesting_unit_id, raised_by, status, required_date, notes, estimated_value, requires_finance_approval, approved_by, approved_at, bu_approved_at, finance_approval_notes)
- `TransferLineItem` — (id, transfer_request_id, product_id, quantity_requested)
- `Issuance` — (id, transfer_request_id, issued_by, issue_date, logistics_notes)
- `IssuanceLineItem` — (id, issuance_id, product_id, quantity_issued, shortfall_reason)
- `GRN` — (id, transfer_request_id, received_by, date_received, condition_notes, has_variance, acknowledged)
- `GRNLineItem` — (id, grn_id, product_id, issued_quantity, quantity_received, variance_notes)
- `SupplierGRN` — (id, reference_number, supplier_name, supplier_invoice_reference, invoice_amount, date_received, status, sbu_id)
- `SupplierGRNLineItem` — (id, supplier_grn_id, product_id, quantity_received, unit_cost)
- `ReturnRequest` — (id, reference_number `RTN-YYYY-NNNNN`, sbu_id, original_transfer_request_id, status, reason, notes, raised_by, approved_by, received_by)
- `ReturnLineItem` — (id, return_request_id, product_id, quantity_to_return, quantity_received)
- `VarianceDisposition` — (id, transfer_request_id, grn_id, grn_line_item_id, product_id, sbu_id, quantity_variance, disposition `WRITE_BACK | LOSS`, decided_by, decided_at, notes)
- `StockLoss` — (id, reference_number, variance_disposition_id, transfer_request_id, product_id, sbu_id, quantity_lost, unit_cost_at_loss, value_lost, decided_by, decided_at)
- `DamageLedger` — (id, product_id, quantity, unit_cost_at_writeoff, estimated_value, writeoff_reason, written_off_by, written_off_at)
- `DamageRecall` — (id, damage_ledger_id, initiated_by, status `PENDING | IN_TRANSIT | RECEIVED`, notes, received_by, received_at)
- `TransactionDocument` — (id, transaction_type, transaction_id, storage_path, file_name, file_size, mime_type, document_label, uploaded_by)
- `Notification` — (id, user_role, type, message, related_entity_id, is_read, created_at)
- `AuditLog` — (id, entity_type, entity_id, action, performed_by, previous_value, new_value, created_at)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the transfer request flow (request → BU approval → finance approval if applicable → issuance → GRN) end-to-end in under 10 minutes from initiation to finalisation.
- **SC-002**: 95% of `APPROVED_FOR_ISSUE` requests are actioned (ISSUED or CANCELLED) within 48 hours during business days.
- **SC-003**: 95% of in-app notifications are delivered and visible in the user's notification panel within 30 seconds of triggering.
- **SC-004**: System retains transfer and audit records for a minimum of 3 years and can export CSVs for any supported date range.
- **SC-005**: All variance lines on a `COMPLETED_WITH_VARIANCE` transfer are dispositioned (WRITE_BACK or LOSS) before the transfer is considered fully closed.
- **SC-006**: Stock levels are never negative; `process_issuance` and `process_return_receipt` RPCs enforce atomicity.

## Assumptions

- Product catalogue seeded or entered before go-live.
- Each SBU has at least one BU Manager, one Unit Staff member, and at least one SBU Unit at launch.
- One Warehouse Manager account in v1.0.
- One Finance Manager account in v1.0.
- Users have internet access during business hours.
- Email delivery is relied upon for external alerts.
- Supabase Storage bucket `hgl-wms` is provisioned for document attachments.

## Open Questions

1. **OQ-01**: Confirmed application name? (Branding/email sender) — _pending_
2. **OQ-04**: Recurring / standing transfer requests needed? — _deferred to v2_
3. **OQ-05**: Multi-warehouse in v2? — **Resolved** (Option B — see below)

## Resolved Decisions

### Decision: Multi-Warehouse Extensibility (OQ-05 — Resolved)

Option B — Single warehouse for v1.0 but data model is extensible for multi-warehouse in v2:

- Optional `warehouse_id` FK added to relevant entities (nullable, defaults to single warehouse in v1.0).
- Warehouse-specific logic encapsulated behind service interfaces to allow `warehouse_id` filters with minimal code changes.
- `warehouse_location` field on `products` uses format `[A-Z][1-2]` to represent physical bin locations within the single warehouse.

### Decision: SBU Unit Sub-Structure

Transfer requests originate from `sbu_units` (sub-units/departments). Unit Staff are assigned to a unit and raise requests on behalf of that unit. This provides finer-grained reporting and accountability at the department level within each SBU.

### Decision: Two-Step Approval for Large Transfers

Transfers above the configured `finance_approval_threshold` require Finance Manager approval before issuance, in addition to any BU Manager approval. This enforces financial oversight and budget controls.

## Data Model Reference

See `supabase/migrations/` for the full authoritative schema:

- `000_initial_schema.sql` — Core tables: users/profiles, SBUs, products, transfer requests, issuances, GRNs, notifications, audit log
- `001_decrement_stock.sql` — Stock decrement RPC
- `002_process_issuance.sql` — Atomic issuance RPC
- `003_increment_stock_after_grn.sql` — Stock increment on supplier GRN approval
- `004_decrement_stock_batch.sql` — Batch stock decrement
- `005_return_requests.sql` — Return request tables and `process_return_receipt` RPC
- `006_unit_staff_request_flow.sql` — Variance disposition tables (`variance_dispositions`, `stock_losses`) and `process_variance_disposition` RPC
- `007_sbu_units.sql` — `sbu_units` table, `unit_id` on profiles, `requesting_unit_id` on transfer requests
- `008_transaction_documents.sql` — `transaction_documents` table and RLS policies for file attachments
- `009_variance_proposals.sql` — `variance_proposals` and `variance_proposal_lines` tables
- `010_damage_recalls.sql` — `damage_recalls` table and RLS
- `011_warehouse_location.sql` — `warehouse_location` column on products
- `012_variance_disposition.sql` — Variance disposition RPC and `stock_losses` ledger

- **EXP-01**: Admin, Warehouse Manager, and Finance Manager can export transfer request data as CSV.
- **EXP-02**: CSV export supports `from`/`to` date range filters.
- **EXP-03**: Exported data includes: reference number, status, SBU, raised by, required date, estimated value, finance flag, timestamps.

- **NOT-01**: In-app notifications delivered to role queues; unread badge shown.
- **NOT-02**: Email notifications sent for key events (issuance, finance decisions).
- **NOT-03**: Notifications cannot be deleted; only marked as read.
- **NOT-04**: Notification content and links are role-appropriate.
- **NOT-05**: Notifications are scoped by role (e.g., BU_MANAGER, UNIT_STAFF, WAREHOUSE_MANAGER, FINANCE_MANAGER).

- **ADM-01**: Admin manages users (create, deactivate, assign role/SBU/unit) via UI and CSV bulk import.
- **ADM-02**: Admin manages SBUs and SBU Units.
- **ADM-03**: Admin manages the product catalogue including warehouse locations.
- **ADM-04**: Admin configures finance approval thresholds in settings.
- **ADM-05**: Admin and Warehouse Manager can view the full audit log with filtering.
- **ADM-06**: Admin can view variance disposition registry and damage ledger.
- **ADM-07**: Admin exports data as CSV for any 90-day range.
- **TRF-08..TRF-15**: Issuance rules — see TRF-09 through TRF-14 above.

- **GRN-01..GRN-08**: See GRN-01 through GRN-07 above.

- **NOT-01..NOT-05**: See NOT-01 through NOT-05 above.

- **ADM-01..ADM-06**: See ADM-01 through ADM-07 above.

### Key Entities

- `User` — auth.users + `profiles` (id, full_name, role, sbu_id, unit_id, is_active)
- `SBU` — Strategic Business Unit (id, name, code)
- `SBUUnit` — Sub-unit/department within an SBU (id, name, code, sbu_id, is_active)
- `Product` — (id, name, sku, description, unit_of_measure, stock_quantity, low_stock_threshold, unit_cost, warehouse_location `[A-Z][1-2]`, is_active)
- `TransferRequest` — (id, reference_number `TRF-YYYY-NNNNN`, sbu_id, requesting_unit_id, status, required_date, notes, estimated_value, requires_finance_approval, approved_by, approved_at, bu_approved_at, finance_approval_notes, raised_by)
- `TransferLineItem` — (id, transfer_request_id, product_id, quantity_requested)
- `Issuance` — (id, transfer_request_id, issued_by, issue_date, logistics_notes)
- `IssuanceLineItem` — (id, issuance_id, product_id, quantity_issued, shortfall_reason)
- `GRN` — (id, transfer_request_id, received_by, date_received, condition_notes, has_variance, acknowledged)
- `GRNLineItem` — (id, grn_id, product_id, issued_quantity, quantity_received, variance_notes)
- `SupplierGRN` — (id, reference_number, supplier_name, supplier_invoice_reference, invoice_amount, date_received, status `AWAITING_FINANCE_APPROVAL | GRN_APPROVED | GRN_REJECTED`, sbu_id)
- `SupplierGRNLineItem` — (id, supplier_grn_id, product_id, quantity_received, unit_cost)
- `ReturnRequest` — (id, reference_number `RTN-YYYY-NNNNN`, sbu_id, original_transfer_request_id, status `PENDING_APPROVAL | APPROVED | RECEIVED | REJECTED`, reason, notes, raised_by, approved_by, received_by)
- `ReturnLineItem` — (id, return_request_id, product_id, quantity_to_return, quantity_received)
- `VarianceDisposition` — (id, transfer_request_id, grn_id, grn_line_item_id, product_id, sbu_id, quantity_variance, disposition `WRITE_BACK | LOSS`, decided_by, decided_at, notes)
- `StockLoss` — (id, reference_number, variance_disposition_id, transfer_request_id, product_id, sbu_id, quantity_lost, unit_cost_at_loss, value_lost, decided_by, decided_at)
- `DamageLedger` — (id, product_id, quantity, unit_cost_at_writeoff, estimated_value, writeoff_reason, written_off_by, written_off_at)
- `DamageRecall` — (id, damage_ledger_id, initiated_by, status `PENDING | IN_TRANSIT | RECEIVED`, notes, received_by, received_at)
- `TransactionDocument` — (id, transaction_type, transaction_id, storage_path, file_name, file_size, mime_type, document_label, uploaded_by)
- `Notification` — (id, user_role, type, message, related_entity_id, is_read, created_at)
- `AuditLog` — (id, entity_type, entity_id, action, performed_by, previous_value, new_value, created_at)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the transfer request flow (request → BU approval → finance approval if applicable → issuance → GRN) end-to-end in under 10 minutes from initiation to finalisation.
- **SC-002**: 95% of `APPROVED_FOR_ISSUE` requests are actioned (ISSUED or CANCELLED) within 48 hours during business days.
- **SC-003**: 95% of in-app notifications are delivered and visible in the user's notification panel within 30 seconds of triggering.
- **SC-004**: System retains transfer and audit records for a minimum of 3 years and can export CSVs for any 90-day range.
- **SC-005**: All variance lines on a `COMPLETED_WITH_VARIANCE` transfer are dispositioned (WRITE_BACK or LOSS) before the transfer is considered fully closed.
- **SC-006**: Stock levels are never negative; the `process_issuance` and `process_return_receipt` RPCs enforce atomicity.

## Assumptions

- Product catalogue seeded or entered before go-live.
- Each SBU has at least one BU Manager, one Unit Staff member, and at least one SBU Unit at launch.
- One Warehouse Manager account in v1.0.
- One Finance Manager account in v1.0.
- Users have internet access during business hours.
- Email delivery is relied upon for external alerts.
- Supabase Storage bucket `hgl-wms` is provisioned for document attachments.

## Open Questions (prioritised)

1. OQ-01: Confirmed application name? (Branding/email sender) — _pending_
2. OQ-04: Recurring / standing transfer requests needed? — _pending, deferred to v2_
3. OQ-05: Multi-warehouse in v2? — **Resolved**: Option B — single warehouse v1, extensible data model (see below).

## Resolved Decisions

### Decision: Multi-Warehouse Extensibility (OQ-05 — Resolved)

- Add an optional `warehouse_id` FK to relevant entities (`TransferRequest`, `Issuance`, `Product` where applicable) but make it nullable and default to the single warehouse in v1.0.
- Encapsulate warehouse-specific logic behind repository/service interfaces to allow adding `warehouse_id` filters with minimal code changes.
- Document migrations and data population steps required to activate multi-warehouse mode in v2.

Status: OQ-05 — Resolved (kept for v1, extensible path chosen)

## Data Model (reference)

See the Data Models section in the provided specification for detailed attributes for `User`, `SBU`, `Product`, `TransferRequest`, `TransferLineItem`, `Issuance`, `IssuanceLineItem`, `GRN`, `GRNLineItem`, `Notification`, `AuditLog`.

## Next Steps

1. Confirm Open Questions OQ-01, OQ-04, OQ-05 with stakeholders.
2. Create Phase 1 plan: foundational tasks (auth, RBAC, database schema, migrations).
3. Seed product catalogue and create initial SBUs and admin account for testing.
