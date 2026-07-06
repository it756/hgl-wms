# Harvest WMS — End-to-End User Flow Guide (For Training & Flow Diagrams)

**Version 1.0 · 3 July 2026**
**Purpose:** A step-by-step reference of every user flow in the system, grouped by actor (role), written as simple numbered steps so each flow can be dropped straight into a flowchart tool (Lucidchart, Visio, draw.io, Miro) for end-user training.

**How to use this doc:** Each flow below is a single swimlane/box-sequence — turn each numbered step into one box, and each "→" status change into an arrow. Where a flow hands off to another actor, that is called out explicitly ("**Hands off to:**") so you can draw the swimlane crossing.

---

## 0. Actors in the System

| Actor | Logs in? | Scope |
|---|---|---|
| **Unit Staff** | Yes | One SBU Unit (department/branch) |
| **BU Manager** | Yes | One SBU (all its units) |
| **Warehouse Manager** | Yes | Global (single central warehouse) |
| **Finance Manager** | Yes | Global (all SBUs) |
| **Admin** | Yes | Global (full system) |
| **External Procurement Contact** | **No** — acts via a one-time emailed link | Single purchase request only |

All logged-in actors share: **Login**, **Forgot Password**, **Notifications**, **Profile / Change Password**. These are documented once in Section 1 and not repeated per role.

---

## 1. Shared Flows (Every Logged-In Role)

### 1.1 Login
1. Open the app landing page.
2. Enter email and password.
3. Click **Sign In**.
4. System redirects automatically based on role:
   - Admin → Admin Dashboard
   - BU Manager / Unit Staff → Transfer Requests list
   - Warehouse Manager → Warehouse Dispatch Queue
   - Finance Manager → Finance Approvals Queue

### 1.2 Forgot Password
1. Click **Forgot Password** on the login page.
2. Enter registered email.
3. Submit → receive reset email.
4. Click link in email → set new password (min 8 characters, 1 number, 1 special character).

### 1.3 Change Password / Update Profile
1. Click avatar (top right) → **Profile**.
2. Update name / password fields.
3. Click **Save**.

### 1.4 Check Notifications
1. Click the bell icon (top right).
2. Review unread notifications (bold/highlighted).
3. Click a notification → jumps to the related request/record.
4. Notifications auto-mark as read on click (cannot be deleted).

---

## 2. UNIT STAFF Flows

### 2.1 Raise a Transfer Request
*Goal: request stock from the central warehouse for my branch/unit.*

1. Go to **Transfer Requests** → click **New Request**.
2. Unit is pre-filled (my assigned branch/unit).
3. Add one or more line items: search product → enter quantity.
4. (Optional) Set a required-by date and notes.
5. Click **Submit**.
6. System generates a reference number (`TRF-YYYY-NNNNN`) and status **Pending BU Approval**.
7. **Hands off to:** BU Manager (approval queue).

### 2.2 Track My Requests
1. Go to **Transfer Requests** list.
2. Filter/search by status.
3. Click a request to view line items, current status, and history.
4. Status progresses automatically as other roles act: `Pending BU Approval → Pending Finance Approval → Approved for Issue → Issued → Completed`.

### 2.3 Receive Goods (Submit GRN)
*Goal: confirm what physically arrived from the warehouse.*

1. Go to **Receive Goods (GRN)**.
2. Select a request with status **Issued**.
3. Enter the quantity actually received for each line item.
4. Add condition notes and date received.
5. (Optional) Upload a photo/delivery note.
6. Click **Submit**.
7. If all quantities match → request becomes **Completed**.
8. If any quantity differs → request becomes **Completed with Variance**, and the mismatch is automatically escalated to Finance for review.
9. **Hands off to:** Warehouse Manager (notified of variance) and Finance Manager (variance review).

### 2.4 Raise a Return
*Goal: send goods back to the warehouse after a completed transfer.*

1. Go to **Returns** → click **New Return**.
2. Select a **Completed** transfer.
3. Enter quantity to return per line (cannot exceed quantity originally received).
4. Enter a mandatory reason and optional notes.
5. Click **Submit** → status **Pending Approval**.
6. **Hands off to:** BU Manager (approval), then Warehouse Manager (physical receipt), then Finance Manager (final stock credit).

### 2.5 View My Branch Stock (read-only)
1. Go to **My Stock**.
2. Search/browse the product catalogue and current quantities for my SBU.

---

## 3. BU MANAGER Flows

*(BU Manager can also do everything in Section 2, for their own SBU.)*

