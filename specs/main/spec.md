# Feature Specification: Warehouse Transfer Management System

**Feature Branch**: `001-warehouse-transfer`
**Created**: 2026-05-20
**Last Updated**: 2026-07-03
**Status**: Active Development
**Version**: 3.0
**Input**: User-provided specification and updated Constitution (Harvest WMS); reconciled against implemented codebase as of migration `023_purchase_requests.sql`

> **v3.0 note**: This revision reconciles the spec against the actual implemented codebase. It adds the Purchase Request → External Procurement → Internal Control procurement pipeline, Intra-Warehouse Transfers, the Finance-reviewed Variance Proposals mechanism, direct Damage Write-offs, and the Expiry Ledger — none of which were previously documented here. See **Known Gaps & Technical Debt** for discrepancies found between this spec and the running code.

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

### User Story 5 - Variance Disposition (Priority: P1) — RETIRED 2026-07-03

> **Status: Retired.** This BU Manager disposition flow has been superseded by User Story 12
> (Variance Proposals & Finance Review) as the sole variance-resolution mechanism — see GAP-02
> resolution below. The `/variance` page, `POST /api/bu/variance/[id]/disposition` route, and
> the underlying `variance_dispositions`/`stock_losses` tables and `process_variance_disposition`
> RPC have been removed from active use but are kept in the schema for historical audit access.
> The description below is preserved for historical reference only.

As a BU Manager, I want to decide how to handle quantity variances detected in a GRN — either writing them back as a stock correction or recording them as a confirmed stock loss.

**Implementation notes**: After a `COMPLETED_WITH_VARIANCE` GRN, the BU Manager visits the variance queue and makes a per-line disposition decision: `WRITE_BACK` (stock credited back to warehouse) or `LOSS` (written to the `stock_losses` ledger with financial value captured). This is executed atomically via the `process_variance_disposition` RPC.

**Acceptance Scenarios** (historical — no longer reachable in the UI):

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

### User Story 9 - Purchase Requests & Procurement Pipeline (Priority: P1)

As a BU Manager, I want to raise a purchase request for goods that are out of stock or not yet in the catalogue, route it to an external procurement contact for pricing/supplier confirmation, and have Admin give final internal-control sign-off before it becomes an expected order for the warehouse.

**Implementation notes**: A purchase request (`purchase_requests`) is created as `DRAFT`, then submitted (`PENDING_PROCUREMENT_APPROVAL`). A single-use, expiring, hashed token (`external_action_tokens`) is emailed to the named procurement contact — no WMS login required (see User Story 10). Procurement's decision routes to Admin (`PENDING_INTERNAL_CONTROL_APPROVAL`) or back to the BU Manager for edits (`PROCUREMENT_CHANGES_REQUESTED`) or terminates it (`REJECTED`). Admin's internal-control approval moves it to `EXPECTED_ORDER`, which then appears in the Warehouse Manager's Expected Orders list to be received via a Supplier GRN (User Story 4).

**Independent Test**: Raise a purchase request as BU Manager, submit it, action it as the external procurement contact via the emailed token link, then approve it as Admin; verify it appears in the Warehouse Manager's Expected Orders queue.

**Acceptance Scenarios**:

1. Given a BU Manager fills in line items and a procurement contact email, when they submit, a `PR-` reference is created with status `PENDING_PROCUREMENT_APPROVAL` and a token-based review link is emailed to the procurement contact.
2. Given `PROCUREMENT_CHANGES_REQUESTED`, the BU Manager can edit and resubmit, generating a new (or reused) token link.
3. Given Admin approves at internal control, the request becomes `EXPECTED_ORDER` and the Warehouse Manager is notified.
4. Given Admin rejects at internal control, the request becomes `INTERNAL_CONTROL_REJECTED` and the requester is notified.

---

### User Story 10 - External Procurement Approval (No-Login Token Link) (Priority: P1)

As an external procurement contact (no WMS account), I want to review a purchase request via a secure emailed link and approve, reject, or request changes, without needing to log in.

**Implementation notes**: Tokens are single-use for terminal actions (`APPROVE`/`REJECT` consume the token) but **not** consumed by `CHANGES_REQUESTED`, allowing iterative back-and-forth. Tokens expire and can be revoked; expired/used/revoked/not-found tokens return a user-friendly HTTP 410 page. Every external action is written to the audit log against `actor_email` (no `performed_by` user id) and triggers a confirmation email.

**Independent Test**: Open a token link, submit a REJECT action, verify the token cannot be reused and the purchase request status becomes `REJECTED`.

