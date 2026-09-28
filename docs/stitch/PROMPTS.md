# Harvest LPGMS — Google Stitch Screen Prompts

**Design system:** Reference `DESIGN.md` in this folder for all tokens, component specs, and anti-patterns before generating any screen.  
**Component library (build target):** shadcn/ui  
**Shell:** Dark icon rail (64px) → Secondary sidebar (240px, Slate-800) → White content canvas → Topbar breadcrumb  
**Authorization model:** SAP B1 pattern — one system, permission-driven nav. No per-actor dashboards.  
**Approval chain visual:** 4-stage horizontal stepper bar (Stripe/Linear style) pinned below topbar on all detail pages.  
**Finance:** No standalone Finance rail item. Finance actions appear as tabs embedded inside Procurement, Stock Adjustment, and S&D detail/overview pages.

---

## How to use these prompts in Stitch

1. Upload `DESIGN.md` to your Stitch project as the Design System reference.
2. Paste each numbered prompt below as a **new screen** in your Stitch project.
3. Work module by module — complete all screens in one module before starting the next.
4. Stock Adjustment (Module 05) is the **reference implementation** — complete it first, then use its component patterns when generating later modules.

---

# MODULE 00 — App Shell

## S00-01 — App Shell: Full Chrome

```
Design a desktop web application shell for an enterprise LPG management system called "Harvest LPGMS". The layout has three fixed vertical zones:

LEFT ZONE — Icon Rail (64px wide, full viewport height):
Background: #0F172A (Slate-950). Contains vertical stack of icon-only navigation items. Each icon is 22px, color #94A3B8 when inactive. The active module shows a Sky-500 (#0EA5E9) pill/highlight behind the icon and the icon turns #F1F5F9. Rail items from top: Home (house icon), CRM (users icon), Procurement (shopping-cart icon), GR Receiving (package icon), Stock Adjustment (layers icon), S&D Sales (truck icon), POS Point-of-Sale (receipt/cash-register icon), Inland Logistics (map-pin icon), Transport (calculator icon), Admin (shield icon). Divider line. Two locked Phase 2 items at bottom with 50% opacity and a small lock overlay: CEO Dashboard, F&M Costing. At very bottom: user avatar circle (initials "DO") and settings gear icon. No text labels in rail — tooltip appears on hover.

MIDDLE ZONE — Secondary Sidebar (240px wide, full viewport height):
Background: #1E293B (Slate-800). Shows the nav tree for the currently active module. At top: module name in 11px / 600 / #94A3B8 / uppercase / letter-spacing 0.08em. Below: grouped nav items. Group labels are non-clickable, 11px / 500 / #64748B / uppercase. Nav items are 13px / 500 / #CBD5E1, hover state: #F1F5F9 text + #334155 background, rounded-md. The active nav item has a 2px Sky-500 left border and slightly lighter background. Approval queue items show a count badge: Sky-500 background, white text, 11px Geist Mono, pill shape. Example active module shown: Stock Adjustment. Items: [Overview / Awaiting My Action], group "Weekly Stock Take" [Bulk Tank Meter Reading, Cylinder Weigh Count, Stock Total by Location], group "Adjustment Requests" [Submit Adjustment, OM Approval Queue (badge: 3), IC Review Queue (badge: 1), Finance Posting (badge: 2), Declined / Returned].

RIGHT ZONE — Content Canvas (fills remaining width):
Background: #F8FAFC. Contains: Topbar (52px, white, 1px #E2E8F0 bottom border) with breadcrumb "Stock Adjustment / Adjustment Requests / OM Approval Queue" on left in 14px Geist Sans Muted Slate, and on right: notification bell with amber dot, user avatar circle "DO", role chip "Ops Manager" in Slate-100 background. Content area below topbar with 32px padding shows the Stock Adjustment Overview page (placeholder — a KPI bar + empty table state).

Font: Geist Sans for all UI, Geist Mono for all numbers. No Inter. No decorative gradients. No illustrations.
```

---

## S00-02 — Home Dashboard (Permission-Driven)

```
Design the Home dashboard screen for Harvest LPGMS inside the established shell (dark icon rail left, Slate-800 secondary sidebar, white topbar with breadcrumb "Home").

The Home screen has one purpose: surface everything awaiting the logged-in user's action, regardless of which module it lives in. Content is permission-driven — not a role-specific template.

Page header block:
- Left: Page title "Home" in 24px / 700 / Geist Sans / #0F172A. Subtitle "Good morning, David — here's what needs your attention" in 14px / Muted Slate.
- Right: Nothing (no primary CTA on Home).

Below header: Three column sections in a 5-4-3 asymmetric grid layout:

COLUMN 1 — "Pending on me" (widest, ~45% width):
A vertical list of action items grouped by module. Each item: module chip (e.g. "Stock Adjustment" in Amber-50/Amber-700, "Procurement" in Sky-50/Sky-700) + item title + time-ago in Geist Mono. Items are clickable rows with a right-arrow on hover. Show 6–8 items with varied modules. At bottom: "View all pending" link in Sky-500. Example items:
- [Stock Adjustment] "SA-2024-089 awaiting your approval" — 2h ago
- [Procurement] "PO-2024-112 compliance docs pending review" — 4h ago
- [GR] "Weekly recon sign-off — week 48" — 1d ago
- [Stock Adjustment] "SA-2024-088 returned — revision required" — 1d ago

COLUMN 2 — "My modules" (~35% width):
A grid of 2×N module shortcut tiles. Each tile: module icon + module name + count of open items. Tile bg: Surface White, 1px border, rounded-xl, hover lifts with subtle shadow. Only show modules the user is authorized for.

COLUMN 3 — "Recent activity" (~20% width):
A narrow activity feed. Each row: avatar initials circle + action description + time-ago. 12px Geist Sans. Light Whisper Border dividers. Example: "FIN posted SA-2024-087 • 3h ago". 8 items, scrollable.

Font: Geist Sans and Geist Mono. Canvas background #F8FAFC. No illustrations. No emojis.
```

---

# MODULE 05 — Stock Adjustment _(Reference Implementation — build first)_

---

## S05-01 — Stock Adjustment Overview

```
Design the Stock Adjustment Overview page for Harvest LPGMS. This is inside the shell (dark icon rail, Slate-800 sidebar with "Stock Adjustment" module active, white topbar showing breadcrumb "Stock Adjustment / Overview").

Page header block:
- Left: "Stock Adjustment" 24px / 700 / Geist Sans. Subtitle: "Depot stock reconciliation and variance management."
- Right: "Submit New Adjustment" button — Sky-500 background, white text, 40px height, rounded-md. Renders only if user has Submit authorization.

Below header: KPI bar — 4 stat cards in a row (not equal-width, use organic widths):
1. "This Week's Variance" — value: "−148 kg" in 32px / 700 / Geist Mono / Red-500 (negative). Label: "vs. expected stock". Delta chip: "↑ 12 kg vs. last week" in Red.
2. "Pending Approvals" — value: "6" in Amber-700 Geist Mono. Label: "adjustments awaiting action".
3. "Posted This Month" — value: "23" in Emerald-700 Geist Mono. Label: "adjustments finalized".
4. "Avg. Processing Time" — value: "1.4 days" in Geist Mono. Label: "submit to finance post".

Below KPIs: Two panels side by side (60/40 split):

LEFT PANEL — "Recent Adjustment Requests" table:
Columns: Ref #, Date, Location, Variance (kg), Submitted by, Status (chip), Action (icon).
Show 6 rows with varied statuses: 1 Draft, 2 Awaiting OM, 1 Awaiting IC, 1 Posted, 1 Declined.
All values in Geist Mono for numbers. Status chips per DESIGN.md spec.

RIGHT PANEL — "Awaiting My Action" list:
Title "Awaiting My Action" in 16px / 600. If user has approval authorization, shows items with action buttons. If not, shows "Nothing pending your action" empty state with a small checkmark icon. Show 3–4 items with Approve/Review/Post buttons as appropriate.

Canvas background: #F8FAFC. Whisper Border between panels. No decorative elements.
```

---

## S05-02 — Weekly Stock Take: Bulk Tank Meter Reading

```
Design the "Bulk Tank Meter Reading" data-entry form page for Harvest LPGMS inside the shell (breadcrumb: "Stock Adjustment / Weekly Stock Take / Bulk Tank Meter Reading").

This is a depot floor data-entry screen. The Depot Manager (or authorized floor user) records meter readings from physical bulk tanks.

Page header:
- Title: "Bulk Tank Meter Reading" 24px / 700 / Geist Sans.
- Subtitle: "Week 48 • 25 Nov – 1 Dec 2024" — in Geist Mono / Muted Slate.
- Right: "Save Draft" ghost button + "Proceed to Cylinder Count →" Sky-500 button (disabled until all fields complete).

Layout: Single-column form, max-width 720px, centered in content area.

Form sections:

Section 1 — "Tank Readings" (labeled divider):
A table-form hybrid: each row is one tank. Columns: Tank ID (Geist Mono, read-only, Slate-600), Location (read-only), Opening Reading (input, Geist Mono), Closing Reading (input, Geist Mono), Calculated Variance (auto-filled, read-only, Red-500 if negative). Show 4 tanks: T-001 (Lusaka Depot), T-002 (Lusaka Depot), T-003 (Ndola), T-004 (Ndola). Last column: variance auto-calculates on input blur.

Section 2 — "Notes & Observations":
Textarea labeled "Notes (optional)" — placeholder: "Record any anomalies, meter faults, or environmental conditions that may explain variance." 3 rows height.

Section 3 — "Submission":
Info banner (Sky-50 bg, Sky-500 left border): "This reading will be combined with the Cylinder Count to produce the total weekly stock position. You cannot submit an Adjustment Request until both steps are complete."
Two buttons: "Save Draft" and "Mark as Complete & Proceed →" (Sky-500, full-width at mobile, right-aligned at desktop).

Progress indicator at top: a 3-step horizontal mini-wizard bar: [1. Bulk Tank Reading ●] — [2. Cylinder Count ○] — [3. Stock Total ○]. Step 1 active/filled in Sky-500.

Font: Geist Sans labels, Geist Mono for all numeric inputs and IDs. No decorative elements.
```

---

## S05-03 — Weekly Stock Take: Cylinder Weigh Count

```
Design the "Cylinder Weigh Count" data-entry page for Harvest LPGMS (breadcrumb: "Stock Adjustment / Weekly Stock Take / Cylinder Weigh Count").

3-step progress bar at top: Step 1 complete (checkmark, Emerald-500) — Step 2 active (Sky-500) — Step 3 pending.

Page header:
- Title: "Cylinder Weigh Count" 24px / 700.
- Subtitle: "Week 48 • Record actual cylinder weights by size category."
- Right: "Save Draft" ghost + "Proceed to Stock Total →" Sky-500 (disabled until complete).

Layout: Two-column form (60/40), max-width 900px.

LEFT COLUMN — "Cylinder Count by Category":
A structured data-entry grid. Rows = cylinder size (3kg, 6kg, 12.5kg, 19kg, 48kg). Columns: Size, Expected Count (read-only, Geist Mono, Slate-600), Actual Count (input, Geist Mono), Expected Weight kg (read-only, Geist Mono), Actual Weight kg (auto-calc from count × avg fill weight, Geist Mono), Variance kg (auto-calc, Red-500 if negative).

At table bottom: totals row — "Total" label, bold summed values in each Geist Mono column. The total variance field is highlighted with a Amber-50 background if > ±50 kg.

RIGHT COLUMN — "Location Breakdown":
Sub-section title "By Location" in 16px / 600.
Tabs: "Lusaka Depot" | "Ndola" | "In-Transit". Each tab shows a mini version of the same count grid filtered by location. Active tab underlined with Sky-500.

Below: "Discrepancy Flags" sub-panel. If any cylinder category shows >5% variance, it auto-flags here with a Red-50 banner: "12.5kg cylinders: −47 kg (−8.2%) — review required before proceeding."

Right column also contains: "Notes for this count" textarea.

Font: Geist Sans / Geist Mono. No spinners. No illustrations.
```

---

## S05-04 — Weekly Stock Take: Stock Total by Location

```
Design the "Stock Total by Location" read-only summary page for Harvest LPGMS (breadcrumb: "Stock Adjustment / Weekly Stock Take / Stock Total by Location").

3-step progress bar at top: Steps 1 and 2 complete (Emerald), Step 3 active (Sky-500).

This screen auto-calculates and displays the consolidated stock position from the two previous steps. No inputs — display only, with a submit action at the end.

Page header:
- Title: "Stock Total by Location — Week 48"
- Subtitle: "System-calculated from Bulk Tank Reading + Cylinder Count. Review and submit for approval if a variance adjustment is required."
- Right: "Submit Adjustment Request →" Sky-500 button (prominent, appears if variance outside tolerance band). "No Adjustment Needed" ghost button (closes the week as balanced).

Main content: Full-width summary table — Location × Product:
Columns: Location, Product (Bulk LPG / 3kg / 6kg / 12.5kg / 19kg / 48kg), Expected (kg), Actual (kg), Variance (kg), Variance %, Status.
Rows: Lusaka Depot Bulk, Lusaka Depot Cylinders (sub-rows by size), Ndola Depot Bulk, Ndola Depot Cylinders, In-Transit. Show totals row at bottom.

Variance column: Geist Mono, Red-500 for negative, Emerald-500 for positive, Slate-500 for zero.
Status column: chips — "Within Tolerance" (Emerald-50/Emerald-700), "Variance — Action Required" (Red-50/Red-700), "Minor Variance" (Amber-50/Amber-700).

Below table: Tolerance Band Info banner (Slate-50 bg, Slate-400 left border, 13px Geist Sans):
"Tolerance band: ±2% of expected weekly throughput. Variances within band auto-close. Variances outside band require a formal Adjustment Request (SA-XXXX) through the 4-stage approval chain."

Font: Geist Sans / Geist Mono. All numbers in Geist Mono.
```

---

## S05-05 — Submit Adjustment Request (Form)