### 3.1 Approve/Reject Unit Staff Transfer Requests
1. Go to **Approvals Queue** (Unit Staff Requests).
2. Open a request with status **Pending BU Approval**.
3. Review line items and requested quantities.
4. Add optional notes.
5. Click **Approve** or **Reject**.
6. Approve → status **Pending Finance Approval** (or **Approved for Issue** directly, if below the finance threshold).
7. Reject → request is cancelled; Unit Staff is notified.
8. **Hands off to:** Finance Manager (if above threshold) or Warehouse Manager (if below).

### 3.2 Raise a Transfer Request Directly
1. Go to **Transfer Requests** → **New Request**.
2. Select the requesting unit within my SBU.
3. Add line items.
4. Submit → since I am the approver, this **skips** the "Pending BU Approval" step and goes straight to **Pending Finance Approval** or **Approved for Issue**.

### 3.3 Manage Units & Staff
1. Go to **Units & Staff**.
2. **Units tab:** add/edit sub-units (departments/branches) within my SBU.
3. **Staff tab:** create Unit Staff accounts and assign them to a unit.

### 3.4 Approve Returns
1. Go to **Returns → Approvals**.
2. Open a return raised by Unit Staff (**Pending Approval**).
3. Add approval/rejection notes.
4. Click **Approve** or **Reject**.
5. Approve → status **Approved**; Warehouse Manager notified to expect the goods.
6. Reject → status **Rejected**; Unit Staff notified.

### 3.5 Variance Resolution — Retired
*The BU Manager Write-Back/Loss disposition screen has been retired (2026-07-03). All GRN
variances are now resolved exclusively by the Finance Manager via the auto-raised Variance
Proposal flow — see Section 5.4.*

### 3.6 Raise a Purchase Request (Procurement)
*Goal: buy new stock from an external supplier via the procurement team.*

1. Go to **Purchase Requests** → click **New Request**.
2. Enter the procurement contact's email (required — this is who will approve externally).
3. (Optional) Enter supplier name/email and notes.
4. Add line items — existing catalogue product, or free-text description if it's a new item.
5. Click **Save as Draft**, or **Submit to Procurement** directly.
6. On submit: status becomes **Pending Procurement Approval**; a secure one-time review link is emailed to the procurement contact.
7. **Hands off to:** External Procurement Contact (Section 7).
8. If procurement requests changes, the request returns to me as **Procurement Changes Requested** — edit and resubmit (repeat from step 5).

---

## 4. WAREHOUSE MANAGER Flows

### 4.1 Warehouse Dashboard
1. Log in → land on **Warehouse Dashboard**.
2. Review KPI cards: pending dispatches, GRNs, variance %, recent activity.
3. Click through to Dispatch Queue or Supplier GRN from the shortcut cards.

### 4.2 Issue Goods (Dispatch a Transfer)
1. Go to **Dispatch Queue**.
2. Open a request with status **Approved for Issue**.
3. For each line item, confirm/adjust the quantity to issue (defaults to the lower of stock available or requested).
4. If issuing less than requested, select a shortfall reason.
5. Enter courier name, vehicle plate, and confirm license verification.
6. Add logistics notes.
7. Click **Submit Issuance**.
8. Status becomes **Issued**; stock is decremented; Unit Staff/BU Manager notified to expect delivery.
9. **Hands off to:** Unit Staff (Section 2.3, submits GRN on arrival).

### 4.3 Receive Goods from a Supplier (Supplier GRN)
1. Go to **Supplier GRN** (or click **Receive Goods** from an Expected Order).
2. Enter supplier name, invoice reference/amount, date received, and destination SBU.
3. Add line items manually, or upload a supplier packing-list CSV (auto-matches SKUs).
4. Click **Submit**.
5. Status becomes **Awaiting Finance Approval**; stock is **not yet** updated.
6. **Hands off to:** Finance Manager (Section 6.2).

### 4.4 View Expected Orders
1. Go to **Expected Orders**.
2. Review Admin-approved purchase requests awaiting delivery.
3. Click **Receive Goods** on an order → opens a pre-linked Supplier GRN form (Section 4.3).

### 4.5 Intra-Warehouse Transfer (Direct Stock Reassignment)
1. Go to **Intra-Warehouse Transfer**.
2. Search and select a product.
3. Enter quantity (cannot exceed available stock).
4. Select the destination SBU.
5. Add optional notes.
6. Click **Submit**.
7. Status becomes **Pending Finance Approval**; stock is not yet moved.
8. **Hands off to:** Finance Manager (Section 6.5).

### 4.6 Receive a Return from a Unit
1. Go to **Returns (Incoming)**.
2. Open a return with status **Approved**.
3. Confirm physical receipt of the goods → click **Confirm Receipt**.
4. Status becomes **Awaiting Finance Approval**.
5. **Hands off to:** Finance Manager (final stock credit, Section 6.2).

