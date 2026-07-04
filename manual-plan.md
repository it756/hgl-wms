# Manual Test Plan: Developer 1 Operational Flow

This plan validates the `tasks.md` scope for BU Manager, Unit Staff, and Warehouse Manager. Developer 2 governance/platform checks are intentionally excluded except where the shared smoke pass needs Finance to move an operational flow forward.

## Setup

- Start the app with `npm run dev`.
- Open `http://localhost:3000`.
- Use seeded users:
  - BU Manager: `manager.jara@hgl-wms.com`
  - Unit Staff: `staff.jara@hgl-wms.com`
  - Warehouse Manager: `warehouse@hgl-wms.com`
  - Finance Manager: `finance@hgl-wms.com`
  - Password for all: `Demo@1234!`
- Use products with enough stock for normal transfers, and keep one low-stock product available for insufficient-stock checks.

## Requirements Matrix

| Requirement | Role Needed | Starting Data Needed | Manual Steps | Expected Result | Automated Coverage |
| --- | --- | --- | --- | --- | --- |
| Login and role routing | BU Manager, Unit Staff, Warehouse Manager | Seeded users | Sign in as each role, verify dashboard, sign out, then remove token and refresh a protected page | BU/Unit land on `/requests`, Warehouse lands on `/warehouse/queue`, logout and missing/expired token return to login | `core-task-01-auth-routing.test.ts` |
| Transfer request lifecycle | BU Manager | Active SBU unit and products | Create multi-line transfer, test empty/invalid quantities, open details, edit before issuance, cancel before issuance | `TRF-YYYY-NNNNN` reference appears; validations block bad input; details show status and lines; edit/cancel only work before issuance | `core-task-02-transfer-lifecycle.test.ts` |
| Warehouse issuance | Warehouse Manager | Finance-approved transfer | Confirm approved transfer in queue, issue full quantities, issue partial quantity with shortfall reason, try insufficient stock | Full and partial issuance succeed through stock RPC; shortfall reason is captured; insufficient stock is rejected | `core-task-03-warehouse-issuance.test.ts` |
| Unit GRN submission | Unit Staff | Issued transfer | Submit exact GRN, then submit variance GRN with notes, then try to resubmit or mutate completed GRN | Exact receipt completes transfer; variance marks completed with variance; completed receipts cannot be resubmitted or mutated | `core-task-04-grn-submission.test.ts` |
| Return request flow | Unit Staff, BU Manager, Warehouse Manager | Completed transfer and returnable product | Raise linked and unlinked return, approve/reject as BU Manager, receive approved return as Warehouse | Returns get `RTN-YYYY-NNNNN`; approval/rejection statuses update; warehouse receipt moves return to Finance stock-credit stage | `core-task-05-return-request-flow.test.ts` |
| Operational notifications | BU Manager, Unit Staff, Warehouse Manager | Transfer, issuance, variance GRN, return actions | Check `/notifications` after each major event and mark a notification read | Role-appropriate notifications appear; unread/read behavior is scoped to direct or role-visible records | `core-task-06-notifications.test.ts` |
| Shared smoke pass | BU Manager, Unit Staff, Warehouse Manager, Finance Manager | Seeded users and stock | Run one happy path, one rejected path, one variance path, then inspect notifications and audit records | Cross-role flow closes successfully; rejected and variance paths end in expected states; notifications/audit entries exist | Covered across `core-task-02` through `core-task-06`; audit is manual for this pass |

## 1. Login and Role Routing

1. Sign in as `manager.jara@hgl-wms.com`.
2. Confirm the app redirects to `/requests`.
3. Sign out and confirm the app returns to the login page.
4. Repeat with `staff.jara@hgl-wms.com` and confirm `/requests`.
5. Repeat with `warehouse@hgl-wms.com` and confirm `/warehouse/queue`.
6. Sign in again, open a protected page, delete `access_token` from local storage, refresh, and confirm redirect to login.
7. Sign in again, force an expired-token or invalid-token API state, and confirm protected API calls clear session and return to login.

## 2. Transfer Request Lifecycle

