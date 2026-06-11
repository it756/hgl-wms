# Harvest WMS — Stakeholder Demo Guide

**Version 1.0 · June 2026**
**Story: Jara Retail FMCG Store — Weekend Promotion Restock**
**Total runtime: ~20 min (core) · ~25 min (with Optional Scene 7)**

---

## The Story

Jara Retail FMCG's Twin Palms branch manager needs to restock high-value items before a weekend promotion. Her staff raises a transfer request — but because the total exceeds the finance approval threshold, the request must clear Finance before the warehouse can dispatch anything. We follow this single request from first click all the way to a confirmed receipt and audit trail, logging in as each role along the way.

---

## Pre-Demo Setup Checklist

Before the meeting, complete all of the following:

- [ ] Run `npx tsx scripts/seed/seed_data.ts` against the demo environment
- [ ] Confirm the app is running and reachable at the demo URL
- [ ] Open **6 browser tabs**, pre-loaded and logged in as the accounts below (use incognito windows or separate browser profiles to avoid session conflicts):
  1. `staff.jara@hgl-wms.com` → `/requests`
  2. `manager.jara@hgl-wms.com` → `/bu/queue`
  3. `finance@hgl-wms.com` → `/finance/queue`
  4. `warehouse@hgl-wms.com` → `/warehouse`
  5. `staff.jara@hgl-wms.com` → `/notifications` (second tab for this account)
  6. `admin@hgl-wms.com` → `/admin/audit`
- [ ] Set browser zoom to ~90% so full tables are visible without scrolling
- [ ] Have this guide open on a second screen or printed

---

## Account Reference

All accounts use password: **`Demo@1234!`**

| Email                      | Name                 | Role              | Scope                  |
| -------------------------- | -------------------- | ----------------- | ---------------------- |
| `staff.jara@hgl-wms.com`   | Jara Store Staff     | Unit Staff        | Twin Palms branch only |
| `manager.jara@hgl-wms.com` | Jara Branch Manager  | BU Manager        | All Jara branches      |
| `finance@hgl-wms.com`      | Finance Manager      | Finance Manager   | All SBUs               |
| `warehouse@hgl-wms.com`    | Warehouse Manager    | Warehouse Manager | All SBUs               |
| `admin@hgl-wms.com`        | System Administrator | Admin             | Full system            |

---

## Scene 0 — System Overview _(~3 min)_

**Account:** `admin@hgl-wms.com`

### What to show