### 4.7 Initiate a Damage Recall
1. Go to **Damage Ledger**.
2. Find a written-off item.
3. Click **Initiate Recall**.
4. Advance the recall status as goods physically move: **Pending → In Transit → Received**.

### 4.8 Direct Damage Write-off
1. Go to **Product Catalogue**.
2. Click the flame/damage icon on a product.
3. Enter quantity damaged, select a reason (or "Other" + notes).
4. Confirm → stock decremented, entry added to Damage Ledger.

### 4.9 Record Expired Stock
1. Go to **Expiry Ledger**.
2. Record the product, quantity expired, and expiry date.
3. Confirm → stock decremented, financial value captured in the ledger.

### 4.10 View Loss Account (read-only)
1. Go to **Loss Account**.
2. Review KPIs: number of entries, units lost, value lost (populated from Finance Manager-approved
   variance-proposal damage write-offs).

---

## 5. FINANCE MANAGER Flows

### 5.1 Unified Approvals Queue
1. Log in → land on **Finance Approvals Queue**.
2. Choose a tab: **Transfers / Supplier GRNs / Variance / Returns / Intra-Transfers**.
3. Open an item, review details, add notes.
4. Click **Approve** or **Reject**.

Each tab's effect:

| Tab | Approve → | Reject → |
|---|---|---|
| Transfers | Approved for Issue (Warehouse notified) | Cancelled |
| Supplier GRNs | GRN Approved (stock posted) | GRN Rejected (no stock change) |
| Returns | Stock restored (all parties notified) | Rejected |
| Intra-Transfers | Completed (stock moves) | Cancelled |

### 5.2 Approve a Supplier GRN
1. Open **Supplier GRNs** tab in the Approvals Queue.
2. Review invoice amount vs line items; check for packing variances (expected vs received qty).
3. Click **Approve** → stock incremented for every line item.
4. Click **Reject** → no stock change; Warehouse Manager notified.

### 5.3 Approve/Restore a Return
1. Open **Returns** tab.
2. Review a Warehouse-confirmed return (**Awaiting Finance Approval**).
3. Click **Approve** → stock restored; BU Manager, Unit Staff, and Warehouse Manager all notified.
4. Click **Reject** → no stock change.

### 5.4 Review a Variance Proposal
*This is the Finance-side companion to the auto-raised variance created whenever Unit Staff reports a GRN mismatch (Section 2.3).*

1. Open **Variance** tab.
2. Review each line's system-recommended resolution: **Damage Write-off** (shortage) or **Stock Reintegration** (excess).
3. Override any line's decision if needed.
4. Click **Approve** → recommended/overridden actions execute (ledger entry or stock increment).
5. Click **Reject** → no changes made.

### 5.5 Approve an Intra-Warehouse Transfer
1. Open **Intra-Transfers** tab.
2. Review product, quantity, source/destination SBU.
3. Click **Approve** → stock moves; destination BU Manager notified.
4. Click **Reject** → no stock change.

### 5.6 Manage Product Catalogue (Finance view)
1. Go to **Catalogue**.
2. View stock levels, create a product if a gap is found.
3. Use the damage write-off icon the same way as Warehouse Manager (Section 4.8).

### 5.7 View Damage & Expiry Ledgers (read-only)
1. Go to **Damage Ledger** / **Expiry Ledger**.
2. Filter by date range or search term.

---

## 6. ADMIN Flows

### 6.1 Admin Dashboard
1. Log in → land on **Admin Dashboard**.
2. Grid of shortcuts: Users, SBUs, Products, Settings, Exports, Audit, Variance, Damage, Expiry, Purchase Requests.

### 6.2 Manage Users
1. Go to **Users**.
2. **Create user:** fill form (name, email, role, SBU/unit) → Save.
3. **Bulk import:** download CSV template → fill it → upload → system validates and creates up to 200 users at once.
4. **Edit user:** change role/SBU, deactivate, or reset password via the edit panel.

### 6.3 Manage SBUs
1. Go to **SBUs**.
2. Create a new SBU (name, code).
3. Edit finance-approval threshold per SBU, or toggle active/inactive.

### 6.4 Manage Product Catalogue
1. Go to **Products**.
2. Create/edit products: name, SKU, unit cost, low-stock threshold, warehouse bin location.
3. Adjust stock with a mandatory reason (audit-logged).
4. Deactivate/reactivate a product.
5. Trigger a direct damage write-off (Section 4.8).

### 6.5 Configure System Settings
1. Go to **Settings**.
2. Update: finance approval threshold & scope (global/per-SBU), session timeout, low-stock alert toggle, email notification toggle.
3. Save each section independently.

### 6.6 Internal Control — Approve Purchase Requests
*Final internal sign-off after external procurement has approved.*

