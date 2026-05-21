<!--
Sync Impact Report

Version change: [unknown] -> 1.0

Modified principles:
- [PRINCIPLE_1_NAME] -> P1 — Scoped Visibility
- [PRINCIPLE_2_NAME] -> P2 — Audit Trail First
- [PRINCIPLE_3_NAME] -> P3 — Transfer Request Required
- [PRINCIPLE_4_NAME] -> P4 — GRN Closes the Loop
- [PRINCIPLE_5_NAME] -> P5 — Single Warehouse, Multiple Tenants
- Additional principles: P6 — Notifications Are Non-Negotiable; P7 — Role Integrity

Added sections:
- Project Identity, Vision, Scope, Actors, Data Ownership, Workflow Governance, Notification Rules,
  Constraints & Assumptions, Change Control

Removed sections: none

Templates requiring updates:
- .specify/templates/plan-template.md: ⚠ pending (review for governance alignment)
- .specify/templates/spec-template.md: ⚠ pending (ensure required sections reflect new principles)
- .specify/templates/tasks-template.md: ⚠ pending (task categories may need updates)

Follow-up TODOs:
- TODO(RATIFICATION_DATE): set ratification date when constitution is formally adopted
-->

# Harvest WMS — Project Constitution

**Version:** 1.0 | **Status:** Working Draft | **Owner:** Harvest Group of Companies

---

## 1. Project Identity

| Field                | Detail                                                          |
| -------------------- | --------------------------------------------------------------- |
| Working Title        | Harvest WMS _(rename before go-live)_                           |
| Type                 | Internal browser-based web application                          |
| Owner                | Harvest Group of Companies                                      |
| Primary Stakeholders | Warehouse Manager, Business Unit Managers, System Administrator |
| Scope Version        | v1.0                                                            |

---

## 2. Vision Statement

A single, trusted source of truth for all warehouse stock movements — giving each Business Unit visibility of their own allocations, giving the Warehouse Manager control over issuance, and giving the organisation an auditable record of every transfer from request to receipt.

---

## 3. Scope

### 3.1 In Scope (v1.0)

- Transfer raised by Business Unit Managers to issue goods out the central warehouse
- Goods issuance recording and stock decrement
- GRN (Goods Received Note) acknowledgement by Unit Staff
- Real-time in-app and email notifications at every workflow transition
- Role-based dashboards with scoped data visibility
- Financial approval workflow for transfer requests that require budget or finance sign-off
- System administration: users, SBUs, products, settings, audit logs

### 3.2 Out of Scope (v1.0)

- Financial valuation, costing, or invoicing of transfers
- Supplier management
- Physical stock count / stocktake module
- Native mobile application (iOS / Android)
- ERP or accounting system integration
- Multi-warehouse or multi-location support

---

## 4. Core Principles

These principles are non-negotiable. Any feature or design decision that conflicts with them must be escalated before implementation.

**P1 — Scoped Visibility**
A Business Unit Manager shall only see inventory, transfer requests, and history belonging to their own SBU. They shall never see stock levels, request data, or activity from another SBU.

**P2 — Audit Trail First**
Every action — request submission, approval, rejection, issuance, acknowledgement, and cancellation — must be timestamped and attributed to a named user. No destructive deletes. Records are immutable once finalised.

**P3 — Transfer Request Required**
No goods may be issued without a corresponding transfer request. The BU Manager creates one; the Warehouse Manager issues. There is no shortcut, override, or emergency bypass in v1.0.

**P4 — GRN Closes the Loop**
A transfer is not considered complete until the receiving Unit Staff has submitted a Goods Received Note. The system tracks all transfers as open until GRN is submitted.

**P5 — Single Warehouse, Multiple Tenants**
The warehouse is shared across 4–10 SBUs. Stock is centrally held but access is role-filtered. Each BU sees only what is relevant to them.

**P6 — Notifications Are Non-Negotiable**
The system must actively push notifications (email + in-app) at every workflow transition. No actor should need to check the system to discover their next required action.

**P7 — Role Integrity**
Roles are mutually exclusive. A user may not hold two roles simultaneously. A BU Manager cannot also be a Warehouse Manager or Unit Staff.

**P8 — Financial Oversight for Valued Movements**
Transfers that cross configured monetary thresholds or otherwise require budgetary approval must be approved by a designated Finance Manager before the Warehouse Manager may issue goods or the system increases stock attributable to an SBU. Finance approvals are recorded in the audit trail and are immutable once granted.