```
Design the "Submit Adjustment Request" form page for Harvest LPGMS (breadcrumb: "Stock Adjustment / Adjustment Requests / Submit Adjustment"). This screen is the starting point of the 4-stage approval chain.

The 4-stage approval stepper is visible at top, BELOW the topbar, ABOVE all content. It is in its initial state: Stage 1 "Submit" is active/Sky-500, Stages 2–4 are pending/locked. Full-width, 52px height. Stages: [1. Submit — Depot Manager] ——— [2. OM Approve — Ops Manager] ——— [3. IC Review — Internal Control] ——— [4. Finance Post — Finance]. Actor labels appear below each stage node in 11px Geist Sans Muted Slate. The connecting lines between stages are Whisper Border (not yet completed).

Below stepper: two-column layout (65/35).

LEFT COLUMN — Form:
Page title "New Adjustment Request" 24px / 700 in the content area (not repeated in topbar).

Form fields (label above, Geist Sans):
- "Adjustment Reference" — auto-generated, read-only: "SA-2024-090" in Geist Mono Slate-600
- "Week Ending Date" — date picker, pre-filled from stock take session
- "Location" — dropdown: Lusaka Depot / Ndola / In-Transit
- "Product Category" — multi-select chips: Bulk LPG / 3kg / 6kg / 12.5kg / 19kg / 48kg
- "Variance Amount (kg)" — number input, Geist Mono, shows Red-500 border if negative
- "Variance Type" — radio group: "Physical Loss" / "Measurement Discrepancy" / "Transfer Difference" / "Damage Write-Off"
- "Adjustment Direction" — toggle: "Stock Down (−)" / "Stock Up (+)" with Sky-500 active state
- "Reason / Explanation" — textarea, required, 4 rows
- "Supporting Documents" — file upload dropzone (drag & drop or click), accepts PDF/JPG/PNG, max 10MB per file

Section divider: "Declaration"
Checkbox: "I confirm the above figures are accurate to the best of my knowledge." Required.

Submit button: "Submit for OM Approval →" full-width Sky-500 button, 44px height.

RIGHT COLUMN — Context Panel:
Title "Week 48 Stock Summary" in 16px / 600. Shows the calculated variances from the stock take (read-only mini-table, 13px Geist Mono). Below: "Attachment Checklist" — list of recommended supporting docs with checkmark icons.

Font: Geist Sans / Geist Mono. No floating labels.
```

---

## S05-06 — Adjustment Request Detail (4-Stage Stepper — OM Active)

```
Design the Adjustment Request detail page for Harvest LPGMS, with the 4-stage approval stepper in its second-stage active state (OM Approval). Breadcrumb: "Stock Adjustment / Adjustment Requests / SA-2024-089".

STEPPER BAR (full-width, pinned below topbar):
- Stage 1 "Submit": Emerald-500 filled, white text, checkmark icon. Line to Stage 2 is Emerald-500 (completed path).
- Stage 2 "OM Approve": Sky-500 filled, white text, pulse ring animation, ACTIVE state.
- Stage 3 "IC Review": Slate-200 filled, Slate-500 text, lock icon, PENDING.
- Stage 4 "Finance Post": Slate-200 filled, Slate-500 text, lock icon, PENDING.
- Below Stage 1: timestamp "Submitted by: Kunda M. • 25 Nov 2024, 09:14" in 11px Geist Mono Muted Slate.
- Below Stage 2: "Ops Manager • Awaiting action" in 11px Geist Sans Muted Slate.

BELOW STEPPER: Two-column layout (65/35).

LEFT COLUMN — Request Details (read-only on this page for OM viewing):
Page sub-title "Adjustment Request SA-2024-089" in 20px / 600 / Geist Sans.
Display-mode fields (not inputs, just labeled values): Reference, Week Ending, Location (Lusaka Depot), Product (12.5kg Cylinders), Variance Amount (−148 kg in Red-500 Geist Mono), Variance Type (Physical Loss), Reason ("Weighbridge calibration drift identified during maintenance check…"), Documents (2 attached PDF thumbnails with filename and download icon).

Below the fields: Declaration row: "Kunda Mutale confirmed accuracy • 25 Nov 2024, 09:14" in 13px Geist Sans with checkmark icon.

OM ACTION BLOCK (only renders if logged-in user is authorized Approve — Stock Adjustment):
Labeled section with Amber-50 background and Amber-500 left border, 16px padding, rounded-xl:
Title "Your Action Required" in 14px / 600.
"Approval Notes" textarea, optional, 3 rows, placeholder "Add any comments or conditions for IC review…".
Two action buttons side by side: [Approve & Forward to IC →] Emerald-500 bg white text | [Return to Submitter] Red-50 bg Red-700 text outline.

RIGHT COLUMN — Activity Log / Timeline:
Title "Activity" in 16px / 600.
Vertical timeline: each entry has avatar initials circle + actor name + action + timestamp. Latest at top.
Entries: "SA-2024-089 submitted by Kunda Mutale • 09:14", "OM review assigned to Patrick Banda • 09:15 (auto)".
Below timeline: "Related Documents" section — list of attached files with type icon, filename, uploader, date.

Font: Geist Sans / Geist Mono. No decorative elements.
```

---

## S05-07 — OM Approval Queue

```
Design the OM Approval Queue page for Harvest LPGMS (breadcrumb: "Stock Adjustment / Adjustment Requests / OM Approval Queue"). This is an approval-queue list screen visible only to users with "Approve — Stock Adjustment" authorization.

Page header:
- Title: "Pending OM Approvals" 24px / 700. Badge next to title: "4 pending" in Amber-50/Amber-700 pill.
- Subtitle: "Stock adjustments awaiting Operations Manager approval."
- Right: No CTA (this is a review queue, not a creation point).

Filter bar below header: Search input (placeholder: "Search by ref, location, or submitter") + Status filter (showing "Awaiting OM" pre-selected, chip with Sky-500 border) + Date range picker (default: last 30 days) + Location dropdown.

Main content: Full-width data table.
Columns: □ (checkbox), Ref # (Geist Mono), Week Ending (Geist Mono), Location, Product, Variance (Geist Mono, Red for negative), Submitted By, Date Submitted (Geist Mono), Days Waiting (Geist Mono — red if > 2), Status chip, Actions.

Show 4 rows all with "Awaiting OM" status chips (Amber-50/Amber-700):
1. SA-2024-089, Week 48, Lusaka, 12.5kg, −148 kg, Kunda Mutale, 25 Nov, 2 days
2. SA-2024-088, Week 47, Ndola, Bulk LPG, −62 kg, James Phiri, 18 Nov, 9 days (Days Waiting = Red-500)
3. SA-2024-087, Week 48, Lusaka, 3kg, −23 kg, Kunda Mutale, 25 Nov, 2 days
4. SA-2024-086, Week 48, Ndola, 19kg, +11 kg, James Phiri, 26 Nov, 1 day

Actions column (appears on row hover): [View →] icon button | [Quick Approve] Emerald-500 mini button (shows only if authorized) | kebab menu.

Below table: Bulk action bar (appears when rows are checked): "Approve Selected (2)" Emerald-500 button | "Return Selected" Red-50/Red-700 button.

Empty state (if no pending): centered composition — checkmark circle in Emerald-50 + "All clear" heading + "No adjustments awaiting your approval." subtext.

Font: Geist Sans / Geist Mono. All numeric values in Geist Mono.
```

---

## S05-08 — IC Review Queue

```
Design the IC Review Queue page for Harvest LPGMS (breadcrumb: "Stock Adjustment / Adjustment Requests / IC Review Queue"). Visible only to users with "Review — Stock Adjustment" authorization (Internal Control).

Page header:
- Title: "IC Review Queue" 24px / 700. Badge: "2 pending" in Violet-50/Violet-700 pill.
- Subtitle: "Adjustments approved by Operations Manager — awaiting Internal Control review."

The design is intentionally very similar to S05-07 (OM Approval Queue) with these differences:
- Badge color: Violet (IC stage color, per DESIGN.md)
- Status chips show "Awaiting IC Review" in Violet-50/Violet-700
- Actions column: [View →] | [Approve & Forward to Finance] Emerald-500 | [Return to OM] Red-50/Red-700 | kebab
- An additional column: "OM Approval Notes" — truncated text, expand on row hover

Show 2 rows:
1. SA-2024-085, Week 47, Lusaka, 6kg, −88 kg, approved by P. Banda, "Approved — check physical counts", 3 days in IC queue
2. SA-2024-084, Week 46, Ndola, Bulk LPG, −201 kg (Red-500, large variance), approved by P. Banda, "Escalated — large variance, full docs attached", 1 day in IC queue

For SA-2024-084: show an "Escalated" badge in Red-50/Red-700 in addition to the Awaiting IC chip (stacked).

Empty state same pattern as S05-07.

Font: Geist Sans / Geist Mono.
```

---

## S05-09 — Finance Posting Tab (Embedded in Adjustment Detail)

```
Design the Finance Posting view for Harvest LPGMS — this is the 4th stage of the adjustment detail page. The stepper shows: Stages 1, 2, 3 all complete (Emerald-500 filled, checkmark icons, timestamps below). Stage 4 "Finance Post" is ACTIVE (Sky-500 filled, pulse ring).

Breadcrumb: "Stock Adjustment / Adjustment Requests / SA-2024-083"

STEPPER BAR (same as S05-06 but all stages progressed):
Stage 1: Submitted by Kunda M. • 22 Nov • checkmark
Stage 2: Approved by P. Banda (OM) • 22 Nov • checkmark
Stage 3: Reviewed by M. Nkosi (IC) • 23 Nov • checkmark
Stage 4: Finance Post • ACTIVE • awaiting Finance action

BELOW STEPPER: Two-column (65/35).

LEFT COLUMN:
Sub-title "SA-2024-083 — Ready for Finance Posting" in 20px / 600.
Full request summary (read-only): all fields visible as in S05-06.

FINANCE POSTING BLOCK (renders only if user has "Post — Stock Adjustment" authorization):
Sky-50 background, Sky-500 left border, rounded-xl, 16px padding.
Title "Finance Posting" in 14px / 600 / Sky-700.
Fields:
- "GL Account" — text input, Geist Mono, placeholder "e.g. 1300-STOCK-LUSAKA", required
- "Cost Centre" — dropdown (Lusaka Depot / Ndola / Head Office)
- "Period" — read-only: "November 2024, Period 11" in Geist Mono
- "Posting Reference" — auto-generated: "FIN-ADJ-2024-083" in Geist Mono Slate-600 read-only
- "Finance Notes" — textarea, optional

Checkbox: "I confirm this adjustment has been authorized through the full approval chain (Submit → OM → IC) and is ready for GL posting."

Action buttons: [Post to GL →] Violet-500 bg white text | [Return to IC] Red-50/Red-700 outline.

RIGHT COLUMN — Activity Log: Full chain trail — all 4 stages with actor names, notes, timestamps.

Font: Geist Sans / Geist Mono.
```

---

## S05-10 — Declined / Returned with Reason Trail

```
Design the "Declined / Returned" view for a specific adjustment request in Harvest LPGMS (breadcrumb: "Stock Adjustment / Adjustment Requests / SA-2024-082").

STEPPER BAR:
Stage 1: Submitted — checkmark, Emerald.
Stage 2: DECLINED — Red-500 bg, X icon, text "Returned by OM". Line to Stage 3 is Red-400 (broken/dashed).
Stages 3 & 4: Greyed out, locked (because chain was broken at Stage 2).

BELOW STEPPER: Two-column (65/35).

LEFT COLUMN:
Page sub-title "SA-2024-082 — Returned for Revision" in 20px / 600.
Red-50 background alert banner at top of content: "This adjustment was returned by the Operations Manager on 20 Nov 2024 and requires revision before resubmission."

Show all original form fields as display-only values.

REVISION BLOCK (renders only if user has Submit authorization — i.e. the original submitter):
Amber-50 bg, Amber-500 left border, rounded-xl, 16px padding.
Title "Revision Required" 14px / 600 / Amber-800.
"Return Reason (from OM)" — read-only text in Red-50 bg: "Variance figure does not match attached photo evidence. Please recheck the 12.5kg count and re-attach clearer images."
"Revised Explanation" — textarea, required.
"Updated Supporting Documents" — file upload dropzone.
"Resubmit for OM Approval →" Sky-500 button.

RIGHT COLUMN — Full Reason Trail / Activity Log:
Every stage action shown in reverse-chronological order. The OM decline action is highlighted with Red-50 background row. Includes: who actioned, what action, timestamp, and full note text.

Font: Geist Sans / Geist Mono.
```

---

# MODULE 01 — CRM

---

## S01-01 — CRM Overview

```
certificates.

Submit button: "Submit PO for OM Approval →" Sky-500, full width at mobile.
Design the CRM module overview page for Harvest LPGMS (breadcrumb: "CRM / Overview"). This is the landing page when a user clicks the CRM icon in the rail.

Page header:
- Title: "CRM" 24px / 700.
- Subtitle: "Customer relationships, cylinder registry, and sales pipeline."
- Right: "New Customer +" Sky-500 button (only if user has Full authorization on CRM).

KPI bar — 4 stat cards:
1. "Total Customers" — value: "312" Geist Mono / Charcoal Ink. Label: "active accounts". Sub-label breakdown: "HH: 187 • Comm: 94 • Sub-Dealers: 31" in 12px Geist Mono Slate-500.
2. "Open Pipeline" — value: "28" Amber Geist Mono. Label: "leads in progress". Sub: "Est. value: K 2.4M".
3. "Open Tickets" — value: "11" Red Geist Mono. Label: "service tickets unresolved".
4. "Cylinders Issued" — value: "4,812" Geist Mono. Label: "in circulation (registered)".

Two panels below (60/40):

LEFT — Recent Customer Activity table:
Columns: Customer Name, Type chip (HH/Comm/Sub-Dealer), Last Order, Outstanding Balance (Geist Mono), Status chip (Active/On-Hold/Credit-Blocked). Show 6 rows.

RIGHT — Pipeline Snapshot:
Mini kanban summary (not a full board) — vertical list of pipeline stages with count badge:
Captured (8), Qualified (6), Site Assessment (5), Proposal (4), Negotiation (3), Closed (2). Each stage is a horizontal bar with label, count badge, and thin progress bar showing relative volume. Sky-500 accent on current stage label.

Font: Geist Sans / Geist Mono.
```

---

## S01-02 — All Customers Table

```
Design the All Customers list page for Harvest LPGMS (breadcrumb: "CRM / Customers / All Customers").

Page header:
- Title: "Customers" 24px / 700.
- Subtitle: "312 active accounts."
- Right: "New Customer +" Sky-500 button.

Filter bar: Search input (placeholder "Search name, phone, account #") + Customer Type dropdown (All / Household / Commercial / Sub-Dealer) + Status filter (Active / On-Hold / Credit-Blocked) + Export button (ghost).

Full-width data table:
Columns: □, Account # (Geist Mono), Customer Name, Type chip, Phone (Geist Mono), Location/Depot, Credit Limit (K, Geist Mono), Outstanding Balance (K, Geist Mono), Status chip, Last Activity (Geist Mono), Actions.

Show 8 rows with variety:
- 3 Household (Active), 3 Commercial (1 Credit-Blocked in Red-50/Red-700 chip), 2 Sub-Dealer (1 Active, 1 On-Hold)
- Credit-Blocked row: entire row has very subtle Red-50 background tint
- Commercial row with balance > credit limit: balance shown in Red-500 Geist Mono

Actions column on hover: [View →] | [Edit] pencil | kebab (Issue Cylinder / Log Ticket / Credit Adjustment).

Pagination bar at bottom: "Showing 1–8 of 312" + previous/next + rows-per-page selector.

Font: Geist Sans / Geist Mono.
```

---

## S01-03 — New Customer Wizard (KYC Step)

