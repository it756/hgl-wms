# Harvest WMS — Product Brief for Stakeholders

**Version 1.0 · May 2026 · Status: Proposed**

---

## What Are We Building?

**Harvest WMS** is a web-based Warehouse Management System that gives your organisation a single, controlled place to manage the movement of goods from the central warehouse to your Strategic Business Units (SBUs).

Today, transfer requests, stock issuances, and delivery confirmations may travel through spreadsheets, emails, or phone calls — creating gaps in visibility and accountability. Harvest WMS replaces that with a structured, role-specific digital workflow that every party can trust.

---

## Who Uses It?

The system is built around five distinct roles, each with a focused view of exactly what they need:

| Role                      | What they do in the system                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- |
| **Business Unit Manager** | Raises transfer requests on behalf of their SBU; receives status updates              |
| **Warehouse Manager**     | Reviews incoming requests, records goods issued to SBUs, and logs supplier deliveries |
| **Unit Staff**            | Confirms physical receipt of goods by submitting a Goods Received Note (GRN)          |
| **Finance Manager**       | Approves high-value transfer requests and supplier GRNs before stock is moved         |
| **Administrator**         | Manages users, SBUs, products, and system settings                                    |

Each role sees only what is relevant to them — no access to another unit's data and no ability to perform actions outside their remit.

---

## How Does a Transfer Work?

Every transfer follows a clear, auditable journey through four stages.

```
  BU Manager          Finance Manager       Warehouse Manager       Unit Staff
      │                     │                      │                    │
  1. Raises           2. Approves           3. Issues goods        4. Confirms
  request              (if high-value)       from warehouse         receipt
      │                     │                      │                    │
  PENDING           PENDING APPROVAL        APPROVED FOR           ISSUED
                        ↓                    ISSUANCE
                    APPROVED FOR                 ↓
                     ISSUANCE               ISSUED
                                                 ↓
                                          COMPLETED (or
                                        COMPLETED WITH
                                           VARIANCE)
```

### Step 1 — Raise a Transfer Request

A Business Unit Manager logs in and raises a request listing the products and quantities needed. The system immediately assigns a unique reference number (e.g. `TRF-2026-00042`) and marks it **PENDING**. The Warehouse Manager is notified automatically.

### Step 2 — Finance Approval (for high-value requests)

If the estimated value of the request exceeds a configurable threshold (default: 1,000 in the application's base currency), the request is held as **PENDING APPROVAL** and routed to the Finance Manager. The Warehouse Manager cannot issue goods until Finance has approved. This gate can be configured globally or per SBU.

### Step 3 — Goods Issuance

The Warehouse Manager reviews the queue, checks live stock levels, and records what is being sent. If the full quantity cannot be fulfilled, they record the shortfall with a reason. Stock is decremented immediately and the transfer becomes **ISSUED**. The SBU is notified.

### Step 4 — Goods Received Note (GRN)

Unit Staff physically receives the goods and submits a GRN confirming quantities. If everything matches, the transfer closes as **COMPLETED**. If there are discrepancies, it closes as **COMPLETED WITH VARIANCE** and the Warehouse Manager is alerted so the difference can be investigated.

---

## What Else Does the System Do?

### Inventory Management

- The Warehouse Manager and Administrator maintain the product catalogue, including current stock levels.
- Every stock adjustment is logged with a mandatory reason, creating a full audit trail.
- A configurable low-stock alert notifies the Warehouse Manager when any product falls below its threshold.

### Supplier Goods Received Notes

When goods arrive from a supplier, the Warehouse Manager records a Supplier GRN. This sits in **AWAITING FINANCE APPROVAL** until the Finance Manager reviews and approves it. Only after approval are stock levels updated — ensuring the books and the warehouse always agree.

### Notifications

Every meaningful event (request raised, approved, issued, GRN submitted) triggers an in-app notification and an email to the relevant party. An unread badge keeps users aware of pending actions without them needing to poll the system.

### Audit Log

Every action — who did what, when, and to what record — is permanently logged. Administrators can filter and export audit records for any 90-day window. Records are retained for a minimum of 3 years.

### Administration

Administrators can:

- Create and deactivate users, and assign roles
- Manage SBUs and their settings
- Configure the finance approval threshold (globally or per SBU)
- Export transfer and inventory data as CSV

---

## Security & Access Controls

- All users log in with a unique email and a strong password (minimum 8 characters including a number and a special character).
- Each user holds exactly one role — there is no dual-role access.
- Sessions time out after 30 minutes of inactivity (configurable).
- Deactivated users cannot log in, but all historical records attributed to them remain intact.
- A self-service password reset link is delivered by email and expires after a short window.
- Business Unit Managers can only see and act on their own SBU's data.

---

## What Does Success Look Like?

| Outcome                                                  | Target                  |
| -------------------------------------------------------- | ----------------------- |
| End-to-end transfer completed (request → issuance → GRN) | Under 10 minutes        |
| Pending requests actioned within business days           | 95% within 48 hours     |
| In-app notifications delivered after an event            | Within 30 seconds       |
| Transfer and audit records retained                      | Minimum 3 years         |
| Data exportable for any period                           | Any 90-day range as CSV |

---

## What Is in Scope for Version 1.0?

- Single central warehouse serving multiple SBUs (4–10 SBUs at launch)
- Full transfer request → issuance → GRN workflow
- Finance approval gate for high-value transfers and supplier GRNs
- Role-based access for all five roles
- In-app and email notifications
- Inventory management and audit trail
- Administrator tooling (user, SBU, product, settings, exports)

### What Is NOT in Scope for Version 1.0

- Multiple warehouses _(the data model is designed to support this in v2 without a breaking change)_
- Recurring or standing transfer requests _(to be evaluated for v2)_
- Partial GRNs _(a single GRN covers the whole issuance)_
- Mobile native app _(web application, mobile-responsive)_

---

## Open Questions for Stakeholders

The following items are still outstanding and need confirmation before go-live:

| #     | Question                                               | Impact                                                    |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- |
| OQ-01 | What is the confirmed application name?                | Used in branding, email sender address, and notifications |
| OQ-04 | Will recurring / standing transfer requests be needed? | Affects how the transfer workflow is designed             |

> **Note**: The multi-warehouse question (OQ-05) has been resolved — version 1.0 will run with a single warehouse, but the architecture will make it straightforward to expand in v2.

---

## Delivery Milestones

| Milestone                 | What it means                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **M1 — Foundation Ready** | Database, authentication, and role-based access working; all user accounts can be created and logged in |
| **M2 — MVP End-to-End**   | A complete transfer from request to GRN can be performed and verified in a test environment             |
| **M3 — Admin & Polish**   | Administration tools, notifications, exports, and accessibility checks complete; ready for go-live      |

---

## Rough Effort Estimate

| Area                                          | Estimated Development Time |
| --------------------------------------------- | -------------------------- |
| Foundation (auth, database, roles)            | 3–5 days                   |
| Transfer request workflow (end-to-end)        | 5–8 days                   |
| GRN & variance handling                       | 2–3 days                   |
| Administration, notifications, tests & polish | 3–5 days                   |
| **Total**                                     | **13–21 development days** |

---

## Assumptions

- The product catalogue will be populated (seeded or manually entered) before go-live.
- Each SBU will have at least one Business Unit Manager and one Unit Staff member at launch.
- Users will have reliable internet access during business hours.
- An SMTP email account or transactional email service will be provided for outbound notifications.

---

_Prepared by the Harvest WMS development team · Questions? Reach out to the project lead._