1. Sign in as BU Manager.
2. Go to `/requests/new`.
3. Submit without required fields and confirm validation errors.
4. Add a product line with quantity `0` and confirm rejection.
5. Add a product line above available stock and confirm insufficient-stock rejection.
6. Create a valid transfer with at least two line items.
7. Confirm reference format `TRF-YYYY-NNNNN` and initial pending status.
8. Go to `/requests`, open the request, and confirm reference, status, requesting unit, and line quantities.
9. Edit a pre-issuance request and confirm updated notes/date/lines are saved.
10. Cancel a pre-issuance request and confirm status becomes `CANCELLED`.
11. Confirm issued or completed requests cannot be edited through the normal UI.

## 3. Warehouse Issuance

1. Use Finance Manager only as needed to approve a transfer into `APPROVED_FOR_ISSUE`.
2. Sign in as Warehouse Manager.
3. Go to `/warehouse/queue`.
4. Confirm the approved transfer is visible.
5. Issue full quantities for all line items and confirm the transfer becomes `ISSUED`.
6. Confirm stock decreased for issued products.
7. Create and approve another transfer.
8. Issue a lower quantity for one line item and select or enter a shortfall reason.
9. Confirm issuance succeeds and the shortfall reason is retained.
10. Try to issue more than available stock if the UI allows it, and confirm the system rejects the request.

## 4. Unit GRN Submission

1. Sign in as Unit Staff from the same SBU as an issued transfer.
2. Go to `/grn/submit`.
3. Select the issued transfer.
4. Enter received quantities equal to issued quantities.
5. Submit and confirm the transfer becomes `COMPLETED`.
6. Create, approve, and issue another transfer.
7. Submit a GRN with received quantity different from issued quantity.
8. Enter variance notes and confirm status becomes `COMPLETED_WITH_VARIANCE`.
9. Confirm variance notes appear in the variance/admin views.
10. Try to submit or mutate a GRN again for a completed transfer and confirm the app prevents it.

## 5. Return Request Flow

1. Sign in as Unit Staff.
2. Go to `/returns/new`.
3. Create a linked return against a completed transfer.
4. Confirm reference format `RTN-YYYY-NNNNN` and status `PENDING_APPROVAL`.
5. Create an unlinked return with product, quantity, and reason.
6. Sign in as BU Manager.
7. Go to `/returns/approvals`.
8. Approve one pending return and confirm status `APPROVED`.
9. Reject another pending return with notes and confirm status `REJECTED`.
10. Sign in as Warehouse Manager.
11. Go to `/warehouse/returns`.
12. Receive the approved return and confirm status becomes `AWAITING_FINANCE_APPROVAL`.
13. Confirm stock is not restored until Finance stock-credit approval.

## 6. Notifications (Operational)

1. Create a transfer as BU Manager.
2. Sign in as the role expected to receive the transfer notification and check `/notifications`.
3. Issue goods as Warehouse Manager.
4. Sign in as BU Manager and Unit Staff and confirm goods-issued notifications are visible.
5. Submit a variance GRN as Unit Staff.
6. Confirm BU Manager and Warehouse Manager can see the variance/submitted notifications.
7. Create and action a return through Unit Staff, BU Manager, Warehouse Manager, and Finance Manager as needed.
8. Confirm each operational role sees the expected return notifications.
9. Mark one notification as read and confirm it disappears from unread results or changes read state.
10. Sign in as another role and confirm only role-appropriate notifications are visible.

## Shared Smoke Pass at End

1. Run one full cross-role happy path:
   - BU Manager creates transfer.
   - Finance approves if required.
   - Warehouse issues.
   - Unit Staff submits exact GRN.
   - Confirm closure status.
2. Run one rejected path:
   - Finance rejects a transfer, or BU Manager rejects a return.
   - Confirm downstream actions are blocked.
3. Run one variance path:
   - Warehouse issues goods.
   - Unit Staff records a GRN variance.
   - Confirm variance status and variance notes.
4. Confirm notifications exist for each major event.
5. Confirm audit records exist for create, approve/reject, issue, receive, and GRN actions.

## Verification Commands

```bash
npm test -- tests/unit/core-task-01-auth-routing.test.ts
npm test -- tests/integration/core-task-02-transfer-lifecycle.test.ts tests/integration/core-task-03-warehouse-issuance.test.ts tests/integration/core-task-04-grn-submission.test.ts tests/integration/core-task-05-return-request-flow.test.ts tests/integration/core-task-06-notifications.test.ts
npm test
npm run format:check
npm run lint
npm run build
```