**Acceptance Scenarios**:

1. Given a valid, unexpired token, when the external contact opens the link, they see the redacted purchase request and the actions allowed by that token (`APPROVE`, `REJECT`, `CHANGES_REQUESTED`, optionally `UPLOAD`).
2. Given the contact clicks Approve, the token is marked used and the request advances to `PENDING_INTERNAL_CONTROL_APPROVAL`.
3. Given an expired, already-used, or revoked token, the page shows an error and no action can be taken.

---

### User Story 11 - Intra-Warehouse Transfers (Priority: P2)

As a Warehouse Manager, I want to directly reassign stock from the warehouse pool (or one SBU) to another SBU without going through the full transfer-request lifecycle, subject to Finance approval.

**Implementation notes**: `intra_warehouse_transfers` is a single-step operation (no BU-approval step) raised by the Warehouse Manager. It enters `PENDING_FINANCE_APPROVAL`; stock is only decremented when Finance approves, via the `process_intra_transfer`/`approve_intra_transfer` RPC, which also notifies the receiving SBU's BU Manager.

**Independent Test**: Create an intra-warehouse transfer to a target SBU as Warehouse Manager; verify stock is unchanged until a Finance Manager approves it, at which point stock decrements and the destination BU Manager is notified.

**Acceptance Scenarios**:

1. Given sufficient stock, when the Warehouse Manager submits an intra-warehouse transfer, an `IWT-YYYY-NNNNN` reference is created with status `PENDING_FINANCE_APPROVAL`.
2. Given Finance approves, stock is decremented atomically and the transfer becomes `COMPLETED`.
3. Given Finance rejects, the transfer becomes `CANCELLED` and stock is untouched.

---

### User Story 12 - Variance Proposals & Finance Review (Priority: P1)

As a Finance Manager, I want to review auto-raised variance proposals from GRN receipt discrepancies and decide, per line, whether the variance should be written off as damage or reintegrated into stock.

**Implementation notes**: When Unit Staff submits a GRN with a quantity mismatch (User Story 3), the system **automatically** raises a `variance_proposals` record (status `PENDING_FINANCE_REVIEW`) — this is now the **sole** variance-resolution mechanism (see GAP-02 resolution; the former parallel BU Manager disposition flow, User Story 5, was retired 2026-07-03). Each `variance_proposal_lines` row carries a system-recommended `recommended_resolution` (`damage_writeoff` for a shortage, `stock_reintegration` for an excess), which the Finance Manager can override with a `finance_decision` before approving. Approved `damage_writeoff` lines are written to `damage_ledger` (surfaced on the Loss Account page); approved `stock_reintegration` lines increment product stock. On approval, the `execute_variance_resolution` RPC also closes the transfer back to `COMPLETED`.

**Independent Test**: Submit a GRN with a shortfall as Unit Staff; verify a variance proposal appears in the Finance queue with a recommended `damage_writeoff`; approve it and verify a `damage_ledger` entry is created.

**Acceptance Scenarios**:

1. Given a GRN with a quantity mismatch, a `variance_proposals` row and matching `variance_proposal_lines` are auto-created and the Finance Manager is notified.
2. Given the Finance Manager approves with no overrides, each line's `recommended_resolution` is executed (damage write-off or stock reintegration).
3. Given the Finance Manager overrides a line's decision, the `finance_decision` is executed instead of the `recommended_resolution`.
4. Given the Finance Manager rejects the proposal, no stock or ledger changes occur.

---

### User Story 13 - Direct Damage Write-off (Priority: P2)

As an Admin, Warehouse Manager, or Finance Manager, I want to write off damaged stock directly from the product catalogue during a routine inspection, without needing a prior variance proposal.

**Implementation notes**: Triggered via the Flame icon / `DamageWriteOffModal` on the Admin and Finance catalogue pages. Creates a `damage_ledger` row with `source_type = 'direct_writeoff'` and `proposal_line_id = NULL` (distinguishing it from proposal-sourced write-offs), and atomically decrements stock via `process_direct_damage_writeoff`.

**Acceptance Scenarios**:

1. Given a product with available stock, when an authorised user submits a quantity and reason via the write-off modal, stock is decremented and a `damage_ledger` entry with `source_type = 'direct_writeoff'` is created.
2. The resulting damage ledger entry can subsequently be recalled to the warehouse via the existing Damage Recall flow (User Story 7).

---

### User Story 14 - Expiry Write-off (Priority: P2)