```
Design the New Customer onboarding wizard for Harvest LPGMS (breadcrumb: "CRM / Customers / New Customer"). This is a 3-step wizard: Step 1 KYC → Step 2 Classification → Step 3 Commercial Terms.

Wizard step indicator at top (below topbar, above content):
Horizontal 3-step bar: [1. KYC & Identity ●] ——— [2. Classification & Terms ○] ——— [3. Confirmation ○].
Step 1 active/Sky-500. Step 2 and 3 pending Slate-200.

Layout: Single-column form, max-width 640px, centered in content canvas.

Page sub-title: "New Customer — KYC & Identity" in 20px / 600.
Description: "Complete all required fields. A NRC or business registration number is mandatory for account creation." in 14px Muted Slate.

Form sections:

Section "Customer Identity":
- Full Name / Business Name* — text input
- Customer Type* — radio: Household / Commercial / Sub-Dealer / LPG Extreme (4 options, pill-style radio group with Sky-500 active)
- NRC Number (Household) or Business Registration # (Commercial) — conditional field, Geist Mono input
- Phone Number* — Geist Mono input, +260 prefix locked
- Email — optional text input
- Physical Address* — textarea 2 rows

Section "KYC Documentation":
- ID Document — file upload dropzone: "Upload NRC / Business Reg. Certificate (PDF or image, max 5MB)"
- Proof of Address — file upload dropzone: "Upload utility bill or tenancy agreement"

Section "Depot Assignment":
- Primary Depot* — dropdown: Lusaka Main / Ndola / Other
- Referred By — text input, optional (sub-dealer or agent name)

Navigation buttons: [Cancel] ghost link | [Save Draft] ghost button | [Next: Classification →] Sky-500 button, right-aligned.

Font: Geist Sans / Geist Mono. Error messages inline below each field in Red-500.
```

---

## S01-04 — Pipeline Board

```
Design the CRM Pipeline Board for Harvest LPGMS (breadcrumb: "CRM / Leads & Pipeline / Pipeline Board"). This is a Kanban-style pipeline for commercial customer acquisition.

Page header:
- Title: "Pipeline Board" 24px / 700. Subtitle: "28 leads in progress."
- Right: "Add Lead +" Sky-500 button | "Filter by Owner" dropdown | "My Leads Only" toggle.

Full-width Kanban board — 6 columns, horizontal scroll on overflow:
Columns (left to right): Captured (8) | Qualified (6) | Site Assessment (5) | Proposal (4) | Negotiation (3) | Closed This Month (2).

Column header design: Column name in 12px / 600 / Geist Sans / Slate-500 / uppercase. Count badge: Slate-200 bg, Slate-600 text, small pill. Column header border-bottom: 2px, color varies by stage (Slate-300, Sky-400, Amber-400, Violet-400, Orange-400, Emerald-400 for Closed).

Each card: Surface White, 1px Whisper Border, rounded-xl, 16px padding, 120px min-height. Contents:
- Company/Person name in 14px / 600 / Charcoal Ink
- Customer type chip (HH/Comm/Sub-Dealer) in 11px
- Assigned to: avatar initials circle in 20px
- Estimated value: "K 48,000" in 13px / 600 / Geist Mono / Sky-700
- Days in stage: "12 days" in 11px / Geist Mono / Muted Slate (Red if > 14 days)
- Last activity note: "Proposal sent 22 Nov" in 12px italic Muted Slate

Show 2–3 cards per column, varied. One overdue card (Red-50 background, Red-500 left border 2px). One "Site visit scheduled" card with a calendar icon chip.

Drag handle: subtle grip dots on card left edge, appear on hover.

Font: Geist Sans / Geist Mono. No hero image. No emoji.
```

---

## S01-05 — Cylinder Registry: Master List

```
Design the Cylinder Registry Master List for Harvest LPGMS (breadcrumb: "CRM / Cylinder Registry / Cylinder Master List").

Page header:
- Title: "Cylinder Registry" 24px / 700. Subtitle: "4,812 cylinders registered in the system."
- Right: "Register New Cylinder" Sky-500 | "Scan / Import" ghost button.

KPI mini-bar (compact, below header, above table):
4 inline stat chips: "In Circulation: 3,241" (Sky) | "At Depot (Empty): 891" (Slate) | "Faulty/Quarantine: 44" (Red) | "Unaccounted: 12" (Amber). Chip design: colored dot + label + value, inline pill style, 13px Geist Mono.

Filter bar: Search input (placeholder "Search serial #, customer, size") + Size filter (3kg / 6kg / 12.5kg / 19kg / 48kg) + Status filter + Location filter.

Full-width data table:
Columns: □, Serial # (Geist Mono), Size, Status chip, Current Location / Customer, Issued Date (Geist Mono), Deposit Amount (K, Geist Mono), Last Scanned (Geist Mono), Actions.

Show 8 rows with varied statuses: Issued (to customer — show customer name in Location column), At Depot, Faulty (Red-50 row tint), In-Transit.

Status chips: Issued (Sky-50/Sky-700) | At Depot (Slate-100/Slate-600) | Faulty (Red-50/Red-700) | In-Transit (Amber-50/Amber-700).

Actions on hover: [View Ledger →] | kebab (Transfer / Flag Faulty / Write-Off).

Font: Geist Sans / Geist Mono.
```

---

## S01-06 — Service Ticket Queue

```
Design the Service Ticket Queue for Harvest LPGMS (breadcrumb: "CRM / Service Tickets / Ticket Queue").

Page header:
- Title: "Service Tickets" 24px / 700. Badge: "11 open" in Red-50/Red-700.
- Subtitle: "Customer service requests, complaints, and cylinder issues."
- Right: "Log New Ticket +" Sky-500 button.

Filter bar: Search | Priority filter (All / High / Medium / Low) | Type filter (Complaint / Exchange / Leak Report / Delivery Issue / Other) | Status (Open / In Progress / Resolved) | Assigned to dropdown.

Data table:
Columns: □, Ticket # (Geist Mono), Customer Name, Type chip, Priority chip (High=Red, Medium=Amber, Low=Slate), Summary (truncated), Assigned To, Created (Geist Mono), SLA Remaining (Geist Mono — Red if < 4h), Status chip, Actions.

Show 6 rows:
- 1 High / Leak Report (Red Priority chip, SLA "1h 23m" in Red-500 Geist Mono)
- 2 Medium / Complaint
- 1 Medium / Cylinder Exchange
- 1 Low / Delivery Issue (Resolved, Emerald chip, row slightly muted)
- 1 High / Complaint (SLA "Breached" in Red-600 bold)

Actions on hover: [View] | [Assign] | kebab.

Font: Geist Sans / Geist Mono.
```

---

## S01-07 — Customer Profile Detail

```
Design the individual Customer Profile detail page for Harvest LPGMS (breadcrumb: "CRM / Customers / Bwalya Mwansa"). This is the single-customer record — the hub every module links back to.

Page header:
- Left: Customer name "Bwalya Mwansa" 24px / 700. Below: account # "ACC-0042" in 14px Geist Mono Muted Slate. Type chip (Household) + Status chip (Active) inline.
- Right: "New Order +" Sky-500 | "Log Ticket +" ghost | kebab (Edit / Deactivate / Issue Cylinder).

Profile summary card (Surface White, 1px border, rounded-xl, full-width, 24px padding). Three columns:
LEFT — Contact: phone (Geist Mono), email, physical address, primary depot.
CENTRE — Account: Credit Limit (K, Geist Mono), Outstanding Balance (K, Geist Mono — Red if > limit), Payment Terms, Price List, Customer Group.
RIGHT — CRM health: Last Refill Date (Geist Mono), Next Expected Refill (auto-calc, Geist Mono), Consumption Cycle (days, Geist Mono), Churn Risk chip (Low=Emerald / Medium=Amber / High=Red).

Tabbed sections below the summary card:
Tabs (pill style, Sky-500 active underline): "Cylinders" | "Orders & Invoices" | "Service Tickets" | "Activity Log"

"Cylinders" tab (default):
Mini table: Serial # (Geist Mono), Size, Status chip, Date Issued (Geist Mono), Deposit (K Geist Mono), Last Returned (Geist Mono).
Below: "Total Deposits Held: K 450.00" in 14px / 600 / Geist Mono / Emerald-700.

"Orders & Invoices" tab:
Mini table: Order # (Geist Mono), Date, Products, Amount (K Geist Mono), Payment Status chip, Channel chip. 5 rows.

"Service Tickets" tab:
Mini table: Ticket # (Geist Mono), Type chip, Priority chip, Status chip, Created (Geist Mono). 3 rows.

"Activity Log" tab:
Timeline — avatar initials + action description + timestamp. 8 entries, newest first.

Font: Geist Sans / Geist Mono.
```

---

## S01-08 — Sub-Dealer Performance Scorecard

```
Design the Sub-Dealer Performance Scorecard for Harvest LPGMS (breadcrumb: "CRM / Sub-Dealer Scorecard"). This shows all sub-dealers ranked and compared — not a single-dealer page.

Page header: "Sub-Dealer Scorecard" 24px / 700. Subtitle: "Performance, credit exposure, and tier ranking across the distribution network."
Right: "Export Report" ghost.

KPI bar — 4 stats:
1. "Active Sub-Dealers" — 31 Geist Mono.
2. "Total Monthly Volume" — "14.8 MT" Geist Mono Sky-700.
3. "Over Credit Limit" — "3" Red Geist Mono. Label: "at risk."
4. "Tier 1 Dealers" — "8" Emerald Geist Mono. Label: "top performers."

Main content: Full-width scorecard table.
Columns: □, Dealer Name, Territory, Tier chip, Monthly Vol. (kg Geist Mono), Stock Turnover (×/mo Geist Mono), Credit Limit (K Geist Mono), Credit Used (K Geist Mono), Credit Util. % (Geist Mono — Red if >85%), Order Freq. (orders/wk), Complaints (count — Red if >2), DPI Score (0–100 Geist Mono), Actions.

Tier chips: Tier 1 (Emerald-50/Emerald-700) | Tier 2 (Sky-50/Sky-700) | Tier 3 (Amber-50/Amber-700).

Show 8 rows. Include: 1 Tier 1 at 92 DPI (Emerald row), 1 row with Credit Util 94% (Red), 1 row with 4 complaints (Red), 1 with DPI < 35 (Amber-50 row bg).

Actions on hover: [View Profile →] | [Review Credit] (if over limit) | kebab (Tier Update / Issue Warning).

Below table: Tier Distribution summary — 3 rows (Tier 1 / 2 / 3): avg DPI, avg credit util %, avg monthly volume in Geist Mono. NOT a chart — plain labeled stat rows.

Font: Geist Sans / Geist Mono.
```

---

## S01-09 — New Customer Wizard: Step 2 — Classification & Commercial Terms

```
Design Step 2 of the New Customer onboarding wizard for Harvest LPGMS (breadcrumb: "CRM / Customers / New Customer").

Wizard bar (below topbar): [1. KYC ✓ Emerald] ——— [2. Classification ● Sky-500] ——— [3. Confirmation ○ Slate]

Layout: Single-column, max-width 640px, centered.

Page sub-title: "Classification & Commercial Terms" 20px / 600.
Description: "Set the account structure, pricing tier, and credit parameters." 14px Muted Slate.

Section "Account Structure":
- "Customer Group / Control Account" — dropdown: Household (CON-HH-001) / Commercial (CON-COMM-001) / Sub-Dealer (CON-SD-001) / LPG Extreme (CON-LPG-X) / Distributor (CON-DIST-001). Pre-selected from Step 1 Customer Type.
- "Price List" — dropdown: Standard Retail / Commercial Tier 1 / Commercial Tier 2 / Sub-Dealer Rate / LPG Extreme Rate. After selection: inline preview "12.5 kg: K 245.00" in 12px Geist Mono Sky-700.
- "Tax Code" — dropdown: VAT Standard (16%) / VAT Exempt / ZRA Zero-Rated.
- "TPIN / Tax ID" — Geist Mono input (required for Commercial, optional for Household; conditional display).

Section "Credit Terms" (renders if Group = Commercial / Sub-Dealer / LPG Extreme):
- "Credit Limit (K)" — Geist Mono input. Zero = cash only.
- "Payment Terms" — dropdown: Cash on Delivery / Net 7 / Net 14 / Net 30 / Net 60.
- "Credit Notes" — textarea, optional.

Section "Commercial Detail" (renders if Commercial or LPG Extreme):
- "Monthly Consumption Estimate (kg)" — Geist Mono input.
- "Delivery Schedule" — radio pills: Daily / Weekly / Bi-weekly / On-Demand.
- "Contract Start Date" / "Contract End Date" — date pickers.
- "Assigned Relationship Manager" — staff dropdown.

Section "Contact Persons":
Repeating row builder: Name | Role | Phone (Geist Mono) | Email | Primary toggle.
"+ Add Contact Person" ghost button.

Navigation: [← Back to KYC] ghost | [Save & Confirm →] Sky-500. "Save Draft" ghost above.

Font: Geist Sans / Geist Mono. No floating labels.
```

---

# MODULE 02 — Procurement

---

## S02-01 — Procurement Overview

```
Design the Procurement module Overview page for Harvest LPGMS (breadcrumb: "Procurement / Overview").

Page header:
- Title: "Procurement" 24px / 700. Subtitle: "Purchase orders, supplier compliance, and import tracking."
- Right: "Raise PO +" Sky-500 button (only if user has Submit authorization).

KPI bar — 4 stat cards:
1. "Open POs" — value: "7" Amber Geist Mono. Label: "awaiting action in chain."
2. "This Month Spend" — value: "K 4.82M" Geist Mono Charcoal. Label: "committed + posted."
3. "Pending Compliance" — value: "2" Red Geist Mono. Label: "tanker/driver docs missing."
4. "Average Lead Time" — value: "— days" Slate Geist Mono. Label: "PO to GR (TBD)."

Below KPIs: demand forecast vs. MoQ panel. A simple horizontal bar chart — 5 bars (one per product: Bulk LPG, 3kg, 6kg, 12.5kg, 19kg). Each bar shows Forecasted Demand (Sky-200) vs. Minimum Order Quantity (Slate-400 dashed line overlay). Bar labels in 12px Geist Mono. No decorative chart gradients.

Below chart: "Recent POs" table — Ref #, Supplier, Value (K, Geist Mono), Status chip (full chain: Draft / Awaiting OM / Awaiting IC / Awaiting Payment / Paid), Date Raised (Geist Mono), ETA (Geist Mono). Show 5 rows.

Font: Geist Sans / Geist Mono.
```

---

## S02-02 — All POs Table