1. Go to **Purchase Requests**.
2. Open a request with status **Pending Internal Control Approval**.
3. Review the procurement outcome and line items.
4. Add optional notes.
5. Click **Approve** → status **Expected Order**; Warehouse Manager and requester notified.
6. Click **Reject** → status **Internal Control Rejected**; requester notified.
7. **Hands off to:** Warehouse Manager (Section 4.4, Expected Orders).

### 6.7 Damage Ledger & Recalls (shared with Warehouse Manager)
1. Go to **Damage Ledger**.
2. View all write-offs; initiate/advance recalls (same as Section 4.7).

### 6.8 Variance Registry (read-only)
1. Go to **Variance**.
2. Review all transfers awaiting or having completed Finance Manager variance-proposal review —
   audit view only, no actions here.

### 6.9 Export Data
1. Go to **Exports**.
2. Choose a card: Transfer Requests / Standard GRNs / Supplier GRN Invoices / Audit Trails.
3. Set an optional date range.
4. Click **Export** → downloads a CSV.

### 6.10 View Audit Log
1. Go to **Audit**.
2. Filter by entity type, date range, or free-text search.
3. Review who did what, when, and the before/after values.

---

## 7. EXTERNAL PROCUREMENT CONTACT (No Login)

### 7.1 Review & Action a Purchase Request
1. Open the secure link received by email (no username/password needed).
2. Review the purchase request: line items, quantities, estimated total.
3. (Optional) Add notes, or attach a document/URL if the link allows uploads.
4. Choose one:
   - **Approve** → request moves to Admin's Internal Control queue (Section 6.6). Link is now used up.
   - **Reject** → request is closed as Rejected. Link is now used up.
   - **Request Changes** → request returns to the BU Manager to edit (Section 3.6, step 8). Link remains valid for re-review after resubmission.
5. A confirmation email is sent back to the procurement contact either way.

> Links expire automatically and cannot be reused once Approved or Rejected. Expired/used/revoked links show a friendly error page.

---

## 8. End-to-End Lifecycle Diagrams (Text Form — for Flowchart Conversion)

### 8.1 Core Transfer Request Lifecycle
```
Unit Staff: Raise Request
   → PENDING_BU_APPROVAL
BU Manager: Approve/Reject
   → PENDING_APPROVAL  (or APPROVED_FOR_ISSUE if below finance threshold)
Finance Manager: Approve/Reject
   → APPROVED_FOR_ISSUE  (or CANCELLED)
Warehouse Manager: Issue Goods
   → ISSUED
Unit Staff: Submit GRN
   → COMPLETED  (or COMPLETED_WITH_VARIANCE)
        └─ if variance: Finance Manager reviews the auto-raised Variance Proposal (Section 5.4)
   → COMPLETED
```

### 8.2 Purchase Request → Procurement → Warehouse Lifecycle
```
BU Manager: Raise Purchase Request → Submit
   → PENDING_PROCUREMENT_APPROVAL  (email sent to procurement contact)
External Procurement Contact: Approve / Reject / Request Changes
   → PENDING_INTERNAL_CONTROL_APPROVAL   (approve)
   → REJECTED                            (reject)
   → PROCUREMENT_CHANGES_REQUESTED       (changes — loops back to BU Manager)
Admin: Internal Control Approve/Reject
   → EXPECTED_ORDER          (approve)
   → INTERNAL_CONTROL_REJECTED (reject)
Warehouse Manager: Receive Goods (Supplier GRN)
   → AWAITING_FINANCE_APPROVAL
Finance Manager: Approve/Reject
   → GRN_APPROVED (stock posted)  /  GRN_REJECTED (no stock change)
```

### 8.3 Return Request Lifecycle
```
Unit Staff: Raise Return
   → PENDING_APPROVAL
BU Manager: Approve/Reject
   → APPROVED  /  REJECTED
Warehouse Manager: Confirm Physical Receipt
   → AWAITING_FINANCE_APPROVAL
Finance Manager: Approve
   → RECEIVED (stock restored)
```

### 8.4 Intra-Warehouse Transfer Lifecycle
```
Warehouse Manager: Create Transfer
   → PENDING_FINANCE_APPROVAL
Finance Manager: Approve/Reject
   → COMPLETED (stock moves)  /  CANCELLED
```

---

## 9. Known Gaps to Flag During Training

- **No supplier self-service**: suppliers do not get a portal — all supplier goods receipt is entered by the Warehouse Manager.
- **URL access is not role-blocked in the UI**: only API calls are permission-checked. Train users to use the navigation menu, not bookmarked/guessed URLs.

---

*Source of truth for status names and field-level detail: [specs/main/spec.md](../specs/main/spec.md). This guide is the simplified, training-oriented companion to that spec.*
