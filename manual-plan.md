# Manual Test Plan For Core Tasks 1-6

## Setup

Use seeded accounts:

- BU Manager: `manager.jara@hgl-wms.com`
- Unit Staff: `staff.jara@hgl-wms.com`
- Warehouse Manager: `warehouse@hgl-wms.com`
- Finance Manager: `finance@hgl-wms.com`
- Password for all: `Demo@1234!`

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 1. Login And Role Routing

### BU Manager

1. Open the login page.
2. Sign in as `manager.jara@hgl-wms.com`.
3. Confirm the app redirects to `/requests`.
4. Open the profile/menu area.
5. Click logout.
6. Confirm the app returns to the login page.

### Unit Staff

1. Sign in as `staff.jara@hgl-wms.com`.
2. Confirm the app redirects to `/requests`.
3. Log out.

### Warehouse Manager

1. Sign in as `warehouse@hgl-wms.com`.
2. Confirm the app redirects to `/warehouse/queue`.
3. Log out.

### Finance Manager

1. Sign in as `finance@hgl-wms.com`.
2. Confirm the app redirects to `/finance/queue`.
3. Log out.

### Missing Or Expired Token

1. Sign in with any account.
2. Open browser dev tools.
3. Go to local storage.
4. Delete `access_token`.
5. Refresh the page.
6. Confirm the user is redirected to login or protected requests fail safely.

## 2. Transfer Request Lifecycle

### Validation

1. Sign in as BU Manager.
2. Go to `/requests/new`.
3. Try submitting without required fields.
4. Confirm validation errors appear.
5. Add a product line with quantity `0`.
6. Confirm the app rejects it.
7. Add a product line with quantity greater than available stock.
8. Confirm the app rejects insufficient stock.

### Create Valid Transfer

1. Stay signed in as BU Manager.
2. Go to `/requests/new`.
3. Select a requesting unit.
4. Add at least two product line items.
5. Enter valid requested quantities.
6. Submit the request.
7. Confirm a reference is generated in this format: `TRF-YYYY-NNNNN`.
8. Confirm the request status is `PENDING_APPROVAL`.

### View Details

1. Go to `/requests`.
2. Open the newly created request.
3. Confirm the reference number is visible.
4. Confirm all line items are visible.
5. Confirm requested quantities are correct.
6. Confirm current status is visible.

### Edit Before Issuance

1. Create another transfer request.
2. Open the request before Finance approval or issuance.
3. Click edit.
4. Change notes, required date, or line quantities.
5. Save changes.
6. Confirm the updated values are shown.

### Cancel Before Issuance

1. Open a request that has not been issued.
2. Cancel it.
3. Confirm the status becomes `CANCELLED`.

### Finance Approval

1. Log out.
2. Sign in as Finance Manager.
3. Go to `/finance/queue`.
4. Open the valid pending transfer.
5. Approve it.
6. Confirm the status becomes `APPROVED_FOR_ISSUE`.

## 3. Warehouse Issuance

### Queue Visibility

1. Log out.
2. Sign in as Warehouse Manager.
3. Go to `/warehouse/queue`.
4. Confirm the Finance-approved transfer appears.

### Full Issuance

1. Open the approved transfer.
2. Enter full issued quantities for all line items.
3. Submit issuance.
4. Confirm issuance succeeds.
5. Confirm transfer status becomes `ISSUED`.
6. Check stock for issued products.
7. Confirm stock decreased.

### Partial Issuance

1. Create and Finance-approve another transfer.
2. Sign in as Warehouse Manager.
3. Open the new approved transfer.
4. Enter a lower issued quantity than requested.
5. Enter a shortfall reason.
6. Submit issuance.
7. Confirm issuance succeeds.
8. Confirm the shortfall reason is saved or visible where applicable.

### Insufficient Stock

1. Try issuing more than available stock if the UI allows it.
2. Submit issuance.
3. Confirm the system rejects the request.

## 4. Unit GRN Submission

### Exact Receipt

1. Log out.
2. Sign in as Unit Staff from the same SBU.
3. Go to `/grn/submit`.
4. Select an issued transfer.
5. Enter received quantities equal to issued quantities.
6. Submit GRN.
7. Confirm submission succeeds.
8. Confirm transfer status becomes `COMPLETED`.