```
Design the All Purchase Orders list page for Harvest LPGMS (breadcrumb: "Procurement / Purchase Orders / All POs").

Same table-page pattern as S01-02.

Page header: "Purchase Orders" 24px / 700. "47 total." Right: "Raise PO +" Sky-500.

Filter bar: Search | Status chips (all clickable): All | Draft | Awaiting OM | Awaiting IC | Awaiting Payment | Paid | Cancelled.

Full-width data table:
Columns: □, PO # (Geist Mono), Supplier, Product, Quantity (Geist Mono + unit), Total Value (K, Geist Mono), Raised By, Date Raised (Geist Mono), ETA (Geist Mono), Days in Chain (Geist Mono — red if > 5), Status chip (full procurement chain statuses), Actions.

Show 7 rows with all statuses represented:
- 1 Draft (Slate chip)
- 2 Awaiting OM (Amber chip)
- 1 Awaiting IC (Violet chip)
- 1 Awaiting Payment (Sky chip)
- 1 Paid (Emerald chip)
- 1 Cancelled (Red chip, full-row 50% opacity)

For "Awaiting Payment" row, add "72h SLA" chip in Amber alongside status chip showing remaining time.

Actions on hover: [View →] | [Edit] (only on Draft) | kebab.

Font: Geist Sans / Geist Mono.
```

---

## S02-03 — Raise PO Form

```
Design the "Raise Purchase Order" form page for Harvest LPGMS (breadcrumb: "Procurement / Purchase Orders / Raise PO"). This is the DM-facing submission form — the entry point of the procurement approval chain.

4-stage stepper at top (same visual as S05-05 but Procurement fields):
Stage labels: [1. Submit — Depot Manager] [2. OM Approve — Ops Manager] [3. IC Review — Internal Control] [4. Payment — Finance]
Stage 1 active. Stages 2–4 locked/pending.

Two-column layout (65/35) below stepper.

LEFT COLUMN — PO Form:
Sub-title "New Purchase Order" 20px / 600.
- "PO Reference" — auto-generated read-only: "PO-2024-115" Geist Mono
- "Supplier Name" — text input with typeahead/autocomplete
- "Supplier Contact" — text input
- "Product" — dropdown: Bulk LPG / Cylinder Mix
- "Quantity" — number input Geist Mono + unit selector (MT / KG / Units)
- "Unit Price (K)" — number input Geist Mono
- "Total Value" — auto-calculated read-only Geist Mono Sky-700
- "Expected Delivery Date" — date picker
- "Delivery Point" — dropdown: Lusaka Depot / Ndola / Chirundu Border / Nakonde Border

Section "Line Items":
A mini-table for itemised PO lines. Columns: # | Product Description | Qty | Unit | Unit Price | Line Total (Geist Mono). "Add Line" ghost button to add rows. Totals row at bottom.

Section "Compliance Gate":
Checkbox group: ☐ Tanker vehicle reg confirmed ☐ Driver NRC/licence confirmed ☐ Import permit valid ☐ ZRA duty/levy checked. Each item has a status chip (✓ Confirmed / ⚠ Pending) that updates when checked.

"Compliance Note" — textarea for any flags.

Section "Supporting Documents":
File upload dropzone — PO document, import permit, compliance
RIGHT COLUMN — Supplier Info Card:
If supplier selected from typeahead, shows supplier card: name, contact, past PO count, last order value, compliance status chip (Compliant / Review Needed).

Font: Geist Sans / Geist Mono.
```

---

## S02-04 — PO Detail with Finance Tab (Awaiting Payment Stage)

```
Design the PO Detail page for Harvest LPGMS at the Finance/Payment stage (breadcrumb: "Procurement / Purchase Orders / PO-2024-112"). This demonstrates the Finance actions embedded as a tab — no separate Finance module.

STEPPER BAR:
- Stage 1 Submit: Emerald, checkmark, "Raised by D. Mwamba • 18 Nov 2024"
- Stage 2 OM Approve: Emerald, checkmark, "Approved by P. Banda • 19 Nov 2024"
- Stage 3 IC Review: Emerald, checkmark, "Reviewed by M. Nkosi • 20 Nov 2024"
- Stage 4 Payment: Sky-500 ACTIVE, pulse ring, "Awaiting Finance action"

BELOW STEPPER: Tabs navigation (horizontal pill tabs, not separate pages): "PO Details" | "Compliance" | "Finance & Payment" (active tab underlined Sky-500).

"Finance & Payment" tab content (two-column, 65/35):

LEFT COLUMN:
Sub-title "Raise Payment Request — PO-2024-112" in 20px / 600.
Read-only summary: Supplier, Total PO Value (K, Geist Mono, prominent), Payment Method options.

Finance form block (Sky-50 bg, Sky-500 left border, rounded-xl):
- "Payment Method" — dropdown: EFT / Cheque / Mobile Money
- "Payment Amount (K)" — pre-filled from PO total, Geist Mono, editable for partial payment
- "Payment Reference" — Geist Mono input
- "Bank Account" — dropdown of supplier's registered accounts
- "COA Code" — text input Geist Mono, required (Chart of Accounts gate)
- "ZRA Duty Reference" — Geist Mono input (if applicable)
- "72-Hour SLA" — info chip showing "SLA Target: 22 Nov 2024 17:00" with a live countdown in Geist Mono Amber-700. Goes Red if overdue.
- "Finance Notes" — textarea

Checkbox: "I confirm the payment amount and bank details are correct and authorized."
Action buttons: [Raise Payment Request →] Violet-500 | [Return to IC] Red-50/Red-700 outline.

RIGHT COLUMN — Activity Log: Full 4-stage chain trail with notes from each stage.

Font: Geist Sans / Geist Mono.
```

---

## S02-05 — Compliance Check Gate

```
Design the "Compliance Check" page for Harvest LPGMS (breadcrumb: "Procurement / Import & Compliance / Export/Import Checklist Gate").

This is a checklist-gate screen — the DM verifies all import/compliance documents before a shipment is cleared for Goods Receipt.

Page header:
- Title: "Import Compliance Check" 24px / 700.
- Subtitle: "Complete all items before clearing shipment for Goods Receipt."
- Right: "Link to PO" ghost button.

Top context card: Surface White, 1px Whisper Border, rounded-xl. Shows: PO # (Geist Mono), Supplier, Shipment #, Expected Arrival Date (Geist Mono), Clearing Agent, Border Post dropdown (Chirundu / Nakonde).

Main checklist — divided into 3 groups:

GROUP 1 — "Vehicle & Driver":
Each item is a row: checkbox + label + status chip + "Upload Document" button or "View Attached" link.
Items: Tanker registration verified | Driver NRC/licence confirmed | Driver medical certificate | Vehicle roadworthiness cert. Each item: 52px row height, 1px divider.

GROUP 2 — "Import Documents":
Items: Import permit valid (expiry date field Geist Mono) | ZRA duty/levy reference confirmed (ref # input Geist Mono) | ZEEP clearance if applicable | Supplier invoice received.

GROUP 3 — "Quality & Specs":
Items: Product specification sheet received | Certificate of analysis attached | Agreed pressure/weight specs confirmed.

Bottom: Compliance summary bar — "12 of 13 items complete. 1 outstanding: Driver medical certificate." in Amber-50 bg with Amber-500 left border.

Action buttons: [Clear for GR →] Emerald-500 (disabled until all items checked) | [Flag Compliance Issue] Red-50/Red-700.

Clearing Agent Log sub-section: simple table of past clearing entries — Date, Agent Name, Border, Action, Logged by.

Font: Geist Sans / Geist Mono.
```

---

## S02-06 — Certificate of Analysis (COA) & Supplier Documents

```
Design the Supplier Documents verification screen for Harvest LPGMS (breadcrumb: "Procurement / Import & Compliance / Supplier Documents — PO-2024-112"). Per the procurement process, a COA must be attached and verified before any payment request can be raised.

Page header: "Supplier Documents — PO-2024-112" 24px / 700.
Subtitle: "All required documents must be verified before the payment request is authorized."

PO context card (Surface White, 1px border, rounded-xl, compact, above the checklist): PO # (Geist Mono), Supplier, Product, Quantity (kg Geist Mono), Total Value (K Geist Mono), Expected Arrival (Geist Mono).

Document verification checklist — two groups:

GROUP 1 — "Product Quality Documents" (all required):
Each row: checkbox (44px) + document name + status chip + Upload / View button + Verified-by + date (Geist Mono).
- Certificate of Analysis (COA) — required. Shows "Verify COA" expansion below when document is attached.
- Supplier Invoice — required.
- Bill of Lading / Cargo Manifest — required.
- Export Permit (country of origin) — required.
- Import Permit (Zambia ERB/ZRA) — required.

GROUP 2 — "Supplier Compliance":
- ZABS Compliance Certificate (Zambia Bureau of Standards tanker compliance) — required.
- ERB License (Energy Regulation Board) — required.
- ZRA Duty/Levy Receipt — required.

Document status chips: Received & Verified (Emerald-50/Emerald-700) | Pending Verification (Amber-50/Amber-700) | Missing (Red-50/Red-700) | Not Required (Slate-100/Slate-600).

COA Detail panel (inline expansion, Sky-50 bg, rounded-xl, when COA row is expanded):
Title "COA Specifications" 14px / 600 / Sky-700.
Fields to record from the COA document: Odorant Level (ppm, Geist Mono input), Pressure (bar, Geist Mono input), Moisture Content (%, Geist Mono), Calorific Value (MJ/kg, Geist Mono), Lab Reference # (Geist Mono). Each field has a grey helper text showing the acceptable range from contract specs.
"Mark COA Verified" Emerald-500 button.

Completion gate (full-width, bottom of page):
All verified: Emerald-50 banner + "Raise Payment Request →" Emerald-500 button.
Any missing: Red-50 banner listing outstanding items. Payment request button absent.

Font: Geist Sans / Geist Mono.
```

---

# MODULE 03 — GR (Receiving & Filling)

---

## S03-01 — GR Overview

```
Design the GR (Goods Receipt) module overview for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Overview").

Page header:
- Title: "Receiving & Filling" 24px / 700. Subtitle: "Shipment receipt, weighbridge verification, cylinder filling, and weekly recon."
- Right: "Post New GR +" Sky-500 button.

KPI bar:
1. "Awaiting GR" — value: "1" Amber Geist Mono. Label: "shipment pending receipt."
2. "Filled This Week" — value: "2,840 kg" Geist Mono. Label: "across all cylinder sizes."
3. "Faulty Cylinders" — value: "17" Red Geist Mono. Label: "in quarantine/repair queue."
4. "Recon Status" — value: "Week 47 ✓" Emerald Geist Mono. Label: "last signed off by OM."

Two panels (60/40):
LEFT — Recent GR Receipts table: GR # (Geist Mono), Date, PO Ref, Supplier, Qty Received (kg Geist Mono), Qty Expected (kg Geist Mono), Supplier Loss (kg Geist Mono, Red if > 0), Status chip (Pending / Weighbridge / QC / Posted). Show 4 rows.

RIGHT — Cylinder Filling Progress (current batch): Mini table by cylinder size — Size, Batch Target, Filled so far (Geist Mono), % (thin horizontal progress bar in Sky-500). Show 5 size rows.

Font: Geist Sans / Geist Mono.
```

---

## S03-02 — Weighbridge Verification

```
Design the Weighbridge Verification step for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Product Receipt / Weighbridge Verification").

4-step GR progress bar at top (not the approval chain — this is a process wizard specific to GR):
[1. Weighbridge ●] — [2. Quality Check ○] — [3. Offloading ○] — [4. Post GR ○]
Step 1 active/Sky-500.

Context card at top of content: PO # (Geist Mono), Supplier, Expected Quantity, Arrival Date/Time (Geist Mono), Tanker Reg (Geist Mono), Driver Name.

Page sub-title: "Weighbridge Verification" 20px / 600.

Form — two columns:

LEFT:
- "Gross Weight (kg)" — Geist Mono input, large (20px input text), placeholder "Enter from weighbridge display"
- "Tare Weight (kg)" — Geist Mono input
- "Net Weight / Quantity Received (kg)" — auto-calculated, read-only, 24px / 700 / Geist Mono, displayed in a Sky-50 highlight box
- "Supplier Loss" — auto-calculated: Expected − Received, shown in Red-500 Geist Mono if negative
- "Tolerance Check" — auto-displayed: "Within tolerance (±0.3%)" Emerald chip OR "Outside tolerance — flag required" Red chip
- "Weighbridge Operator" — text input
- "Weighbridge Ticket #" — Geist Mono input
- "Weighbridge Photo" — file upload

RIGHT:
- Context panel showing expected figures from PO for reference
- "Supplier Loss Policy" info card: "Per contract: losses < 0.3% are absorbed. Losses > 0.3% are deducted from supplier invoice. This calculation will auto-apply at posting." in 13px Slate-600 on Slate-50 bg.

Navigation: [Save & Proceed to QC →] Sky-500 (right), [Back] ghost (left).

Font: Geist Sans / Geist Mono. All numeric inputs in Geist Mono.
```

---

## S03-03 — Cylinder Filling Entry

```
Design the Precision Filling Entry form for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Cylinder Filling / Precision Filling Entry").

This is a data-entry screen for recording the weight of each cylinder filled during a filling run.

Page header: "Cylinder Filling — Batch #FILL-2024-048" 24px / 700. Subtitle: "Record actual fill weight for each cylinder. Target: 12.5 kg ± 0.1 kg."

Filling session context bar (below header, Slate-50 bg, 1px border): Filling Line, Operator, Batch Start Time (Geist Mono), Target Size (12.5kg), Target Count (200 cylinders), Filled So Far (running counter Geist Mono Sky-700 / 200).

Main content: A rapid data-entry table for bulk filling record.
Columns: # (Geist Mono auto-increment), Cylinder Serial (Geist Mono barcode scan input or manual), Actual Weight (kg) (Geist Mono input), Variance from Target (auto-calc, Green if within ±0.1, Red if outside), Flag (auto: ✓ Pass or ⚠ Flag).

Table has 10 visible rows with + scroll. Current row highlighted with Sky-50 background. Tab/Enter key advances to next row.

Below table: Running stats strip:
"Filled: 47 / 200 | Avg Weight: 12.49 kg | Flagged: 3 | Within Tolerance: 44 (93.6%)" — all Geist Mono values.

Flagged cylinders auto-moved to "Faulty Cylinder Queue" — a link badge shows "3 flagged — view queue →" in Red-50/Red-700.

Bottom actions: [Complete Batch] Emerald-500 | [Pause Session] ghost | [Export Batch Data] ghost.

Font: Geist Sans / Geist Mono. Dense but readable.
```

---

## S03-04 — Weekly Reconciliation: Recon Sign-Off

