# Feature Specification: Warehouse Transfer Management System

**Feature Branch**: `001-warehouse-transfer`
**Created**: 2026-05-20
**Status**: Working Draft
**Version**: 1.1
**Input**: User-provided specification and updated Constitution (Harvest WMS)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Raise Transfer Request (Priority: P1)

As a Business Unit Manager, I want to raise a transfer request for one or more products so that my unit can receive goods from the central warehouse.

**Why this priority**: Core business flow enabling transfers; required for any downstream workflows.

**Independent Test**: Create a new transfer request with multiple line items and verify it appears as `PENDING` with a generated `TRF-` reference. Verify Warehouse Manager receives notification.

**Acceptance Scenarios**:

1. Given a logged-in BU Manager, when they submit a transfer with valid quantities, then the system creates a `TRF-YYYY-NNNNN` reference and marks it `PENDING`.
2. Given the request is created, when the Warehouse Manager views the queue, then the request is visible and not editable by the BU Manager.

---

### User Story 2 - Record Goods Issuance (Priority: P1)

As the Warehouse Manager, I want to record issued quantities against a `PENDING` request so stock is decremented and the SBU is notified.

**Independent Test**: Record issuance for a `PENDING` request; verify stock decremented, status becomes `ISSUED`, and notifications are sent.

**Acceptance Scenarios**:

1. Given a `PENDING` request, when the Warehouse Manager records issuance, then the request becomes `ISSUED` and issued quantities are immutable.
2. If issued < requested for any line, then a reason is recorded and the issuance is accepted.

---

### User Story 3 - Submit GRN (Priority: P1)

As Unit Staff, I want to acknowledge receipt via a GRN so the transfer can be closed and variances recorded.

**Independent Test**: Submit GRN for an `ISSUED` transfer; verify status transitions to `COMPLETED` or `COMPLETED WITH VARIANCE` and that variances notify the Warehouse Manager.

**Acceptance Scenarios**:

1. Given an `ISSUED` transfer, when Unit Staff confirms exact quantities, then the status becomes `COMPLETED`.
2. Given an `ISSUED` transfer, when Unit Staff reports quantity differences, then the status becomes `COMPLETED WITH VARIANCE` and Warehouse Manager is notified.

---

### User Story 4 - Finance Approval & Supplier GRN (Priority: P1)

As a Business Unit Manager, I want transfers above configured monetary thresholds to be approved by a Finance Manager before the Warehouse Manager can issue goods, so that financial oversight and budget controls are enforced.

As a Warehouse Manager, when goods are received from suppliers into the central warehouse I want to record a Supplier Goods Received Note (GRN) and have the Finance Manager approve the GRN before stock levels attributable to an SBU are increased.

**Independent Tests**:

**Acceptance Scenarios**:
1. Given a transfer requiring finance approval, when the Finance Manager approves, then the transfer moves to `APPROVED_FOR_ISSUE` and the Warehouse Manager may record an issuance.
2. Given a Supplier GRN recorded by the Warehouse Manager, when Finance Manager approves, then stock levels are incremented and `GRN_APPROVED` status is recorded; if Finance rejects, the GRN remains flagged and stock is not changed.

**Notes**: Add monetary metadata to `TransferRequest` (e.g., `estimated_value`, `requires_finance_approval` boolean) and to `GRN` (e.g., `supplier_invoice_reference`, `invoice_amount`) to support approvals and auditability.


## Finance Approval Configuration

- `finance_approval_threshold` (numeric): monetary threshold above which transfer requests require Finance Manager approval before issuance. Default: `1000` (application base currency). This is an admin-configurable value and may be overridden per-SBU by administrators.
- `finance_approval_scope`: either `global` or `per_sbu` (default `global`). If `per_sbu`, SBUs may set custom thresholds via Admin UI.

Acceptance behavior:
- Transfers with `estimated_value >= finance_approval_threshold` and `requires_finance_approval = true` must enter `PENDING_APPROVAL` and remain non-issuable until approved by a Finance Manager.
### Edge Cases

- Attempt to raise a request for another SBU — must be blocked.
- Attempt to issue more stock than available — Warehouse Manager must be prevented and request rejected with reason.
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

- **INV-01**: Admin/Warehouse Manager can add products with full metadata.
- **INV-02**: Warehouse Manager can adjust stock with mandatory reason; audit recorded.
- **INV-03**: Stock adjustments logged with previous/new quantities.
- **INV-04**: BU Managers view read-only active product catalogue when raising requests.
- **INV-05**: Products can be soft-deactivated; hidden from new requests.
- **INV-06**: Configurable low-stock threshold triggers in-app alert to Warehouse Manager.
- **INV-07**: Stock decremented on issuance; GRN is acknowledgement only.

- **TRF-01..TRF-07**: Transfer creation rules (multi-line items, unique ref, PENDING status, cancel allowed pre-issuance, immutable after submission, SBU scoping).
- **TRF-08..TRF-15**: Issuance rules (queue, inline stock view, record issuance, shortfall reason required, stock decrement, status `ISSUED`, notifications, immutability).

- **GRN-01..GRN-08**: GRN rules (Unit Staff views ISSUED transfers, submit GRN with received quantities, acknowledgement checkbox, status transitions, variance notification, locked records, no partial GRN in v1.0).

- **NOT-01..NOT-05**: Notifications delivered in-app and email; unread badge; cannot delete notifications; role-appropriate content and links.

- **ADM-01..ADM-06**: Admin features (user/SBU management, settings, exports, audit log filtering).

### Key Entities

- `User`, `SBU`, `Product`, `TransferRequest`, `TransferLineItem`, `Issuance`, `IssuanceLineItem`, `GRN`, `GRNLineItem`, `Notification`, `AuditLog`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the transfer request flow (request → issuance → GRN) end-to-end in under 10 minutes from initiation to finalisation.
- **SC-002**: 95% of PENDING requests are actioned (ISSUED or CANCELLED) within 48 hours during business days.
- **SC-003**: 95% of in-app notifications are delivered and visible in the user's notification panel within 30 seconds of triggering.
- **SC-004**: System retains transfer and audit records for a minimum of 3 years and can export CSVs for any 90-day range.

## Assumptions

- Product catalogue seeded or entered before go-live.
- Each SBU has at least one BU Manager and one Unit Staff at launch.
- One Warehouse Manager account in v1.0.
- Users have internet access during business hours.
- Email delivery is relied upon for external alerts.

## Open Questions (prioritised)

1. OQ-01: Confirmed application name? (Branding/email sender)
2. OQ-05: Is multi-warehouse planned for v2? (affects data model extensibility)
3. OQ-04: Recurring / standing transfer requests needed? (affects TRF complexity)

## Decision: Multi-Warehouse Extensibility

Decision: Option B — Keep a single warehouse for v1.0 but design the data model and code paths to be easily extensible for multi-warehouse support in v2. Concretely:

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