### Variance Receipt

1. Create, approve, and issue another transfer.
2. Sign in as Unit Staff.
3. Go to `/grn/submit`.
4. Select the issued transfer.
5. Enter received quantity different from issued quantity.
6. Enter variance notes.
7. Submit GRN.
8. Confirm transfer status becomes `COMPLETED_WITH_VARIANCE`.
9. Confirm variance notes are saved and visible in variance/admin views.

### Immutability After GRN

1. Open a transfer that already has a submitted GRN.
2. Try to resubmit GRN or edit completed receipt details through the normal UI.
3. Confirm the app prevents duplicate submission or mutation.

## 5. Return Request Flow

### Linked Return

1. Sign in as Unit Staff.
2. Go to `/returns/new`.
3. Select a completed transfer.
4. Add at least one product to return.
5. Enter a valid quantity.
6. Enter a return reason.
7. Submit the return.
8. Confirm a reference is generated like `RTN-YYYY-NNNNN`.
9. Confirm status is `PENDING_APPROVAL`.

### Unlinked Return

1. Stay signed in as Unit Staff.
2. Go to `/returns/new`.
3. Create a return without selecting an original transfer.
4. Add product, quantity, and reason.
5. Submit.
6. Confirm return is created successfully.

### BU Approval

1. Log out.
2. Sign in as BU Manager.
3. Go to `/returns/approvals`.
4. Open one pending return.
5. Approve it.
6. Confirm status becomes `APPROVED`.

### BU Rejection

1. Open another pending return.
2. Reject it with notes.
3. Confirm status becomes `REJECTED`.

### Warehouse Receipt

1. Log out.
2. Sign in as Warehouse Manager.
3. Go to `/warehouse/returns`.
4. Open the approved return.
5. Confirm physical receipt.
6. Confirm status becomes `AWAITING_FINANCE_APPROVAL`.
7. Confirm stock is not restored yet.

### Finance Stock Restoration

1. Log out.
2. Sign in as Finance Manager.
3. Go to `/finance/queue`.
4. Open the received return awaiting Finance approval.
5. Approve stock restoration.
6. Confirm status becomes `STOCK_RESTORED`.
7. Confirm stock is restored.

## 6. Notifications

### Transfer Submitted

1. Sign in as BU Manager.
2. Create a transfer request.
3. Log out.
4. Sign in as Finance Manager.
5. Go to `/notifications`.
6. Confirm a transfer approval notification is visible.

### Transfer Approved For Issue

1. As Finance Manager, approve the transfer.
2. Log out.
3. Sign in as Warehouse Manager.
4. Go to `/warehouse/queue` or `/notifications`.
5. Confirm the approved transfer is visible for Warehouse action.

### Goods Issued

1. As Warehouse Manager, issue goods.
2. Log out.
3. Sign in as BU Manager.
4. Go to `/notifications`.
5. Confirm goods issued notification is visible.
6. Log out.
7. Sign in as Unit Staff.
8. Confirm goods issued notification is visible.

### GRN Variance

1. As Unit Staff, submit a GRN with variance.
2. Log out.
3. Sign in as BU Manager.
4. Check `/notifications`.
5. Confirm GRN variance/submitted notification is visible.
6. Log out.
7. Sign in as Warehouse Manager.
8. Confirm GRN variance notification is visible.

### Return Notifications

1. As Unit Staff, create a return.
2. Sign in as BU Manager.
3. Confirm return approval notification is visible.
4. Approve the return.
5. Sign in as Warehouse Manager.
6. Confirm return awaiting receipt notification is visible.
7. Receive the return.
8. Sign in as Finance Manager.
9. Confirm return awaiting Finance approval is visible.
10. Approve stock restoration.
11. Sign in as BU Manager, Unit Staff, and Warehouse Manager.
12. Confirm return stock-restored notifications are visible for each role.

### Read And Unread Behavior

1. Sign in as any role with notifications.
2. Go to `/notifications`.
3. Confirm unread notifications are visible.
4. Mark one notification as read.
5. Confirm it disappears from unread list or changes read state.
6. Sign in as another role.
7. Confirm only role-appropriate notifications are visible.