```
Design the Weekly Reconciliation Sign-Off page for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Weekly Reconciliation / Recon Sign-Off"). This screen is for the Operations Manager to review and sign off on the compiled weekly count.

Page header: "Weekly Reconciliation — Week 48 Sign-Off" 24px / 700. Subtitle: "Compiled by Kunda Mutale • Submitted 2 Dec 2024, 08:15."

Status banner at top: Amber-50 bg, Amber-500 left border: "This reconciliation was submitted by the Depot Manager and is awaiting your sign-off."

Two-column layout (65/35):

LEFT — Reconciliation Summary:
Full-width summary table: Product | Opening Stock (kg) | Received (kg) | Issued (kg) | Closing Expected (kg) | Closing Actual (kg) | Variance (kg). All values Geist Mono. Variance column: Red for negative, Emerald for positive. Totals row at bottom, bold.

Below table: "Variance Explanation from DM" — quoted text block, Slate-50 bg, left border Slate-400.

OM SIGN-OFF BLOCK (renders only if user has Recon Sign-Off authorization):
Emerald-50 bg, Emerald-500 left border, rounded-xl, 16px padding.
"Sign-Off Notes" textarea, optional.
Checkbox: "I confirm this reconciliation is accurate and the weekly stock position is validated."
Buttons: [Sign Off & Approve ✓] Emerald-500 | [Return for Revision] Red-50/Red-700.

RIGHT — Supporting Data Panel:
"GR Receipts This Week" — mini list of GR refs and quantities (Geist Mono).
"Dispatch/Sales This Week" — total from S&D records (Geist Mono).
"Filling Batches" — total cylinders filled (Geist Mono).
All figures auto-pulled from the system — read-only.

Font: Geist Sans / Geist Mono.
```

---

## S03-05 — Quality Check + Offloading Confirmation

```
Design the Quality Check and Offloading Confirmation page for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Product Receipt / Offloading Confirmation"). This is Step 2 & 3 of Product Receipt (after Weighbridge).

4-step GR wizard bar at top:
[1. Weighbridge ✓ Emerald] — [2. Quality Check ● Sky] — [3. Offloading ○] — [4. Post GR ○]

PO context strip (Slate-50, 40px): Supplier | PO # (Geist Mono) | Net weight verified (Geist Mono Emerald) | Product: Bulk LPG.

STEP 2 — Quality Inspection Checklist:
Each row: large checkbox (44px) + item description + optional notes input + status chip.
Items:
☐ Tanker seal integrity verified (check all compartments before connecting)
☐ Pressure reading (bar): _____ Geist Mono input — acceptable range shown as helper text
☐ Odorant level confirmed (visual / smell check)
☐ Certificate of Analysis specs match product — link to S02-06 COA record
☐ Visual contamination check (no water or sediment in sample)
☐ Driver identity & hazmat licence confirmed — links to S02-05 compliance gate

After all items checked: Emerald-50 banner "Quality Check Passed." + "Proceed to Offloading →" Sky-500 activates.

STEP 3 — Offloading Confirmation (shown after Quality Check complete):
Sub-title "Offloading to Bulk Warehouse" 18px / 600.

Form fields:
- "Receiving Tank" — dropdown: T-001 Lusaka Bulk (current 8,400 kg / capacity 15,000 kg), T-002 Lusaka Bulk, T-003 Ndola. Each option shows a thin fill-bar progress indicator.
- "Offloading Operator" — staff dropdown.
- "Quantity Received (kg)" — read-only from weighbridge, Geist Mono Sky-700.
- "Meter Reading Before (kg)" / "Meter Reading After (kg)" — Geist Mono inputs.
- "Verified Quantity (kg)" — auto-calc (After − Before), Sky-50 highlight box.
- "Supplier Loss (kg)" — auto-calc (Expected − Verified), Red-500 Geist Mono if positive. Auto-chip: "Within tolerance (±0.3%)" Emerald or "Above threshold — flag required" Red.
- "Offloading Notes" — textarea.

Checklist during offloading (3 items, toggled as performed):
☐ Grounding cable connected (static discharge prevention)
☐ Leak monitoring active throughout transfer
☐ Post-transfer line purged

Action: "Complete Offloading & Post GR →" Emerald-500 full-width (advances to Step 4).

Font: Geist Sans / Geist Mono.
```

---

## S03-06 — Faulty Cylinder Queue: Repair & Write-Off

```
Design the Faulty Cylinder Queue screen for Harvest LPGMS (breadcrumb: "GR Receiving & Filling / Cylinder Filling / Faulty Cylinder Queue"). Cylinders flagged during filling (weight out of tolerance, valve failure, inspection failure) auto-appear here from filling batches.

Page header: "Faulty Cylinder Queue" 24px / 700. Badge: "17 cylinders" in Red-50/Red-700.
Subtitle: "Assess each faulty cylinder: schedule repair, transfer product, or write off."

Filter bar: Search serial # | Fault Type | Size | Date Range.

Full-width table:
Columns: □, Serial # (Geist Mono), Size, Fault Type chip, Batch # (Geist Mono), Date Flagged (Geist Mono), Days in Queue (Geist Mono — Red if >7), Disposition chip, Actions.

Fault Type chips: Weight Variance (Amber-50/Amber-700) | Valve Failure (Red-50/Red-700) | Dent / Structural (Red-50/Red-700) | Expired Requalification (Red-50/Red-700) | Leak Detected (Red-50/Red-700).
Disposition chips: Pending Assessment (Slate-100/Slate-600) | Scheduled Repair (Amber-50/Amber-700) | Manual Transfer (Sky-50/Sky-700) | Written Off (Red-50/Red-700).

Show 6 rows. Include 1 >7 days (Red days), 1 Expired Requalification, 1 Written Off (muted row).

Actions on hover: [Assess] opens inline expansion.

INLINE ASSESSMENT EXPANSION:
Sky-50 bg, 1px Whisper Border, 16px padding, below the row.
Title: "Assessment — CYL-2024-0847 (12.5 kg — Valve Failure)" 14px / 600.
"Disposition Decision" — 3 toggle buttons in a row (select one):
  [Repair / Send for Maintenance] — Amber-50/Amber-700
  [Manual Transfer (move product to another cylinder)] — Sky-50/Sky-700
  [Write-Off (irreparable / expired)] — Red-50/Red-700

Conditional fields:
REPAIR: Repair Date (date picker) + Notes for maintenance (textarea).
MANUAL TRANSFER: Target Cylinder search (serial # input) + Operator dropdown + Transfer Weight (kg, Geist Mono).
WRITE-OFF: Reason dropdown (Irreparable / Expired requalification / Safety risk / Lost/Stolen) + Authorised By (staff dropdown) + Replacement Ordered checkbox.

"Confirm Disposition" Emerald-500 button — updates cylinder status and removes from queue.

Font: Geist Sans / Geist Mono.
```

---

# MODULE 06 — S&D (Sales & Distribution)

---

## S06-01 — S&D Overview

```
Design the S&D (Sales & Distribution) Overview for Harvest LPGMS (breadcrumb: "S&D / Overview").

Page header: "Sales & Distribution" 24px / 700. Subtitle: "Order intake, credit check, release, invoicing, and payment across all channels."
Right: "New Order +" Sky-500.

KPI bar:
1. "Orders Today" — value: "34" Geist Mono. Label: "4 channels."
2. "Pending Release" — value: "8" Amber Geist Mono. Label: "awaiting STA confirmation."
3. "Outstanding Receivables" — value: "K 841,200" Geist Mono Red. Label: "total unpaid invoices."
4. "Credit-Blocked" — value: "3" Red Geist Mono. Label: "accounts on credit hold."

Two panels (60/40):
LEFT — Recent Orders table: Order # (Geist Mono), Customer, Channel chip (Sub-Dealer / Commercial-Credit / Commercial-Cash / Household), Qty (Geist Mono), Value (K Geist Mono), Status chip (Pending / Credit Check / Released / Invoiced / Paid / Blocked). Show 6 rows — include 1 Blocked row with Red-50 row tint.

RIGHT — Channel Breakdown donut stats: Not a chart — 4 inline stat rows: Sub-Dealer (N orders, K value), Commercial-Credit, Commercial-Cash, Household. Each row: channel name + colored dot + count + value in Geist Mono.

Font: Geist Sans / Geist Mono.
```

---

## S06-02 — Order Intake Form

```
Design the Order Intake form for Harvest LPGMS (breadcrumb: "S&D / Orders / Order Intake").

Page header: "New Order" 24px / 700. Subtitle: "Log a new sales order and assign to channel."

Form — single column, max-width 720px, centered:

Section "Order Details":
- "Order Reference" — auto-generated: "ORD-2024-0891" Geist Mono read-only
- "Customer" — searchable dropdown with customer type chip auto-shown after selection
- "Channel" — radio group pills: Sub-Dealer / Commercial Credit / Commercial Cash / Household / LPG Extreme
- "Received Via" — radio group pills (smaller, secondary row): Walk-In / WhatsApp / Email / SMS / App / Phone. Defaults to Walk-In. 13px Geist Sans, Slate-200 border inactive, Sky-500 active.
- "Order Date" — date picker, defaulting to today
- "Delivery Date Requested" — date picker
- "Depot" — dropdown

Section "Line Items":
Same mini-table pattern as S02-03 PO line items. Columns: Product (Bulk LPG / cylinder size), Qty, Unit, Unit Price, Subtotal. Totals row.

Section "Credit Check" (renders after customer selected, conditional on channel = Commercial Credit or Sub-Dealer):
Info card showing: Credit Limit (K Geist Mono), Outstanding Balance (K Geist Mono), Available Credit (K Geist Mono — Red if < order total).
Auto-pass/fail banner:
- PASS: Emerald-50 bg, Emerald-500 left border: "✓ Credit check passed. Customer has K 85,400 available credit." Order can proceed.
- FAIL: Red-50 bg, Red-500 left border, prominent: "✗ Credit limit exceeded. This order requires a credit override or reduction. Orders cannot be released while account is blocked." No override button — this is an automatic gate, not an approval chain.

Submit button: "Save & Release for Picking →" Sky-500 (disabled if credit check fails).

Font: Geist Sans / Geist Mono.
```

---

## S06-03 — Release Task Queue (STA)

```
Design the Release Task Queue for Harvest LPGMS (breadcrumb: "S&D / Release & Delivery / Release Task Queue"). This is the STA (Stock/Transport Associate) facing queue for physical release.

Page header: "Release Queue" 24px / 700. Badge: "8 pending" Amber-50/Amber-700. Subtitle: "Orders cleared for physical release. Confirm dual signature to dispatch."

Filter bar: Search | Depot filter | Priority filter | Date filter.

Data table:
Columns: □, Order # (Geist Mono), Customer, Channel chip, Products/Qty (Geist Mono), Delivery Mode chip (Own Fleet / Customer Collect / Third Party), Assigned Driver (or "Unassigned" Amber chip), Dual Signature Status (chip: Pending / PUN Signed / Both Signed), Actions.

Show 6 rows:
- 2 with "Pending" sig status (actions: [Capture DN Sig] [Capture PUN Sig])
- 2 with "PUN Signed" (actions: [Capture DN Sig to Complete])
- 1 with "Both Signed" (Emerald — Dispatch Cleared)
- 1 Unassigned driver (Amber chip, [Assign Driver] CTA)

Dual Signature capture: clicking [Capture DN Sig] or [Capture PUN Sig] opens an inline expansion row (not a modal) showing: Signer Name field, Signature pad placeholder (dashed box with "Tap to sign" label), Submit button. Design this expanded row state in the table.

Font: Geist Sans / Geist Mono.
```

---

## S06-04 — Invoice Generation & Payment Recording

```
Design the Invoice Generation and Payment Recording page for Harvest LPGMS (breadcrumb: "S&D / Invoicing & Payments / Invoice Generation"). Finance actions are embedded here as a tab — not a separate module.

Tabs at top of content area (below page header): "Invoice Details" | "Payment" (active tab highlighted Sky-500 underline).

PAGE HEADER: "Invoice INV-2024-0445" 24px / 700. Status chip: "Unpaid" Red-50/Red-700. Right: "Download PDF" ghost button | "Send to Customer" ghost button.

"Invoice Details" tab content:
Invoice display — structured like a real invoice but in the app UI style:
- Header row: Invoice #, Date, Due Date (in Geist Mono), Customer name, Account #
- Line items table: Description, Qty, Unit Price, VAT %, Line Total (all Geist Mono)
- Totals: Subtotal, VAT (16%), Total Due — prominent in 20px / 700 Geist Mono Charcoal
- Customer address and depot details
All read-only — invoice is auto-generated from the order.

"Payment" tab content (Finance actions embedded here):
Sub-title "Record Payment" in 18px / 600.
Payment form:
- "Amount Received (K)" — Geist Mono input, defaulting to invoice total
- "Payment Method" — radio pills: Cash / Airtel Money / Bank Transfer / Cheque
- "Payment Date" — date picker
- "Reference / Receipt #" — Geist Mono input
- "Notes" — textarea optional

Below: "Payment History" — small table of any past payments on this invoice: Date, Amount (Geist Mono), Method chip, Reference (Geist Mono), Recorded By.

If fully paid: Emerald-50 bg banner: "✓ Invoice fully settled — K 48,750.00 received on 28 Nov 2024."
If partially paid: Amber-50 banner: "Partial payment recorded. Outstanding: K 12,400.00."

Submit button: "Record Payment" Emerald-500.

Font: Geist Sans / Geist Mono.
```

---

## S06-05 — S&D: LPG Extreme Inter-Company Orders

```
Design the LPG Extreme order page for Harvest LPGMS (breadcrumb: "S&D / Orders / LPG Extreme Channel"). LPG Extreme is an inter-company entity set up as a Profit Center — a major distribution network tracked separately from other sub-dealers.

Page header: "LPG Extreme — Inter-Company Orders" 24px / 700.
Subtitle: "Inter-company distribution orders tracked as a separate profit center."
Right: "New LPG Extreme Order +" Sky-500.

INFO BANNER (Sky-50 bg, Sky-500 left border, 13px Geist Sans):
"LPG Extreme operates as a Profit Center. All transactions carry an inter-company reference and are excluded from standard sub-dealer reporting."

KPI mini-bar (3 inline chips):
"This Month: K 2.8M" (Sky) | "Open Orders: 4" (Amber) | "Outstanding: K 480,000" (Red). All Geist Mono.

Orders table (LPG Extreme only):
Columns: □, Order # (Geist Mono), IC Reference (inter-company ref, Geist Mono), Products, Qty (MT Geist Mono), Value (K Geist Mono), Order Date (Geist Mono), Delivery Date (Geist Mono), Status chip, Actions.

Status chips use the standard S&D set. Add a "Profit Centre" chip in Violet-50/Violet-700 on each row.

Show 4 rows: 1 Delivered, 1 In-Transit, 1 Awaiting Release, 1 Draft.

NEW ORDER SIDE PANEL (40% width, slides in from right on "New LPG Extreme Order +"):
Title "New LPG Extreme Order" 18px / 600.
Fields: Order # (auto), IC Reference (Geist Mono input, required), Products + line items table, Delivery Location (text), Requested Date (date picker), Transport Mode (dropdown: Own Fleet / LPG Extreme Fleet / Third Party), Notes (textarea).
"Profit Centre" label — read-only: "LPG EXTREME" in Violet-50/Violet-700 pill.
"Submit Order →" Sky-500 full-width.

Font: Geist Sans / Geist Mono.
```

