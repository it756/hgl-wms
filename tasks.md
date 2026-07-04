# Developer 1: Operational Flow (BU, Unit, Warehouse)

Use this list for the operational workstream. Developer 2 governance/platform tasks are excluded from this file and should be tracked separately.

## 1. Login and Role Routing

- Sign in as BU Manager, Unit Staff, and Warehouse Manager.
- Verify each role lands on the correct dashboard or queue.
- Verify logout and forced redirect on missing or expired token.

## 2. Transfer Request Lifecycle

- BU Manager creates a transfer with multiple line items.
- Validate required fields, quantity rules, and reference generation.
- Verify edit and cancel behavior before issuance.
- View request details and status transitions.

## 3. Warehouse Issuance

- Warehouse Manager sees pending and approved requests in the queue.
- Issue full quantities and confirm status becomes issued.
- Issue partial quantities with shortfall reason.
- Validate stock decrement and insufficient-stock rejection path.

## 4. Unit GRN Submission

- Unit Staff submits GRN for an issued transfer.
- Verify exact receipt path results in completed status.
- Verify variance path results in completed with variance status and reason capture.
- Ensure transfer and GRN are immutable after submission.

## 5. Return Request Flow

- Unit Staff raises returns for linked and unlinked cases.
- BU Manager approves and rejects returns.
- Warehouse receives return and confirms stock restoration behavior.
- Validate status transitions end to end.

## 6. Notifications (Operational)

- Verify in-app notifications for transfer submitted, issuance, GRN variance, and return actions.
- Confirm unread/read behavior and role-appropriate visibility.

# Shared Smoke Pass at End

Both developers should run this together after their individual workstreams.

1. Cross-role end-to-end happy path from transfer creation to closure.
2. One full rejected path, either finance reject or return reject.
3. One full variance path.
4. Verify notifications and audit entries exist for each major event.