As an Admin or Warehouse Manager, I want to record expired stock as a permanent loss so it is removed from available inventory and its financial value is captured.

**Implementation notes**: Writes to `expiry_ledger` with a locked-in `unit_cost_at_expiry`/`value_expired` snapshot and optional traceability back to the originating `supplier_grn_line_item_id`. Read access (ledger view at `/admin/expiry`) is available to ADMIN, WAREHOUSE_MANAGER, and FINANCE_MANAGER; write access is ADMIN/WAREHOUSE_MANAGER only.

**Acceptance Scenarios**:

1. Given a product batch identified as expired, when an authorised user records the expiry with a quantity and expiry date, an `expiry_ledger` entry is created and stock is decremented.
2. The expiry ledger is filterable by date range and product/search term.

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
- **DMG-05**: Admin, Warehouse Manager, and Finance Manager can record a direct damage write-off from the product catalogue (no prior variance proposal required); stock is decremented atomically via `process_direct_damage_writeoff`.
- **DMG-06**: Direct write-offs are tagged `source_type = 'direct_writeoff'` in `damage_ledger`, distinct from `source_type = 'variance_proposal'` entries originated by Finance-approved variance proposals.

- **PR-01**: BU Manager can create a purchase request with one or more line items (existing product or free-text description), a required procurement contact email, and optional supplier name/email and notes.
- **PR-02**: Purchase requests receive a unique `PR-` reference and start as `DRAFT`, editable until submitted.
- **PR-03**: On submit, status becomes `PENDING_PROCUREMENT_APPROVAL` and a single-use external review link is emailed to the procurement contact.
- **PR-04**: External procurement approval advances the request to `PENDING_INTERNAL_CONTROL_APPROVAL`; rejection sets `REJECTED`; requesting changes sets `PROCUREMENT_CHANGES_REQUESTED` and returns it to the BU Manager for edits/resubmission.
- **PR-05**: Admin (internal control) approves (`EXPECTED_ORDER`) or rejects (`INTERNAL_CONTROL_REJECTED`) requests in `PENDING_INTERNAL_CONTROL_APPROVAL`.
- **PR-06**: `EXPECTED_ORDER` requests appear in the Warehouse Manager's Expected Orders queue and can be linked to a Supplier GRN via `supplier_grns.purchase_request_id`.
- **PR-07**: Requesters, Admin, and Warehouse Manager are notified at each status transition relevant to their role.
- **PR-08**: Purchase requests are scoped to the requester's SBU.

- **EXT-01**: External (non-WMS-login) actors act on a purchase request only via a hashed, expiring, single-use token emailed to the named contact.
- **EXT-02**: `APPROVE` and `REJECT` actions consume (invalidate) the token; `CHANGES_REQUESTED` does not, allowing repeated review cycles on the same request.
- **EXT-03**: Expired, used, or revoked tokens return a clear error and permit no further action.
- **EXT-04**: Every external action is recorded in the audit log against the actor's email address and triggers a confirmation email.
- **EXT-05**: Token-scoped `allowed_actions` determine which buttons/actions (including optional document upload) are available to the external actor.

- **INTRA-01**: Warehouse Manager can create a direct intra-warehouse transfer of a product from the warehouse pool (or a source SBU) to a destination SBU, without a multi-step approval chain.
- **INTRA-02**: Intra-warehouse transfers receive a unique `IWT-YYYY-NNNNN` reference and start as `PENDING_FINANCE_APPROVAL`.
- **INTRA-03**: Stock is not decremented until a Finance Manager approves; approval executes atomically via `process_intra_transfer`/`approve_intra_transfer` and notifies the destination SBU's BU Manager.
- **INTRA-04**: Finance Manager rejection sets status `CANCELLED` and leaves stock unchanged.
- **INTRA-05**: Attempting to transfer more than available stock is blocked.

- **VARP-01**: When a GRN is submitted with a quantity mismatch, the system automatically raises a `variance_proposals` record with per-line `recommended_resolution` (`damage_writeoff` for a shortage, `stock_reintegration` for an excess) and notifies the Finance Manager.
- **VARP-02**: Finance Manager may override any line's resolution via `finance_decision` before approving.
- **VARP-03**: On approval, `damage_writeoff` lines are written to `damage_ledger` and `stock_reintegration` lines increment product stock, executed per the approved decisions.
- **VARP-04**: On rejection, no stock or ledger changes occur.
- **VARP-05**: Only one `PENDING_FINANCE_REVIEW` proposal may exist per transfer request at a time.