---

# MODULE 04 — Inland Logistics

---

## S04-01 — Inland Logistics Overview

```
Design the Inland Logistics Overview for Harvest LPGMS (breadcrumb: "Inland Logistics / Overview").

Page header: "Inland Logistics" 24px / 700. Subtitle: "Dispatch, in-transit tracking, PoD, and warehouse transfers."
Right: "New Dispatch +" Sky-500.

KPI bar:
1. "In Transit" — value: "6" Sky Geist Mono. Label: "trucks/deliveries active."
2. "PoD Pending" — value: "4" Amber Geist Mono. Label: "awaiting driver confirmation."
3. "Delivered Today" — value: "12" Emerald Geist Mono. Label: "PoD received."
4. "Overdue" — value: "1" Red Geist Mono. Label: "past expected delivery window."

Main content: Full-width dispatch table.
Columns: Dispatch # (Geist Mono), Route, Driver, Vehicle Reg (Geist Mono), Cargo (qty + product Geist Mono), Departure (Geist Mono), ETA (Geist Mono), Status chip (Dispatched / In-Transit / PoD Pending / Delivered / Overdue), Actions.

Show 6 rows with varied statuses. Overdue row: Red-50 row tint. PoD Pending rows: Amber-50 tint.

Actions: [View →] | [View PoD] (if delivered) | kebab.

Below table: "Recent PoD Confirmations" compact list — last 5 deliveries confirmed, showing driver, customer, timestamp, and "Auto-transferred to [Depot]" tag.

Font: Geist Sans / Geist Mono.
```

---

## S04-02 — Dispatch: Pickup Weigh-In + Dual Signature

```
Design the Dispatch Clearance screen for Harvest LPGMS (breadcrumb: "Inland Logistics / Dispatch / Dispatch Clearance").

3-step dispatch wizard bar at top:
[1. Pickup Weigh-In ●] — [2. Dual Signature ○] — [3. Dispatch Cleared ○]

Step 1 content (Pickup Weigh-In):
Context card: Order # (Geist Mono), Customer, Route, Driver Name, Vehicle Reg (Geist Mono).

Form:
- "Loaded Weight (kg)" — Geist Mono input large
- "Tare Weight (kg)" — Geist Mono input
- "Net Cargo Weight (kg)" — auto-calc read-only, Sky-50 highlight, 24px Geist Mono
- "Expected Cargo Weight (kg)" — read-only from order
- "Variance (kg)" — auto-calc, Red-500 if significant
- "Weigh-In Operator" — text input
- "Weigh-In Timestamp" — auto-set, read-only Geist Mono

Step 2 content (Dual Signature — shown after Step 1 complete):
Two side-by-side signature blocks:
LEFT — "Driver Signature (PUN)": Driver name display + Signature pad (dashed border box, "Tap to sign" label, clear button) + Timestamp (Geist Mono).
RIGHT — "Depot Signatory (DN)": Name input + Signature pad + Timestamp.
Both must be completed before Step 3 activates.

Step 3 content (Dispatch Cleared):
Emerald-50 full-width banner: "✓ Dispatch Cleared — DISP-2024-0312. Truck is authorized to depart. System has flagged this shipment as In-Transit."
Summary of weight, both signatures, departure time. "Print Dispatch Note" ghost button.

Font: Geist Sans / Geist Mono.
```

---

## S04-03 — PoD Capture (Driver Mobile Screen)

```
Design the Proof of Delivery (PoD) capture screen for Harvest LPGMS — the MOBILE-ONLY view for drivers. This uses the External/Mobile-Only license. No sidebar, no rail, minimal shell.

Shell for mobile:
- Topbar only: Harvest LPGMS logo (small, text only) left, "Driver View" chip Slate-100/Slate-600, Avatar initials right.
- No sidebar rail. White background. Full-width single column.

Screen content:
At top: delivery context card — prominent, Sky-50 bg, rounded-xl:
- "Delivery: ORD-2024-0889" in 18px / 700 Geist Sans
- Customer name in 16px / 600
- Customer address in 14px Geist Sans Muted Slate
- Expected: "220 kg — 12.5kg Cylinders × 17 units" in 14px Geist Mono

Step-by-step PoD capture (accordion steps, one open at a time):

STEP 1 — "Arrival Confirmation":
"I have arrived at the delivery location." Toggle/checkbox large (44px+ touch target). Auto-captures GPS timestamp.

STEP 2 — "Delivered Quantity":
"Cylinders delivered:" — large numeric input, Geist Mono, 48px height, big tap targets. "Damaged on arrival:" — numeric input.

STEP 3 — "Customer Signature":
Large signature pad. "Customer signs here to confirm delivery." Dashed border, clear button. Customer name text input below.

STEP 4 — "Delivery Photo":
Camera/upload button: "Take or upload delivery photo." Shows thumbnail on capture.

STEP 5 — "Submit PoD":
"Submit Proof of Delivery" Emerald-500 full-width button, 52px height.
After submit: Emerald success screen: "✓ PoD submitted. Return to base."

All touch targets minimum 44px. Large text. No complex tables. No sidebars. No desktop patterns.
Font: Geist Sans / Geist Mono. Single accent Sky-500.
```

---

## S04-04 — Route Planning

```
Design the Route Planning reference page for Harvest LPGMS (breadcrumb: "Inland Logistics / Route Planning"). MVP: manual route-plan reference field only — no auto-optimization.

Page header: "Route Planning" 24px / 700. Subtitle: "Manual route assignments for active dispatches. Full route optimization is Phase 2."

Info banner (Slate-50 bg, Slate-400 left border): "Route optimization is not automated in this version. Use this page to record and reference planned routes for each dispatch."

Main content: Two panels (60/40):

LEFT — Active Routes table:
Columns: Dispatch # (Geist Mono), Driver, Origin Depot, Destination, Distance (km Geist Mono), ETA (Geist Mono), Transport Cost Ref (link to Transport module), Status chip.
Show 4 rows.

Right of each row: "Route Notes" icon button — opens inline expansion with free-text route notes field (editable).

RIGHT — "Add/Edit Route Plan" form panel:
Triggered by selecting a dispatch or clicking "Assign Route +".
Form: Select Dispatch (dropdown), Origin Depot, Destination, Distance (km) — manual entry, Route Description (textarea — e.g. "Via Great North Road, overnight stop at Kapiri Mposhi"), Driver, Vehicle, Departure Time (datetime picker), Estimated Arrival (datetime picker).
"Link Transport Cost" — dropdown to reference a route from the Transport module (Module 08).
Save button: "Save Route Plan" Sky-500.

Font: Geist Sans / Geist Mono.
```

---

# MODULE 08 — Transport

---

## S08-01 — Route Cost Table + Landed Cost Calculator

```
Design the Transport module page for Harvest LPGMS (breadcrumb: "Transport / Route Cost Table"). This is a reference/calculator module — no approval chain.

Page header: "Transport & Landed Cost" 24px / 700. Subtitle: "Distance-based cost reference and landed cost per kg calculator."

Two sections:

SECTION 1 — "Route Cost Table":
Full-width reference table with columns matching the actual cost model:
Columns (all Geist Mono): Route (Origin → Destination), Drive Time, Distance km (one-way), Round Trip km, Diesel (litres RT), Fuel Cost (K), Per Diem (K × days), Total Per Diem (K), Tolls (count × rate), Total Tolls (K), Wear & Tear (K), **Total Trip Cost (K)** (Sky-700 bold), Cargo Volume (kg), **Transport Fare/KG (K)** (Sky-700 bold), **Landed Cost/KG (K)** (Charcoal bold).

Show real Zambian routes with actual data from the cost model:
1. Lusaka → Kitwe: 6h 20m, 360 km, 720 km RT, 324 L diesel, K 9,072 fuel, K 1,050 per diem (3 days), K 3,000 tolls (10 × K 300), K 144 wear, **Total K 13,266**, 5,000 kg, **K 2.65/kg**, **Landed K 49.65**
2. Lusaka → Solwezi: 9h 41m, 590 km, 1,180 km RT, 531 L diesel, K 14,868 fuel, K 1,750 per diem (5 days), K 5,400 tolls (18 × K 300), K 236 wear, **Total K 22,254**, 5,000 kg, **K 4.45/kg**, **Landed K 51.45**
3. Lusaka → Kaputa: 11h, 977 km, 1,954 km RT — show partial data
4. Lusaka → Chirundu: show
5. Lusaka → Nakonde: show
6. Ndola → Lusaka: return leg

Row hover: [Edit] pencil icon appears on right.
"Add Route +" ghost button below table.

SECTION 2 — "Landed Cost per KG Calculator":
Slate-50 bg, rounded-xl, 24px padding. Title "Landed Cost Calculator" in 16px / 600.
Interactive calculator layout:
- "Select Route" — dropdown (pulls from Route Cost Table above)
- "Cargo Weight (kg)" — Geist Mono input
- "Auto-populated:" Transport Cost (K Geist Mono read-only), Number of Trips auto-calc
- "LPG Purchase Price per kg (K)" — Geist Mono input
- "Import Duty & Levy (K)" — Geist Mono input (links from ZRA validation)
- "Other Costs (K)" — Geist Mono input (optional)
- Result block: "Landed Cost per KG" — large: 40px / 700 / Geist Mono / Sky-700, in Sky-50 bg box.

"Save Calculation" ghost button + "Link to PO" ghost button.

Font: Geist Sans / Geist Mono. No decorative charts. Clean reference utility.
```

---

# MODULE 09 — Admin

---

## S09-01 — Users & Licenses

```
Design the Users & Licenses management page for Harvest LPGMS (breadcrumb: "Admin / Users & Licenses / User List"). This is the SAP B1-style user management screen.

Page header: "Users & Licenses" 24px / 700. Subtitle: "Manage system users, license assignments, and authorization profiles."
Right: "Create User +" Sky-500.

License type summary bar (compact stats row, below header):
"Full/Professional: 2" | "Limited — Operations: 6" | "Limited — Commercial: 4" | "Limited — Finance: 3" | "Read-Only / Audit: 2" | "External/Mobile: 3" — each as a stat chip with colored dot, 13px Geist Mono.

Filter bar: Search | License Type filter | Authorization Profile filter | Status (Active / Inactive) filter.

Full-width data table:
Columns: □, User (avatar initials + name), Email (Geist Mono), License Type chip, Auth Profile (clickable link), Last Login (Geist Mono), Status chip (Active/Inactive), Actions.

License Type chips with colors:
- Full/Professional: Sky-50/Sky-700
- Limited — Operations: Amber-50/Amber-700
- Limited — Commercial: Violet-50/Violet-700
- Limited — Finance: Emerald-50/Emerald-700
- Read-Only / Audit: Slate-100/Slate-600
- External/Mobile: Orange-50/Orange-700

Show 8 users with variety across all license types. Include 1 Inactive user (row muted, Slate-400 text).

Actions on hover: [Edit] | [Deactivate] (if active) | kebab (Reset Password / View Audit Log / Clone Profile).

Font: Geist Sans / Geist Mono.
```

---

## S09-02 — Authorization Profile Builder

```
Design the Authorization Profile Builder for Harvest LPGMS (breadcrumb: "Admin / Authorization Profiles / Profile Builder"). This is the most complex admin screen — the SAP B1-style permission matrix.

Page header: "Authorization Profile: Approvals — Operations Manager" 24px / 700. Subtitle: "Define screen-level and approval-stage grants for this profile. Changes apply to all users assigned this profile."
Right: "Save Profile" Sky-500 | "Clone Profile" ghost.

Layout: Two-column (30/70).

LEFT COLUMN — Profile Metadata:
- "Profile Name" — text input (current value: "Approvals — Operations Manager")
- "Description" — textarea
- "License Type Required" — dropdown (this profile can only be assigned to users with this or higher license type). Current: "Limited — Operations"
- "Users on this profile" — small list: 2 avatars + names + "Manage →" link

RIGHT COLUMN — Permission Matrix:
Title "Module & Screen Access" 16px / 600.

A structured permission table organized by Module → Screen. For each screen row:
Columns: Screen Name | No Authorization (○ radio) | Read-Only (○ radio) | Full (○ radio)

Group by module with colored module headers (collapsible):
- [CRM]: All Customers, Pipeline, Cylinder Registry, Service Tickets, Scorecard
- [Procurement]: Overview, All POs, Raise PO, Compliance Check, Payments, Import Tracking
- [GR]: All GR screens
- [Stock Adjustment]: All SA screens
- [S&D]: All S&D screens
- [Inland Logistics]: All IL screens
- [Transport]: Route Cost, Calculator
- [Admin]: (only visible/editable for Full/Professional license type)

Active/selected radio buttons use Sky-500 accent.

Below the screen matrix: a second section — "Approval Chain Authorization":
Title "Approval Stage Grants" 16px / 600.
Two approval chains, each shown as a 4-column row:
"Stock Adjustment Chain:" | [Submit ☐] | [Approve (OM) ☑] | [Review (IC) ☐] | [Post (Finance) ☐]
"Procurement Chain:" | [Submit ☐] | [Approve (OM) ☑] | [Review (IC) ☐] | [Post/Payment (Finance) ☐]
Checkboxes — checked grants that stage action to this profile. Sky-500 checkbox accent.

Note below: "Approval stage grants are independent of screen-level access. A user can have Read-Only on a PO screen but still have Approve authorization for the PO chain."

Font: Geist Sans / Geist Mono. Dense but organized.
```

---

## S09-03 — Phase 2 Locked Items (Nav State)

```
Design the Phase 2 locked navigation state for Harvest LPGMS. This shows what users see when they click a Phase 2 item in the icon rail (CEO Dashboard or F&M Costing).

The icon rail item shows at 50% opacity with a small lock icon overlay on the module icon.

When clicked, instead of navigating, a minimal centered overlay message appears in the content area (NOT a modal — inline in the content canvas):

Centered content block (max-width 480px, Surface White, 1px Whisper Border, rounded-2xl, 32px padding):
- Lock icon in 48px Slate-300
- Title: "CEO Dashboard" in 20px / 600 / Charcoal Ink
- Description: "This module is planned for Phase 2 and is not available in the current build." in 14px Muted Slate
- Phase chip: "Phase 2" in Slate-100/Slate-600
- "Return to Home" ghost link in Sky-500

The rest of the content canvas remains at #F8FAFC, no dimming/overlay effect — just the centered message card in a blank canvas.

Secondary sidebar: shows no items for Phase 2 modules (empty state: module name header, then "No screens available in this phase" in 13px Muted Slate).

Font: Geist Sans / Geist Mono. Clean, informative, not apologetic.
```

---

## S09-04 — Admin: Price List Management

