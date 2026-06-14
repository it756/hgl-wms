# Harvest WMS — Stitch AI UI Prompt

**Project**: Harvest WMS (Warehouse Management System)
**Device**: Desktop web application
**Style**: Clean, professional enterprise SaaS. Light mode. Sidebar navigation. Neutral grays with a deep teal primary accent (#0F766E). Inter font. 8px border radius. High data density but generous whitespace.

---

## Global Design System

Use the following as the consistent design language across all screens:

- **Primary color**: Deep teal `#0F766E`
- **Accent / action**: Amber `#D97706` for alerts and low-stock warnings
- **Success**: Green `#16A34A`
- **Danger**: Red `#DC2626`
- **Background**: `#F8FAFC` page, `#FFFFFF` cards
- **Text**: `#0F172A` primary, `#64748B` muted
- **Font**: Inter
- **Sidebar**: Dark sidebar `#1E293B` with white icons and labels; active item highlighted with teal
- **Status badges**: Pill-shaped, color-coded (see status colors below)
- **Status colors**:
  - PENDING → gray
  - PENDING_APPROVAL → amber
  - APPROVED_FOR_ISSUE → blue
  - ISSUED → indigo
  - COMPLETED → green
  - COMPLETED_WITH_VARIANCE → orange
  - CANCELLED → red
  - AWAITING_FINANCE_APPROVAL → amber
  - GRN_APPROVED → green
  - GRN_REJECTED → red

---

## Screen 1 — Login Page

Design a clean login page for **Harvest WMS**, a warehouse management system.

- Centered card on a light gray background
- Logo placeholder at the top ("Harvest WMS" wordmark with a small warehouse icon)
- Heading: "Sign in to your account"
- Fields: Email address, Password (with show/hide toggle)
- Primary CTA button: "Sign In" (full width, teal)
- "Forgot password?" link below the button
- Subtle footer: "© 2026 Harvest WMS"
- No registration link (admin-created accounts only)

---

## Screen 2 — Forgot Password

- Same centered card layout as Login
- Heading: "Reset your password"
- Subtext: "Enter your email and we'll send you a reset link."
- Single email field
- CTA: "Send Reset Link"
- Back link: "← Back to sign in"

---

## Screen 3 — Role-Based Dashboard (BU Manager)

Design a **Business Unit Manager dashboard** for Harvest WMS.

Layout: Dark left sidebar (collapsed icon + label nav) + main content area.

**Sidebar nav items** (icons + labels):

- Dashboard (active)
- My Transfer Requests
- Product Catalogue
- Notifications (with unread badge)
- My Profile

**Main content**:

- Top bar: "Good morning, [Name]" with SBU name chip ("Finance & Admin SBU") and notification bell icon
- **KPI cards row** (4 cards):
  - Pending Requests: 3
  - Issued (in transit): 1
  - Completed this month: 12
  - Cancelled: 0
- **Recent Requests table**: columns — Reference, Products, Requested Date, Status (badge), Actions
  - Show 3 sample rows with realistic data and colored status badges
- **Quick action button**: "+ New Transfer Request" (teal, top right of table section)

---

## Screen 4 — Role-Based Dashboard (Warehouse Manager)

Design a **Warehouse Manager dashboard** for Harvest WMS.

**Sidebar nav items**:

- Dashboard (active)
- Issuance Queue
- Supplier GRNs
- Inventory / Products
- Notifications
- My Profile

**Main content**:

- KPI cards: Pending Requests (5), Awaiting Finance Approval (2), Low Stock Items (3), Completed Today (4)
- **Low Stock Alerts** panel: list of 3 products with current stock vs threshold, amber warning icon
- **Issuance Queue preview**: top 3 pending/approved requests, with SBU name, reference, date, status badge, and "Issue Goods" action button

---

## Screen 5 — Role-Based Dashboard (Finance Manager)

Design a **Finance Manager dashboard** for Harvest WMS.

**Sidebar nav items**:

- Dashboard (active)
- Transfer Approvals
- Supplier GRN Approvals
- Notifications
- My Profile

**Main content**:

- KPI cards: Awaiting Approval (4), Approved Today (2), Rejected (1), Total Value Pending (KES 48,500)
- **Pending Approvals table**: Reference, SBU, Estimated Value, Raised By, Date, Status badge, Actions (Approve / Reject buttons)
- Show 3 rows of realistic sample data

---

## Screen 6 — Transfer Requests List (BU Manager)

A full-page list view of transfer requests for the current BU Manager's SBU.

- Page title: "My Transfer Requests"
- "+ New Request" button (top right, teal)
- **Filter bar**: Status dropdown (All / Pending / Issued / Completed / Cancelled), Date range picker, Search by reference
- **Table**: Reference, Products (count), Requested Date, Required By, Status (badge), Actions (View / Cancel)
- Show 6–8 rows with varied statuses
- Pagination at the bottom

---

## Screen 7 — New Transfer Request Form

A multi-step or single-page form for a BU Manager to raise a new transfer request.

- Page title: "New Transfer Request"
- **Form fields**:
  - Required Date (date picker)
  - Notes (textarea, optional)
- **Line Items section** (dynamic table):
  - Columns: Product (searchable dropdown from catalogue), Unit of Measure (auto-filled), Requested Quantity (number input), Remove (×)
  - "+ Add Product" button to add rows
  - Minimum 1 line item required
- **Estimated Value** (auto-calculated display, read-only, shown if products have unit costs)
- Finance approval notice: amber banner shown when estimated value exceeds threshold ("This request requires Finance Manager approval before goods can be issued.")
- Bottom actions: "Cancel" (secondary) and "Submit Request" (primary teal)

---

## Screen 8 — Transfer Request Detail (Read-Only)

A detail page for viewing a single transfer request, accessible to all roles (with role-appropriate actions).

- Page title: "Transfer Request TRF-2026-00042"
- Status badge (large, prominent)
- **Info cards row**: SBU, Raised By, Raised On, Required By, Estimated Value
- **Finance Approval section** (shown when applicable): Approved By, Approved At, Finance Notes
- **Line Items table**: Product, SKU, Requested Qty, Issued Qty (if issued), Variance (if GRN submitted)
- **Timeline / Audit trail**: vertical stepper showing PENDING → APPROVED → ISSUED → COMPLETED with timestamps and actors
- Action buttons (contextual by role and status): "Cancel Request" (BU Manager, only when PENDING), "Record Issuance" (Warehouse Manager, only when APPROVED_FOR_ISSUE)

---

## Screen 9 — Warehouse Issuance Queue

The Warehouse Manager's queue of transfer requests ready for issuance.

- Page title: "Issuance Queue"
- **Tabs**: All | Pending Approval | Approved for Issue | Issued Today
- **Table**: Reference, SBU, Products (count), Required By, Estimated Value, Status badge, Stock Status (green tick / red warning), Actions ("Issue Goods" button)
- Inline stock availability indicator next to each row — green if all products have sufficient stock, amber if partial, red if any product is out of stock
- Clicking "Issue Goods" opens a side panel or navigates to the issuance form

---

## Screen 10 — Record Issuance Form

A form for the Warehouse Manager to record goods being issued against a specific transfer request.

- Page title: "Record Issuance — TRF-2026-00042"
- Info banner: SBU name, requested date, required by date
- **Line Items table (editable)**:
  - Columns: Product, SKU, Requested Qty, Current Stock (live, read-only), Quantity to Issue (number input), Shortfall Reason (text input, required if Qty to Issue < Requested Qty)
  - Red row highlight if issuing quantity exceeds current stock
- **Logistics Notes** textarea (optional)
- Bottom summary: total items, total stock impact
- Actions: "Cancel" and "Confirm Issuance" (teal, disabled until all rows are valid)

---

## Screen 11 — GRN Submission Form (Unit Staff)

A form for Unit Staff to acknowledge physical receipt of goods.

- Page title: "Submit Goods Received Note"
- Info panel: Transfer reference, SBU, Issued By, Issue Date
- **Line Items table (editable)**:
  - Columns: Product, Issued Quantity, Quantity Received (number input, pre-filled with issued qty), Variance (auto-calculated, shown in red if negative), Variance Notes (text input, required if variance exists)
- **Acknowledgement checkbox**: "I confirm that the above quantities reflect the goods physically received." (required to submit)
- **Date Received** (date picker, defaults to today)
- **Condition Notes** (textarea, optional)
- Actions: "Cancel" and "Submit GRN" (teal, disabled until checkbox ticked)

---

## Screen 12 — Finance Approval Queue (Transfer Requests)

A queue page for the Finance Manager to review and act on transfer requests requiring approval.

- Page title: "Transfer Request Approvals"
- **KPI row**: Pending (4), Approved Today (2), Rejected (1)
- **Table**: Reference, SBU, Raised By, Estimated Value, Date Raised, Days Waiting, Status badge, Actions (View | Approve | Reject)
- Rows with high estimated value shown with an amber "High Value" chip
- Approve / Reject open a compact confirmation modal with a notes field
- Clicking a reference navigates to the Transfer Request Detail page

---

## Screen 13 — Supplier GRN Form (Warehouse Manager)

A form for the Warehouse Manager to record goods received from an external supplier.

- Page title: "Record Supplier GRN"
- **Form fields**:
  - Supplier Name (text input)
  - Invoice Reference (text input, optional)
  - Invoice Amount (numeric input)
  - Date Received (date picker)
  - SBU Attribution (dropdown, which SBU this stock is for — optional)
- **Line Items table (dynamic)**:
  - Columns: Product (searchable dropdown), Unit of Measure (auto-filled), Quantity Received (number input), Unit Cost (numeric, optional), Remove (×)
  - "+ Add Product" button
- Finance approval notice: amber banner ("This GRN will be reviewed by the Finance Manager before stock levels are updated.")
- Actions: "Cancel" and "Submit Supplier GRN" (teal)

---

## Screen 14 — Supplier GRN Approvals (Finance Manager)

- Page title: "Supplier GRN Approvals"
- Table: GRN Reference, Supplier, Invoice Amount, Received By, Date Received, Status badge, Actions (Review | Approve | Reject)
- Clicking Review opens a detail side-panel showing all line items, supplier info, and invoice details
- Approve / Reject trigger a confirmation modal with an optional notes field

---

## Screen 15 — Admin: User Management

- Page title: "Users"
- "+ Invite User" button (top right — note: no self-registration, admin creates accounts)
- **Filter bar**: Role dropdown, SBU dropdown, Status (Active / Inactive)
- **Table**: Full Name, Email, Role (badge), SBU, Status (Active/Inactive toggle), Created, Actions (Edit | Deactivate)
- Role badge colors: BU Manager = blue, Warehouse Manager = teal, Unit Staff = gray, Finance Manager = purple, Admin = red

---

## Screen 16 — Admin: SBU Management

- Page title: "Strategic Business Units"
- "+ Add SBU" button
- **Table**: SBU Name, Code, Active Users, Finance Threshold Override, Status, Actions (Edit | Deactivate)
- Edit opens a side panel with: Name, Code, Finance Approval Threshold (numeric, overrides global), Active toggle

---

## Screen 17 — Admin: Product Catalogue

- Page title: "Product Catalogue"
- "+ Add Product" button
- **Filter bar**: Search by name/SKU, Status toggle (Active / Inactive)
- **Table**: SKU, Name, Unit of Measure, Current Stock, Low Stock Threshold, Unit Cost, Status, Actions (Edit | Adjust Stock | Deactivate)
- Rows where Current Stock ≤ Low Stock Threshold are highlighted with an amber left border
- "Adjust Stock" opens a modal with: Adjustment Type (Add / Remove), Quantity, Mandatory Reason field

---

## Screen 18 — Admin: Settings

- Page title: "System Settings"
- **Sections**:
  - **Finance Approvals**: Finance Approval Threshold (numeric input), Finance Approval Scope (Global / Per SBU radio), Save button
  - **Session**: Session Timeout (minutes, numeric input)
  - **Notifications**: Low Stock Alerts (toggle), Email Notifications (toggle)
- Each section is a distinct card with a section heading and a Save button

---

## Screen 19 — Admin: Audit Log

- Page title: "Audit Log"
- **Filter bar**: Entity Type (Transfer Request / Issuance / GRN / Product / User / All), Performed By (user search), Date Range picker, Export CSV button
- **Table**: Timestamp, Performed By, Entity Type, Entity ID (linkable), Action, Previous Value (collapsed JSON), New Value (collapsed JSON)
- Rows are read-only; no delete or edit actions
- JSON diff columns expandable inline with a "View" toggle

---

## Screen 20 — Admin: Data Exports

- Page title: "Export Data"
- **Export cards** (grid of 4):
  - Transfer Requests
  - Issuances
  - GRNs
  - Audit Log
- Each card shows: icon, title, description, Date Range (start/end date pickers), and an "Export CSV" button
- Success toast on export: "Export ready — your download will start shortly."

---

## Screen 21 — Notifications Panel

A full-page notifications view (also rendered as a dropdown panel accessible from the top bar).

- Page title: "Notifications"
- **Tabs**: All | Unread
- **Notification list**: each item shows:
  - Icon (color-coded by type — transfer, issuance, GRN, approval, alert)
  - Message text (e.g., "TRF-2026-00042 has been approved for issuance.")
  - Relative timestamp ("2 hours ago")
  - Unread indicator (blue dot on left edge)
  - Clickable — navigates to the related entity
- "Mark all as read" button (top right)
- Notifications cannot be deleted (per spec)

---

## Screen 22 — Product Catalogue (Read-Only, BU Manager)

A read-only catalogue view shown to BU Managers when browsing products before raising a request.

- Page title: "Product Catalogue"
- **Search bar** and Category filter
- **Card grid or table**: Product Name, SKU, Unit of Measure, Description, Status (Active only shown)
- No stock quantities shown to BU Managers (warehouse-only data)
- "Request Transfer" button on each card/row that pre-fills the product in the New Transfer Request form

---

_End of prompts. Each screen above is self-contained and can be pasted individually into Stitch AI's "Generate screen from text" input._