- **EXPIRY-01**: Admin or Warehouse Manager can record expired stock with quantity, expiry date, and optional notes, decrementing stock and creating an `expiry_ledger` entry.
- **EXPIRY-02**: The expiry ledger snapshots `unit_cost_at_expiry` and `value_expired` at the time of write-off.
- **EXPIRY-03**: Admin, Warehouse Manager, and Finance Manager can view the expiry ledger, filterable by date range and product/search term.
- **EXPIRY-04**: Expiry entries may optionally trace back to the originating supplier GRN line item.

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
- `DamageLedger` — (id, product_id, quantity, unit_cost_at_writeoff, estimated_value, writeoff_reason, written_off_by, written_off_at, source_type `variance_proposal | direct_writeoff`, proposal_line_id nullable)
- `DamageRecall` — (id, damage_ledger_id, initiated_by, status `PENDING | IN_TRANSIT | RECEIVED`, notes, received_by, received_at)
- `TransactionDocument` — (id, transaction_type, transaction_id, storage_path, file_name, file_size, mime_type, document_label, uploaded_by)
- `Notification` — (id, user_role, type, message, related_entity_id, is_read, created_at)
- `AuditLog` — (id, entity_type, entity_id, action, performed_by, previous_value, new_value, created_at)
- `PurchaseRequest` — (id, reference_number `PR-`, sbu_id, created_by, status, supplier_name, supplier_email, procurement_email, notes, estimated_total, procurement_actioned_at, procurement_action, procurement_notes, procurement_document_url, internal_control_actioned_by, internal_control_actioned_at, internal_control_action, internal_control_notes)
- `PurchaseRequestLineItem` — (id, purchase_request_id, product_id nullable, product_name, sku, quantity_requested, unit_cost, unit_of_measure, notes)
- `ExternalActionToken` — (id, token_hash, entity_type, entity_id, actor_email, actor_type, allowed_actions[], expires_at, used_at, revoked_at, created_by, last_viewed_at, last_actor_ip, last_user_agent)
- `IntraWarehouseTransfer` — (id, reference_number `IWT-YYYY-NNNNN`, product_id, quantity, from_sbu_id nullable, to_sbu_id, transferred_by, transfer_date, status `PENDING_FINANCE_APPROVAL | COMPLETED | CANCELLED`, notes)
- `VarianceProposal` — (id, transfer_request_id, grn_id, proposed_by, proposal_notes, status `PENDING_FINANCE_REVIEW | APPROVED | REJECTED`, reviewed_by, reviewed_at, review_notes)
- `VarianceProposalLine` — (id, proposal_id, grn_line_item_id, product_id, variance_quantity (signed), recommended_resolution `damage_writeoff | stock_reintegration`, finance_decision, finance_decision_notes)
- `ExpiryLedger` — (id, reference_number, product_id, supplier_grn_line_item_id nullable, quantity_expired, expiry_date, unit_cost_at_expiry, value_expired, currency, expired_by, expired_at, notes)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the transfer request flow (request → BU approval → finance approval if applicable → issuance → GRN) end-to-end in under 10 minutes from initiation to finalisation.
- **SC-002**: 95% of `APPROVED_FOR_ISSUE` requests are actioned (ISSUED or CANCELLED) within 48 hours during business days.
- **SC-003**: 95% of in-app notifications are delivered and visible in the user's notification panel within 30 seconds of triggering.
- **SC-004**: System retains transfer and audit records for a minimum of 3 years and can export CSVs for any supported date range.
- **SC-005**: All variance lines on a `COMPLETED_WITH_VARIANCE` transfer are dispositioned (WRITE_BACK or LOSS) before the transfer is considered fully closed.
- **SC-006**: Stock levels are never negative; `process_issuance` and `process_return_receipt` RPCs enforce atomicity.
- **SC-007**: A purchase request can move from `DRAFT` to `EXPECTED_ORDER` (external procurement approval + Admin internal control) without any party needing a WMS login other than the originating BU Manager and the approving Admin.

## Known Gaps & Technical Debt

These are discrepancies between intended design and the current implementation, found while reconciling this spec against the codebase (2026-07-03). They are documented here rather than silently "fixed" in the spec so the team can decide intentionally:

- **GAP-01 (Route authorization)**: [components/AuthGuard.tsx](../../components/AuthGuard.tsx) only clears the session and redirects on a `401` from an API call — it does **not** perform role-based route protection, and there is no `middleware.ts`. Any authenticated user can navigate directly to another role's page URL; the page will render (possibly with empty data) until an API call 403s. Authorization is correctly enforced at the API layer, but the UX gap means a curious user could see another role's screen layout. Recommendation: add a `middleware.ts` role-route allowlist, or a per-page role check in `DashboardLayout`.
- **GAP-02 (Duplicate variance-resolution mechanisms) — RESOLVED 2026-07-03**: A single event — Unit Staff submitting a GRN with a quantity mismatch — used to trigger **two** parallel variance-handling paths: (1) the legacy BU Manager disposition flow (`variance_dispositions`/`stock_losses`, `/variance` page, User Story 5), and (2) the auto-raised, Finance-reviewed `variance_proposals` flow (User Story 12). Resolution: the BU Manager disposition path has been retired; the Finance-reviewed Variance Proposal flow (User Story 12) is now the sole official mechanism. The `execute_variance_resolution` RPC already closed the transfer to `COMPLETED` on approval, so no data-integrity gap existed there. The legacy `variance_dispositions`/`stock_losses` tables and `process_variance_disposition` RPC are kept in the schema (unused) for historical audit access; the Loss Account page was repointed from `stock_losses` to `damage_ledger` (`source_type = 'variance_proposal'`) so it continues to reflect live data.
- **GAP-03 (Export/audit dev fallbacks)**: [app/admin/exports/page.tsx](../../app/admin/exports/page.tsx) and [app/admin/audit/page.tsx](../../app/admin/audit/page.tsx) fall back to mocked/simulated data when their respective API calls fail, rather than surfacing an error. This is convenient in development but risks a user mistaking mock data for a real export/audit result in production; recommend removing the fallback (or gating it behind a dev-only flag) before go-live.
- **GAP-04 (No supplier self-service GRN)**: There is no external/token-based goods-receipt flow for suppliers — despite the naming similarity, `/grn/submit` is an authenticated, in-app UNIT_STAFF flow for internal transfer receipts, unrelated to supplier deliveries. All supplier goods receipt is recorded internally by the Warehouse Manager via the Supplier GRN screen. If external supplier self-service is desired, it does not exist yet.

## Assumptions

- Product catalogue seeded or entered before go-live.
- Each SBU has at least one BU Manager, one Unit Staff member, and at least one SBU Unit at launch.
- One Warehouse Manager account in v1.0.
- One Finance Manager account in v1.0.
- Users have internet access during business hours.
- Email delivery is relied upon for external alerts, including the external procurement approval link.
- Supabase Storage bucket `hgl-wms` is provisioned for document attachments.
- Only one named procurement contact per purchase request receives the external approval token at a time.

## Open Questions

1. **OQ-01**: Confirmed application name? (Branding/email sender) — _pending_
2. **OQ-04**: Recurring / standing transfer requests needed? — _deferred to v2_
3. **OQ-05**: Multi-warehouse in v2? — **Resolved** (Option B — see below)
4. **OQ-06**: Should the legacy BU Manager variance disposition flow (`/variance`) be retired now that Finance-reviewed variance proposals cover the same event? — **Resolved 2026-07-03**: Yes — retired in favor of the Finance Variance Proposal flow (see GAP-02 resolution).

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
- `013_expiry_dates.sql` — Expiry date tracking columns on products/supplier GRN line items
- `014_return_finance_approval.sql` — Adds Finance approval gate to return receipt (`AWAITING_FINANCE_APPROVAL`, `process_return_stock_credit` RPC)
- `015_expiry_ledger.sql` — `expiry_ledger` table and RLS
- `016_intra_warehouse_transfers.sql` — `intra_warehouse_transfers` table and `process_intra_transfer` RPC
- `017_direct_damage_writeoff.sql` — `source_type` discriminator on `damage_ledger` and `process_direct_damage_writeoff` RPC
- `018_variance_resolution_notes.sql` — Additional notes columns for variance resolution
- `019_sbu_stock.sql` — Per-SBU stock view
- `020_sbu_stock_include_supplier_grns.sql` — Extends SBU stock view to include supplier GRN receipts
- `021_sbu_stock_sku_tagged.sql` — SKU-prefix tagging for SBU stock view
- `022_intra_transfer_finance_approval.sql` — Finance approval gate + `approve_intra_transfer` RPC for intra-warehouse transfers
- `023_purchase_requests.sql` — `purchase_requests`, `purchase_request_line_items`, `external_action_tokens` tables; links `supplier_grns.purchase_request_id`