```
Design the Price List Management screen for Harvest LPGMS (breadcrumb: "Admin / Price List Management"). The Admin sets selling prices per product per customer segment. Changes take effect immediately on new orders.

Page header: "Price Lists" 24px / 700. Subtitle: "Selling prices per product by customer segment. Landed cost reference pulled from Transport module."
Right: "New Price List +" Sky-500.

5 tab-style segment chips (pill group, Sky-500 active underline):
[Standard Retail] [Commercial Tier 1] [Commercial Tier 2] [Sub-Dealer Rate] [LPG Extreme Rate]
Each chip shows effective date in 11px Geist Mono Muted Slate below the label.

Active price list — editable table:
Columns: Product / Size, Sell Price (K, Geist Mono — inline editable), Cost/KG (K, Geist Mono, read-only from Transport), Margin (K, auto-calc), Margin % (auto-calc Geist Mono — Red if <10%, Amber if 10–15%, Emerald if >15%), Effective From (Geist Mono), Last Updated By.

Rows: Bulk LPG (per MT), 3 kg, 6 kg, 12.5 kg, 19 kg, 48 kg, Regulator, Hose (per unit).

Inline editing: tapping a Sell Price cell turns it into a Geist Mono input with save ✓ icon right. Tab key advances to next row.

Landed Cost reference card below table (Slate-50 bg, 1px border, rounded-xl, 13px Geist Sans):
"Current landed cost range: K 47.65 (Kitwe) – K 53.20 (Solwezi) per kg. Minimum recommended margin: 12%. Source: Transport module."
Link: "View Landed Cost Calculator →" in Sky-500.

Price History panel (collapsible, below): last 5 price changes for this list — Date, Changed By, Product, Old Price → New Price. All Geist Mono.

"Save Price List" Sky-500 (appears after any edit) | "Revert" ghost.

Font: Geist Sans / Geist Mono.
```

---

## S09-05 — Admin: Customer Groups & Tax Codes

```
Design the Customer Groups configuration screen for Harvest LPGMS (breadcrumb: "Admin / Customer Groups"). This defines the account structure, control accounts, tax codes, and default payment terms that drive all customer creation and reporting segmentation.

Page header: "Customer Groups" 24px / 700. Subtitle: "Master account structure for customer segmentation, GL mapping, and tax treatment."
Right: "New Group +" Sky-500.

Main table:
Columns: Group Name, Control Account (Geist Mono), Customer Count (Geist Mono), Tax Code, Default Payment Terms, Default Credit Limit (K Geist Mono), Price List (link), Actions.

Show 5 pre-seeded rows:
1. Household — CON-HH-001, 187 customers, VAT Standard (16%), Cash on Delivery, K 0, Standard Retail
2. Commercial — CON-COMM-001, 94 customers, VAT Standard (16%), Net 30, K 50,000, Commercial Tier 1
3. Sub-Dealer — CON-SD-001, 31 customers, VAT Standard (16%), Net 14, K 30,000, Sub-Dealer Rate
4. LPG Extreme — CON-LPG-X, 1 entity, VAT Standard (16%), Net 7, K 500,000, LPG Extreme Rate — add Violet-50/Violet-700 "Profit Centre" chip in Group Name column
5. Distributor — CON-DIST-001, 0 customers, VAT Standard (16%), Net 30, K 100,000, Commercial Tier 2

Actions on hover: [Edit] opens right panel | [View Customers →] | kebab.

EDIT SIDE PANEL (40% width, right):
- Group Name — text input
- Control Account Code — Geist Mono input (GL mapping for revenue segmentation)
- Tax Code — dropdown: VAT Standard 16% / VAT Exempt / ZRA Zero-Rated
- Tax ID Required — toggle (on for Commercial, off for Household)
- Default Payment Terms — dropdown
- Default Credit Limit (K) — Geist Mono input
- Assign Price List — dropdown (links to S09-04)
- "Apply defaults to all new customers in this group" — toggle
"Save Group" Sky-500.

Info card below table (Slate-50 bg, 13px Geist Sans):
"Tax codes: VAT Standard (16%) applies to all domestic sales. Confirm ZRA-Exempt or Zero-Rated status with your tax advisor before changing. Changes affect all new invoices — not retroactive."

Font: Geist Sans / Geist Mono.
```

---

# MODULE 10 — POS (Point of Sale)

> **Two surfaces, one module.**  
> Mobile screens (S10-01 through S10-07) run the stripped mobile shell — topbar only, no sidebar, identical pattern to the driver PoD screen (S04-03). The cashier's phone is the terminal.  
> Desktop back-office screen (S10-08) runs inside the full shell for managers reviewing transactions and shift summaries.  
> POS is a **channel within S&D** — every transaction creates an order tagged `POS / Walk-In` and draws from the same stock ledger. No separate stock silo.

**Secondary sidebar for POS (desktop, manager view):**

```
POS
   ├─ Overview
   ├─ Transactions
   │    └─ All Transactions
   ├─ Shifts
   │    ├─ Shift Log
   │    └─ Z-Reports
   └─ Configuration
        ├─ Stations
        └─ Products & Prices
```

**Authorization profile — POS Cashier:** `External/Mobile-Only` license ceiling. Access: POS mobile screens only + CRM customer lookup (read-only for search). No desktop shell access.

---

## S10-01 — Open Shift (Mobile)

```
Design the Open Shift screen for Harvest LPGMS POS — a mobile phone screen used by a cashier at a unit station to start their shift. Mobile-only shell: topbar only (no sidebar, no icon rail). White background, full-width single column.

Topbar (52px, white, 1px #E2E8F0 bottom border):
Left: "Harvest POS" in 16px / 700 / Geist Sans / Charcoal Ink — text only, no logo image.
Right: User avatar initials circle "KM" + "Cashier" chip in Slate-100/Slate-600.

Content area (24px horizontal padding, 32px top padding):

Welcome block:
"Good morning, Kunda" in 22px / 700 / Geist Sans / Charcoal Ink.
"Unit Station: Lusaka Main — Depot Floor" in 14px / Muted Slate / Geist Sans.

Form — two fields, large and touch-friendly:

1. "Station" — dropdown, 52px height, 16px font, Geist Sans. Options: Lusaka Main / Lusaka Depot Floor / Ndola / Ndola Outlet. Pre-selects based on user profile.

2. "Opening Cash Float (K)" — numeric input, 56px height, 20px / Geist Mono / Charcoal Ink. Placeholder "0.00". Label above in 13px Geist Sans. Helper text: "Count the cash in the drawer and enter the amount before opening."

Info card below fields:
Slate-50 bg, 1px #E2E8F0 border, rounded-xl, 16px padding.
Title "Shift Details" in 13px / 600 / Slate-600.
Date: "Tuesday, 28 July 2026" / Time: "07:44 AM" — both in Geist Mono Charcoal.
Shift #: "SHIFT-2026-0412" in Geist Mono Slate-500 (auto-generated, read-only).

Primary button at bottom (full width, 52px height, rounded-xl):
"Open Shift →" Sky-500 background, white text, 16px / 600 / Geist Sans.

All touch targets minimum 44px. No sidebar. No desktop patterns. Font: Geist Sans / Geist Mono.
```

---

## S10-02 — New Sale: Customer Lookup + Transaction Type (Mobile)

```
Design the main POS register screen for Harvest LPGMS — the screen a cashier sees after opening their shift. This is step 1 of every transaction. Mobile shell: topbar only, white background.

Topbar:
Left: back arrow + "Shift Open" in 14px / Slate-500. Center: "SHIFT-2026-0412" in 12px / Geist Mono / Slate-400. Right: "K 0.00" running shift total in 13px / 700 / Geist Mono / Sky-700.

Shift status strip below topbar (40px, Sky-50 bg, 1px Sky-100 border-bottom):
"Station: Lusaka Main  •  Cashier: Kunda M.  •  Opened: 07:44" — all in 12px / Geist Mono / Sky-700. Horizontal, space-between.

Section 1 — "Find Customer" (mandatory first step):
Label: "Customer" in 13px / 600 / Charcoal Ink.
Search input: 52px height, 16px Geist Sans, placeholder "Search by name, phone, or account #", search icon left, clear icon right. Sky-500 focus ring.
Below input: small note in 12px / Muted Slate: "Every sale must link to a registered customer."

After search — customer result card (Surface White, 1px Whisper Border, rounded-xl, 16px padding, appears below search bar):
- Customer name: 16px / 700 / Charcoal Ink
- Account # in Geist Mono Slate-500, phone number in Geist Mono Slate-500
- Type chip (Household / Commercial / Sub-Dealer)
- Credit status chip if commercial (Active credit: "K 42,500 available" in Emerald, or "Credit Blocked" in Red)
- Cylinders on deposit: "3 cylinders on file" in 12px Geist Mono Sky-700 (relevant for exchange)
- "Use this customer" Emerald-500 button, 44px height, full-width
- "Not the right person" link in Sky-500 (resets search)

Below customer confirmation: "Quick Register" link — "Customer not found? Register now →" in 13px Sky-500. Tapping opens a minimal inline form: Name + Phone + Type (3 fields only). Full KYC deferred.

Section 2 — "Transaction Type" (renders after customer selected):
Label: "What are they buying?" in 14px / 600 / Charcoal Ink.
3 large transaction type tiles in a 1-column stack (full width, 72px each, rounded-xl, 1px Whisper Border, 16px padding):
- Tile 1: receipt icon + "Cylinder Sale" (bold) + "Buy a new filled cylinder" (sub, Muted Slate)
- Tile 2: arrows-exchange icon + "Cylinder Exchange" (bold) + "Return empty, take filled" (sub)
- Tile 3: package icon + "Accessories" (bold) + "Regulators, hoses, fittings" (sub)
Active/tapped tile: Sky-500 border 2px, Sky-50 background.

All touch targets 44px+. Font: Geist Sans / Geist Mono.
```

---

## S10-03 — New Sale: Product Grid + Cart (Mobile)

```
Design the product selection and cart screen for a Cylinder Sale in Harvest LPGMS POS. Mobile shell: topbar only, white background.

Topbar:
Left: back arrow (returns to transaction type selection). Center: customer name "Bwalya Mwansa" in 14px / 600 / Charcoal Ink. Right: cart badge showing item count "0 items" in 12px / Geist Mono / Sky-700.

Context strip below topbar (40px, Slate-50):
"Cylinder Sale  •  Lusaka Main  •  Stock: 847 filled units available" — 12px Geist Mono Sky-700.

Main content — Product Grid (2-column grid, full width):
Each product tile: Surface White, 1px Whisper Border, rounded-xl, 20px padding, 100px height.
Contents of each tile:
- Size label: "12.5 kg" in 20px / 700 / Geist Mono / Charcoal Ink (dominant)
- Price: "K 245.00" in 14px / 600 / Geist Mono / Sky-700
- Stock: "Stock: 284" in 11px / Geist Mono / Muted Slate
- Tap to add: tapping the tile adds 1 unit to cart. Added state: Sky-500 border 2px, Sky-50 bg, checkmark chip top-right showing quantity.

Show 6 product tiles: 3 kg (K 72.00, stock 112), 6 kg (K 135.00, stock 203), 12.5 kg (K 245.00, stock 284), 19 kg (K 385.00, stock 61), 48 kg (K 920.00, stock 18), Accessories ("See list →", stock N/A).

Quantity controls on added tile: − button (Slate-200 bg, 36px) + quantity display (Geist Mono 16px) + + button (Sky-500 bg white, 36px). All 36px+ touch targets.

Bottom of screen — Sticky Cart Panel (Surface White, 1px #E2E8F0 top border, 80px height):
Left: "2 items" in 13px Geist Sans Slate-500.
Center: "K 490.00" in 22px / 700 / Geist Mono / Charcoal Ink.
Right: "Payment →" Sky-500 rounded-xl button, 48px height, 120px width.

If cart is empty: Cart panel shows "Nothing added yet" in 13px Muted Slate. Payment button disabled, Slate-200.

Font: Geist Sans / Geist Mono. Large touch targets. No desktop patterns.
```

---

## S10-04 — Cylinder Exchange: Empty Return + Deposit Netting (Mobile)

```
Design the Cylinder Exchange transaction screen for Harvest LPGMS POS. Deposit is netted at the counter immediately — the customer pays the difference between the new cylinder price and the deposit on the returned cylinder. Mobile shell: topbar only, white background.

Topbar:
Left: back arrow. Center: "Bwalya Mwansa — Exchange" in 14px / 600 / Charcoal Ink. Right: customer's cylinders on deposit chip: "3 on file" Sky-50/Sky-700.

This screen has two distinct panels stacked vertically:

PANEL 1 — "Cylinder Being Returned" (top panel):
Label: "What size are they returning?" in 14px / 600 / Charcoal Ink.
5 large button options in a 1-column stack (64px each, rounded-xl, 1px Whisper Border):
3 kg | 6 kg | 12.5 kg | 19 kg | 48 kg.
Tapped/selected state: Sky-500 border 2px, Sky-50 bg, Sky-500 text, checkmark right.

After selection: deposit info row appears below the buttons:
Slate-50 bg, rounded-lg, 12px padding.
"12.5 kg cylinder deposit on file: K 150.00" in 14px / 600 / Geist Mono / Emerald-700.
"Deposit will be deducted from today's sale." in 12px / Muted Slate.

If the customer has no deposit on file for that size: Amber-50 bg warning: "No deposit found for a 12.5 kg cylinder under this account. Exchange will proceed at full price."

PANEL 2 — "Cylinder Being Taken" (bottom panel, separated by a thin Whisper Border divider with label "Now select what they're taking:"):
Same 5-option button stack. Selected state same as Panel 1.

After both selections made — NET CALCULATION CARD (Emerald-50 bg, Emerald-500 left border 2px, rounded-xl, 16px padding, prominent):
"12.5 kg cylinder: K 245.00"
"Less deposit on 12.5 kg return: − K 150.00" in Emerald-700
Horizontal rule.
"Amount Due: K 95.00" in 24px / 700 / Geist Mono / Charcoal Ink

If deposit > new price (edge case): "Refund to Customer: K 55.00" in Red-500 / Geist Mono — with note "Record cash refund before completing transaction."

Bottom sticky CTA: "Proceed to Payment →" Emerald-500 full-width 52px button (active only when both sizes selected).

Font: Geist Sans / Geist Mono. All touch targets 44px+.
```

---

## S10-05 — Payment (Mobile)