1. **`/admin/users`** — point out the full user list: global roles (Admin, Warehouse, Finance) plus per-SBU accounts. Note that each SBU has its own manager and staff, and that no user can see another SBU's data.
2. **`/admin/sbus`** — 8 Strategic Business Units are configured. Jara is one of them; the system supports retail, pharma, wholesale, logistics, and more in the same environment.
3. **`/admin/products`** — scroll to show mixed stock levels; point out items near or below their low-stock threshold (they'll be highlighted). Note unit costs are attached — these drive the finance approval gate.
4. **`/admin/settings`** — show the **Finance Approval Threshold** setting (default: 1,000). Explain: any transfer request whose estimated value exceeds this is automatically held until Finance signs off. The Warehouse cannot issue goods until that approval arrives.

### Talking points

> "Every role sees only what's relevant to them. A branch manager at Jara cannot see Grand Access's data, and vice versa. The Admin is the only role with a full cross-SBU view."

> "The finance threshold is configurable — it can be set globally or per SBU. Today it's set at 1,000. We're about to place a request that exceeds it."

---

## Scene 1 — Unit Staff Raises a Transfer Request _(~3 min)_

**Account:** `staff.jara@hgl-wms.com` → Tab 1

### What to show

1. Navigate to **`/requests`** — point out the existing request history for Jara (requests in PENDING and APPROVED_FOR_ISSUE status from the seed data). This is what the branch's history looks like on day one.
2. Click **New Request**.
3. Fill in the form:
   - **Branch / Unit:** Twin Palms (pre-selected, because this staff account belongs to Twin Palms)
   - **Required Date:** pick a date 5 days from today
   - **Notes:** `Weekend promotion restock — Toner, security tags, and paper`
   - Add the following line items:

     | Product                                   | Qty | Unit Cost | Line Total    |
     | ----------------------------------------- | --- | --------- | ------------- |
     | Printer Toner Cartridge (Black) — GEN-005 | 10  | $85.00    | $850.00       |
     | EAS Security Tag (Box of 100) — RTL-004   | 10  | $45.00    | $450.00       |
     | A4 Paper Ream — GEN-001                   | 30  | $4.50     | $135.00       |
     | **Estimated Total**                       |     |           | **$1,435.00** |

4. Submit the request.
5. Note the **auto-assigned reference number** (e.g. `TRF-2026-XXXXX`) that appears immediately. Point out the status: **`PENDING_BU_APPROVAL`** — it goes to the BU Manager first, not directly to the warehouse.

### Talking points

> "The reference number is generated instantly and uniquely identifies this request forever. There's no way to lose it in an email thread."

> "Because this was raised by Unit Staff, it goes to the Branch Manager for review before the warehouse ever sees it. The manager acts as the first checkpoint."

---

## Scene 2 — BU Manager Reviews and Approves _(~3 min)_

**Account:** `manager.jara@hgl-wms.com` → Tab 2

### What to show

1. Navigate to **`/bu/queue`** — the new request from Scene 1 is at the top. Point out the other requests already in the queue (from seed data) to show that this is an active, live queue, not an empty screen.
2. Click into the new request. Show:
   - Full line-item breakdown with quantities and unit costs
   - The notes from the staff member
   - Required date
3. Click **Approve**.
4. The status changes to **`PENDING_APPROVAL`** — not `PENDING`. Explain: the estimated value ($1,435) exceeds the $1,000 threshold, so the system has automatically routed it to Finance before the Warehouse can act.
5. Navigate to **`/requests`** — show that the manager can see all Jara requests across all branches, but _nothing_ from other SBUs (no Grand Access, no Bounty data visible).

### Talking points

> "The manager only approved the business need — the finance gate is separate and automatic. The warehouse is blocked until Finance clears it."

> "Notice the manager sees all nine Jara branches in one view, but only Jara. A manager at Grand Access would see a completely different list."

---

## Scene 3 — Finance Manager Approves the High-Value Request _(~3 min)_

**Account:** `finance@hgl-wms.com` → Tab 3

### What to show

1. Navigate to **`/finance/queue`** — point out the **three tabs**: Transfers | Supplier GRNs | Variance Proposals.
2. On the **Transfers tab**, the Jara request is waiting. Click into it and review:
   - Line-item costs and estimated total ($1,435)
   - Requesting branch, required date, manager notes
3. Click **Approve**.
4. Status moves to **`APPROVED_FOR_ISSUE`** — the Warehouse Manager is now notified and can act.
5. While still on the Finance queue, switch to the **Supplier GRNs tab** — show the 2 supplier deliveries sitting at `AWAITING_FINANCE_APPROVAL` (Metro Packaging, ProMed Distributors). Briefly explain:

> "Inbound stock from suppliers is gated the same way — Finance must approve the invoice before stock levels are updated. This keeps the books and the warehouse in sync."

### Talking points

> "Finance is the single approval point for anything above the threshold, whether it's going out to an SBU or coming in from a supplier."

> "The approval is logged with a timestamp and the approver's name — permanently, on every record."

---

## Scene 4 — Warehouse Manager Issues Goods _(~4 min)_

**Account:** `warehouse@hgl-wms.com` → Tab 4

### What to show

1. **`/warehouse`** — show the KPI dashboard: today's dispatches, pending items in queue, stock variance rate. Point out that requests from multiple SBUs are visible here.
2. Navigate to **`/warehouse/queue`** — find the Jara Twin Palms request (status: `APPROVED_FOR_ISSUE`). Click into it.
3. Record the issuance with a **deliberate shortfall** on one line to demonstrate variance handling:

   | Product                         | Requested | Issue | Shortfall Reason                                   |
   | ------------------------------- | --------- | ----- | -------------------------------------------------- |
   | Printer Toner Cartridge (Black) | 10        | 10    | —                                                  |
   | EAS Security Tag (Box of 100)   | 10        | 7     | `Insufficient stock — replenishment order pending` |
   | A4 Paper Ream                   | 30        | 30    | —                                                  |

4. Add logistics notes: `Dispatched via HGC internal transport — 2026-06-10`
5. Submit. Status moves to **`ISSUED`**.
6. Go back to **`/admin/products`** (or show stock levels in the warehouse view) — point out that stock has been decremented in real time for the items issued.

### Talking points

> "The warehouse can only issue what's physically available. If they can't fulfill the full quantity, they document the reason. Nothing is silently short-shipped."

> "Stock is decremented the moment the issuance is recorded — no batch jobs, no overnight sync."

---

## Scene 5 — Unit Staff Submits the GRN _(~3 min)_

**Account:** `staff.jara@hgl-wms.com` → Tab 5 (notifications tab)

### What to show

1. **`/notifications`** — an in-app notification: _"Your transfer request TRF-2026-XXXXX has been dispatched."_ Point out the unread badge. This notification arrived automatically when the Warehouse completed the issuance.
2. Navigate to **`/grn/submit`** — the system pre-fills the request details. Staff confirm what they physically received:

   | Product                         | Issued | Received | Notes                                           |
   | ------------------------------- | ------ | -------- | ----------------------------------------------- |
   | Printer Toner Cartridge (Black) | 10     | 9        | `1 unit arrived with cracked casing — unusable` |
   | EAS Security Tag (Box of 100)   | 7      | 7        | —                                               |
   | A4 Paper Ream                   | 30     | 30       | —                                               |

3. Add condition notes: `1 toner cartridge damaged in transit — photographic evidence retained at branch`
4. Submit. Status moves to **`COMPLETED_WITH_VARIANCE`** — the Warehouse Manager receives an automatic alert.

### Talking points

> "The staff don't need to remember to tell anyone — the system routes the variance alert automatically. The Warehouse Manager will see it on their next login."

> "The GRN is immutable once submitted. It can't be edited or deleted — it's a permanent record of what was physically received."

---

## Scene 6 — Admin Reviews the Audit Trail _(~2 min)_

**Account:** `admin@hgl-wms.com` → Tab 6

### What to show

1. **`/admin/audit`** — filter to today. Every action from this demo session appears in chronological order:
   - Request raised by staff (Scene 1)
   - BU Manager approval (Scene 2)
   - Finance approval (Scene 3)
   - Issuance recorded by Warehouse (Scene 4)
   - GRN submitted by staff (Scene 5)
   - Each entry shows: actor, action, record reference, timestamp.
2. **`/admin/variance`** — the variance from Scene 5 appears here, awaiting investigation. Point out the line-by-line discrepancy and the staff's notes.
3. **`/admin/exports`** — show the CSV export panel. Select a date range and entity type; point out that any 90-day window of data can be exported for reconciliation or external audit.

### Talking points

> "Every action is logged the moment it happens — who did it, what they did, and when. This log is read-only and cannot be altered by anyone in the system, including the Admin."

> "Records are retained for a minimum of 3 years. This supports both internal audit and any regulatory requirements your business may face."

---

## Optional Scene 7 — Supplier Inbound GRN _(~3 min)_

_Use this scene if time permits or if stakeholders ask how inbound stock is controlled._

### What to show

**Account:** `warehouse@hgl-wms.com`

1. Navigate to **`/warehouse/supplier-grn`** — show the two existing supplier GRNs awaiting finance approval (Metro Packaging, ProMed).
2. Record a new supplier delivery:
   - **Supplier:** Jara Retail Fixtures Ltd
   - **Invoice Ref:** JRF-2026-0199
   - **Invoice Amount:** 2,250.00
   - **Line items:** any products with available stock (e.g. RTL-001 × 200, RTL-003 × 100)
3. Submit — status: `AWAITING_FINANCE_APPROVAL`. Note that **stock has not been updated yet**.

**Switch to:** `finance@hgl-wms.com` → `/finance/queue` → **Supplier GRNs tab**

4. Find the new supplier GRN, review the invoice against the delivery note, click **Approve**.
5. Stock levels update immediately. Return to the product catalogue to confirm.

### Talking points

> "The same approval discipline applies to inbound stock. Nothing hits the books until Finance has verified the supplier invoice. This closes the loop on both sides — outbound and inbound."

---

## Fallback Notes

If a live action fails during the demo, use these pre-seeded records to illustrate the same point:

| Scene                             | Fallback record                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Scene 2 (BU queue)                | The seeded `PENDING_APPROVAL` request for Jara Avondale (EAS Tags + Hangers + Toner, $1,585) shows the same finance gate |
| Scene 3 (Finance queue)           | The seeded Bounty Wholesale `PENDING_APPROVAL` ($1,120) or HGC Logistics ($1,001) can substitute                         |
| Scene 4 (Issuance with shortfall) | The seeded HGC `ISSUED` record (cargo straps + shipping labels) shows a completed issuance                               |
| Scene 5 (GRN with variance)       | The seeded Bounty `COMPLETED_WITH_VARIANCE` record (2 crushed cartons) demonstrates a real variance outcome              |
| Scene 7 (Supplier GRN)            | The seeded Metro Packaging or ProMed supplier GRNs are pre-staged at `AWAITING_FINANCE_APPROVAL`                         |

---

## Quick Reference: Transfer Request Statuses

| Status                    | Meaning                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `PENDING_BU_APPROVAL`     | Raised by Unit Staff — awaiting BU Manager review                       |
| `PENDING`                 | BU-approved, queued for Warehouse (below finance threshold)             |
| `PENDING_APPROVAL`        | Value exceeds threshold — Finance must approve before Warehouse can act |
| `APPROVED_FOR_ISSUE`      | Finance approved — Warehouse can now issue                              |
| `ISSUED`                  | Goods dispatched, stock decremented                                     |
| `COMPLETED`               | GRN confirmed, quantities match                                         |
| `COMPLETED_WITH_VARIANCE` | GRN confirmed with discrepancies — flagged for investigation            |
| `CANCELLED`               | Cancelled before issuance                                               |