---

## 5. Actors and Responsibilities

| Actor                     | Core Responsibility                                                                                                                 | System Access Boundary                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **System Administrator**  | User management, SBU configuration, system settings, audit log access                                                               | Full system access                                                   |
| **Warehouse Manager**     | Review and action transfer requests, issue goods, manage inventory                                                                  | All SBUs — full warehouse view                                       |
| **Business Unit Manager** | Raise transfer requests, monitor request status, cancel pending requests                                                            | Own SBU only                                                         |
| **Unit Staff**            | Receive transferred goods, submit GRN acknowledgement                                                                               | Own SBU's issued transfers only                                      |
| **Finance Manager**       | Approve transfer requests that require budgetary sign-off; approve supplier GRNs before stock increments; review financial variance | Finance scope; sees monetary fields, approvals, and audit-only views |

---

## 6. Data Ownership and Visibility Rules

| Data Type                  | Owner                     | Visible To                                                                         |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| Product catalogue          | Warehouse Manager / Admin | Warehouse Manager, Admin (full); BU Managers (read-only, available products)       |
| Warehouse stock levels     | Warehouse Manager         | Warehouse Manager, Admin                                                           |
| Transfer requests          | Raising BU Manager        | Warehouse Manager, Admin, BU Manager (own SBU), Unit Staff (own SBU — issued only) |
| GRN records                | Submitting Unit Staff     | BU Manager (own SBU), Warehouse Manager, Admin                                     |
| User and SBU configuration | System Administrator      | Admin only                                                                         |
| Audit logs                 | System                    | Admin only                                                                         |

---

## 7. Workflow Governance Rules

1. Transfer requests **cannot be edited after submission**. Cancellation and re-submission is required for any change.

2. The Warehouse Manager cannot partially fulfill a request for stock that the warehouse does not have; requests raising unavailable stock must be rejected and returned to the originating BU Manager.

3. **Cancellation** of a PENDING request is allowed only by the originating BU Manager, and only before the Warehouse Manager has actioned it.

4. Once a **GRN is submitted**, the transfer is locked. No further edits or additions.

5. A transfer flagged as **COMPLETED WITH VARIANCE** (GRN quantities differ from issued quantities) must notify the Warehouse Manager automatically.

---

## 8. Notification Rules

| Trigger Event                   | Notified Party                 | Channel        |
| ------------------------------- | ------------------------------ | -------------- |
| New transfer request raised     | Warehouse Manager              | Email + In-app |
| Goods issued                    | Unit Staff (own SBU)           | Email + In-app |
| GRN submitted (no variance)     | BU Manager + Warehouse Manager | In-app only    |
| GRN submitted (with variance)   | BU Manager + Warehouse Manager | Email + In-app |
| Request cancelled by BU Manager | Warehouse Manager              | In-app only    |

---

## 9. Constraints and Assumptions

- The system is **browser-based only**. No native mobile app in v1.0.
- **4 to 10 SBUs** will be registered at any given time. The system must support this range without architectural changes.
- All users must authenticate with **individual credentials**. Shared logins are strictly prohibited.
- A **single warehouse location** is assumed. Multi-warehouse support is out of scope for v1.0.
- **Internet connectivity** is assumed for all users. No offline mode is required.
- The Warehouse Manager role is held by **one named user** at a time in v1.0.
- Business hours are defined as **CAT (UTC+2), Monday to Friday, 07:00–18:00**.

---

## 10. Change Control

| Change Type                           | Process                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Scope, role, or workflow rule changes | Requires sign-off from System Administrator and Warehouse Manager before implementation |
| Data model changes                    | Requires developer review and changelog entry; notify Admin                             |
| UI/UX, wording, label changes         | Developer discretion with changelog entry                                               |
| Security or authentication changes    | Requires Admin sign-off                                                                 |

All changes must be logged against the relevant document version. This constitution is versioned independently of the specification.

---

_Document maintained by: System Administrator_
_Next review: Prior to v1.0 release and at each major version increment_

**Governance**:

Amendments to this constitution require a documented change request, sign-off by the System Administrator and Warehouse Manager,
and an entry in the project's change log. Versioning follows semantic principles for governance: MAJOR for principle or governance
redefinitions, MINOR for new principles or significant additions, PATCH for clarifications and typos.

**Version**: 1.0 | **Ratified**: TODO(RATIFICATION_DATE): set on formal adoption | **Last Amended**: 2026-05-20