```
Design the Payment screen for Harvest LPGMS POS. This screen handles all payment methods for both Cylinder Sale and Exchange transactions. Mobile shell: topbar only, white background.

Topbar:
Left: back arrow. Center: customer name in 14px / 600. Right: transaction type chip ("Cylinder Sale" Sky-50/Sky-700).

Amount Due block at top (centered, prominent):
"Amount Due" in 13px / 500 / Muted Slate.
"K 490.00" in 44px / 700 / Geist Mono / Charcoal Ink.
"2 × 12.5 kg cylinders" in 13px / Geist Sans / Muted Slate below.

Payment Method selection:
Label: "Payment Method" in 14px / 600 / Charcoal Ink.
5 options as full-width button rows (56px each, 1px Whisper Border, rounded-xl, 12px padding between):
- Cash (banknote icon)
- Airtel Money (phone icon)
- Bank Card (credit-card icon)
- Credit Account (building-office icon — only active/tappable if customer has available credit)
- Bank Transfer / EFT (bank icon)
Selected state: Sky-500 border 2px, Sky-50 bg, Sky-700 label, checkmark right.

Credit Account row: if customer has no credit or is Credit-Blocked, show row at 50% opacity with "Not available" in 11px Red-500 sub-label. Non-tappable.

CONDITIONAL PAYMENT DETAILS (renders below the method list based on selection):

CASH selected:
"Amount Received (K)" — 56px Geist Mono input, 20px font, numeric keyboard hint.
Change calculation (auto, below input): "Change: K 10.00" in 18px / 700 / Geist Mono / Emerald-700. Updates live on input. If amount received < amount due: "Insufficient" in Red-500.

AIRTEL MONEY selected:
Info card (Sky-50 bg, rounded-xl):
"Airtel Merchant Code: 2841-HARVEST" in 18px / 700 / Geist Mono / Charcoal Ink (prominent).
"Amount to send: K 490.00" in 16px / 600 / Geist Mono / Sky-700.
"Ask the customer to send K 490.00 to the merchant code above, then confirm below." in 13px Muted Slate.
Confirm toggle: "Payment received on Airtel" — large checkbox/toggle 44px.

BANK CARD selected:
Info card (Slate-50 bg):
"Use the card terminal to process payment." in 14px Geist Sans Charcoal.
"Amount: K 490.00" in Geist Mono prominent.
"Tap confirm once the terminal approves." in 13px Muted Slate.
Confirm toggle: "Card payment approved on terminal".

CREDIT ACCOUNT selected:
Info card (Emerald-50 bg):
Customer name + "Available Credit: K 42,500" in Geist Mono Emerald-700.
"K 490.00 will be charged to this account and added to their outstanding balance." in 13px.
Confirm toggle: "Confirm credit charge".

Bottom: "Complete Sale ✓" Emerald-500 full-width 52px button (active only when confirmation is satisfied).

Font: Geist Sans / Geist Mono. All touch targets 44px+.
```

---

## S10-06 — Receipt + Sale Confirmation (Mobile)

```
Design the post-payment Receipt and Sale Confirmation screen for Harvest LPGMS POS. Mobile shell: topbar only, white background.

Topbar:
Left: nothing (transaction is complete, no back navigation). Center: "Harvest POS" text. Right: shift running total "K 1,240.00" in 13px / 700 / Geist Mono / Sky-700 (updated with this sale).

Top confirmation banner (full width, Emerald-500 bg, white text, 72px height, rounded-b-xl):
Checkmark circle icon (32px, white) + "Sale Complete" in 20px / 700 / Geist Sans / white.
Sub-line: "TXN-2026-04891  •  K 490.00  •  Cash" in 13px / Geist Mono / Emerald-50.

Receipt preview (centered, max-width 320px, white bg, 1px Slate-200 border, rounded-xl, resembling an 80mm thermal receipt):
--- Harvest LPG Management System ---
        Lusaka Main Station
     Tel: +260 977 000 000
--------------------------------
Date: 28/07/2026  Time: 10:42
Cashier: Kunda M.  Shift: 0412
Customer: Bwalya Mwansa
Account: ACC-0042
--------------------------------
12.5 kg Cylinder  x2   K 490.00
--------------------------------
TOTAL               K 490.00
CASH RECEIVED       K 500.00
CHANGE              K  10.00
--------------------------------
  Thank you for your business
All values rendered in Geist Mono, 12px, dark Charcoal text, tight line-height. Receipt container: pure white, sharp corners or very slightly rounded. The receipt text block itself should look like thermal paper output — monospaced, dense, center-aligned headings, left-aligned items.

Below receipt: 3 action buttons stacked vertically (full width, 48px each, 8px gap):
1. "Print Receipt" — Surface White bg, 1px border, Charcoal text, printer icon left. Sky-500 hover state.
2. "Send via WhatsApp" — Emerald-50 bg, Emerald-700 text, WhatsApp icon left (use a generic chat/message icon, not a brand logo).
3. "Send via SMS" — Slate-50 bg, Slate-700 text, message icon left.

Below action buttons: thin divider, then:
"New Sale" — Sky-500 full-width 52px button with right arrow icon. This is the primary reset CTA — resets to S10-02 (customer lookup).

Font: Geist Sans (UI chrome) / Geist Mono (receipt content). No illustrations. Clean.
```

---

## S10-07 — Close Shift / Z-Report (Mobile)

```
Design the Close Shift / Z-Report screen for Harvest LPGMS POS. The cashier reviews their shift totals, counts the cash drawer, and submits the shift summary. Mobile shell: topbar only, white background.

Topbar:
Left: "Shift Summary" in 16px / 700 / Geist Sans. Right: shift # "SHIFT-2026-0412" in 13px / Geist Mono / Muted Slate.

Shift header card (Sky-50 bg, rounded-xl, 16px padding, 1px Sky-100 border):
Station: Lusaka Main  •  Cashier: Kunda Mutale
Opened: 07:44  Closing: 17:03
Duration: 9h 19m — all Geist Mono Charcoal.

Section 1 — "Transaction Summary" (read-only, system-calculated):
Title in 14px / 600 / Charcoal Ink.
Stat rows (each row: label left, value right, 48px height, 1px Whisper Border bottom, 16px horizontal padding):
- Total Transactions: "47" Geist Mono
- Cylinder Sales: "38 txns  •  K 8,640.00" Geist Mono
- Cylinder Exchanges: "6 txns  •  K 1,020.00" Geist Mono (net value)
- Accessories: "3 txns  •  K 315.00" Geist Mono
- Total Revenue: "K 9,975.00" in 16px / 700 / Geist Mono / Sky-700 (highlighted row, Sky-50 bg)

Section 2 — "By Payment Method" (read-only):
Rows: Cash (K 6,240.00), Airtel Money (K 2,480.00), Bank Card (K 890.00), Credit Account (K 365.00), Bank Transfer (K 0.00). All Geist Mono.

Section 3 — "Cash Reconciliation" (manual entry, the only input section):
Title in 14px / 600 / Charcoal Ink.
Opening Float: "K 500.00" Geist Mono read-only.
Cash Sales: "K 6,240.00" Geist Mono read-only.
Expected in Drawer: "K 6,740.00" in Geist Mono Sky-700 read-only (Opening Float + Cash Sales).
"Actual Cash Counted (K)" — 56px Geist Mono numeric input, 20px font. Placeholder: "0.00".
Variance (auto-calc after input): if zero — "K 0.00" in Emerald-700 + "Balanced" chip. If non-zero — amount in Red-500 + "Variance — explain below" chip.
"Variance Explanation" — textarea, appears only if variance ≠ 0. Required if variance shown.

Section 4 — Declaration:
Checkbox: "I confirm the above figures are accurate and the cash has been counted and secured."

Bottom: "Submit & Close Shift" Emerald-500 full-width 52px button. Disabled until cash counted input is filled and declaration checked.

After submit: success screen — "Shift Closed. Z-Report submitted to management." Emerald checkmark, "Z-Report: ZR-2026-0412" Geist Mono, "You are now signed out of the POS." Muted Slate.

Font: Geist Sans / Geist Mono. All touch targets 44px+.
```

---

## S10-08 — POS Back-Office: Transaction Log + Shift Summaries (Desktop)

```
Design the POS back-office overview page for Harvest LPGMS — desktop full shell view (dark icon rail with POS active, Slate-800 secondary sidebar showing POS module nav, white topbar with breadcrumb "POS / Transactions").

POS secondary sidebar items:
[Overview], group "Transactions" [All Transactions], group "Shifts" [Shift Log, Z-Reports], group "Configuration" [Stations, Products & Prices].

Page header:
- Title: "POS Transactions" 24px / 700 / Geist Sans.
- Subtitle: "All point-of-sale transactions across all unit stations."
- Right: "Export CSV" ghost button | "Download Z-Reports" ghost button.

KPI bar — 4 stat cards:
1. "Today's Revenue" — value: "K 34,280" in 32px / 700 / Geist Mono / Sky-700. Label: "across 3 stations."
2. "Transactions Today" — value: "147" Geist Mono. Label: "all types."
3. "Active Shifts" — value: "3" Emerald Geist Mono. Label: "open right now."
4. "Pending Z-Reports" — value: "1" Amber Geist Mono. Label: "shifts closed, not yet reviewed."

Filter bar:
Station dropdown (All / Lusaka Main / Ndola / etc.) + Cashier dropdown + Transaction Type filter (All / Cylinder Sale / Exchange / Accessories) + Payment Method filter + Date range picker (default: today).

Full-width data table:
Columns: □, TXN # (Geist Mono), Station, Cashier, Customer (Name + Account # sub-row), Type chip, Products (truncated text), Amount (K Geist Mono), Payment Method chip, Time (Geist Mono), Shift # (Geist Mono), Actions.

Payment method chips:
- Cash: Slate-100/Slate-600
- Airtel Money: Emerald-50/Emerald-700
- Bank Card: Sky-50/Sky-700
- Credit Account: Violet-50/Violet-700
- EFT: Amber-50/Amber-700

Show 8 rows with variety across all transaction types, stations, and payment methods. Exchange rows show amount as net value in parenthetical sub-line: "K 95.00 (after K 150.00 deposit)" in 12px Geist Mono Slate-500 below the main amount.

Below table: "Recent Shift Summaries" section — 3 shift summary cards in a row (3-column grid, not equal — use 35/35/30 widths). Each card: Surface White, 1px border, rounded-xl, 16px padding. Shows: Station, Cashier name, Date, Duration, Total Revenue (K Geist Mono), Transaction count, Cash variance chip (Balanced in Emerald / Variance in Red). "View Z-Report →" link in Sky-500.

Font: Geist Sans / Geist Mono. Standard desktop shell.
```

---

# APPENDIX — Reusable Component Reference Prompts

---

## COMP-01 — 4-Stage Approval Stepper (Isolated Component)

```
Design the 4-stage horizontal approval stepper component for Harvest LPGMS. This component is used identically on Stock Adjustment detail pages and Procurement PO detail pages — only the stage labels and actor names change.

Full-width strip, 60px height, Surface White background, 1px #E2E8F0 bottom border, 24px horizontal padding.

Four stage nodes connected by lines:

NODE ANATOMY:
- Shape: pill/lozenge, 36px height, variable width (min 120px)
- Content: stage number + stage name, 13px / 600 / Geist Sans
- Below node: actor label in 11px Geist Sans Muted Slate

CONNECTING LINES:
- 2px horizontal line between nodes
- Incomplete: #E2E8F0 (Whisper Border)
- Completed path: #10B981 (Emerald-500)

NODE STATES (show all 5 in one reference view):
1. COMPLETED: #10B981 bg, white text, checkmark icon left of text. Timestamp below in 11px Geist Mono.
2. ACTIVE: #0EA5E9 bg, white text, animated pulse ring (Sky-300 ring, 1.5x scale, 2s infinite). "Awaiting action" below.
3. PENDING/LOCKED: #E2E8F0 bg, #64748B text, lock icon. Actor label below in Slate-400.
4. DECLINED: #EF4444 bg, white text, X icon left. "Returned — [date]" below in Red Geist Mono.
5. SKIPPED (not applicable): Slate-100 bg, Slate-400 text, dash icon.

Show all 5 node states arranged horizontally as a reference sheet, labeled with state name above each.

Below the component states: show two real instances:
Instance A (Stock Adjustment): Submit — OM Approve — IC Review — Finance Post
Instance B (Procurement): Submit PO — OM Approve — IC Review — Finance Payment

Font: Geist Sans (labels) / Geist Mono (timestamps). No Inter.
```

---

## COMP-02 — Status Chip System

```
Design the complete status chip system for Harvest LPGMS as a reference sheet. All chips use: rounded-full, px-2.5 py-0.5, 11px / 600 / Geist Sans / uppercase.

Show all chips in a 3-column grid layout with chip name label above each:

WORKFLOW STATUS CHIPS:
- Draft: #F1F5F9 bg / #475569 text
- Awaiting OM: #FFFBEB bg / #B45309 text
- Awaiting IC: #F5F3FF bg / #6D28D9 text
- Awaiting Payment: #F0F9FF bg / #0369A1 text
- Posted / Approved: #ECFDF5 bg / #047857 text
- Declined: #FEF2F2 bg / #B91C1C text
- Returned: #FEF2F2 bg / #B91C1C text (same as declined, different label)
- In-Transit: #E0F2FE bg / #075985 text

CUSTOMER / ACCOUNT STATUS CHIPS:
- Active: #ECFDF5 bg / #047857 text
- On-Hold: #FFFBEB bg / #B45309 text
- Credit-Blocked: #FEF2F2 bg / #B91C1C

CHANNEL CHIPS:
- Sub-Dealer: #EFF6FF bg / #1D4ED8 text
- Commercial: #F5F3FF bg / #5B21B6 text
- Household: #F0FDF4 bg / #166534 text
- Cash: #ECFDF5 bg / #047857 text
- Credit: #FFF7ED bg / #C2410C text

CYLINDER STATUS CHIPS:
- Issued: #F0F9FF bg / #0369A1 text
- At Depot: #F8FAFC bg / #475569 text
- Faulty: #FEF2F2 bg / #B91C1C text
- In-Transit: #E0F2FE bg / #075985 text

LICENSE TYPE CHIPS (Admin module only):
- Full/Professional: #F0F9FF bg / #0369A1 text
- Limited—Operations: #FFFBEB bg / #B45309 text
- Limited—Commercial: #F5F3FF bg / #6D28D9 text
- Limited—Finance: #ECFDF5 bg / #047857 text
- Read-Only/Audit: #F1F5F9 bg / #475569 text
- External/Mobile: #FFF7ED bg / #C2410C text
- Limited—POS Cashier: #FFF0F9 bg / #9D174D text

POS TRANSACTION TYPE CHIPS:
- Cylinder Sale: #F0F9FF bg / #0369A1 text
- Cylinder Exchange: #F5F3FF bg / #5B21B6 text
- Accessories: #FFFBEB bg / #B45309 text

POS PAYMENT METHOD CHIPS:
- Cash: #F1F5F9 bg / #475569 text
- Airtel Money: #ECFDF5 bg / #047857 text
- Bank Card: #F0F9FF bg / #0369A1 text
- Credit Account: #F5F3FF bg / #6D28D9 text
- Bank Transfer / EFT: #FFFBEB bg / #B45309 text

POS SHIFT STATUS CHIPS:
- Shift Open: #ECFDF5 bg / #047857 text
- Shift Closed: #F1F5F9 bg / #475569 text
- Z-Report Pending: #FFFBEB bg / #B45309 text
- Z-Report Reviewed: #ECFDF5 bg / #047857 text
- Cash Variance: #FEF2F2 bg / #B91C1C text

Font: Geist Sans. No borders on chips — background color carries the signal.
```
