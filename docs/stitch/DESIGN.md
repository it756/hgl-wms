# Design System: Harvest LPGMS

**Product:** Harvest LPG Management System — field-operations ERP for an LPG distribution company.  
**Component library (build target):** shadcn/ui  
**Shell pattern:** Vercel/Supabase — dark icon rail → nested secondary sidebar → light content area → topbar breadcrumb  
**Authorization model:** SAP Business One pattern — one shared system, permission-driven nav, no per-role dashboards

---

## 1. Visual Theme & Atmosphere

**Density: 7/10** — daily-operations software. Data tables, forms, approval queues. Every pixel earns its place.  
**Variance: 5/10** — predictable grids for operational trust, with intentional asymmetry in page headers and empty states.  
**Motion: 3/10** — micro-transitions only. Approvals engine state changes get a subtle 200ms ease. This is field-operations work software, not a consumer product.

The overall atmosphere is **precision-clinical with operational warmth** — the design language of a well-lit logistics control room. Confident monochrome base with a single cold-blue accent. Feels like Linear or Supabase deployed for warehouse operations. Tables are the primary UI pattern. Every approval step has a visual status it cannot lose.

The shell is permanent and structural: dark left rail, lighter secondary sidebar, white content canvas. The topbar is minimal — breadcrumb left, user avatar + notifications right. No hero imagery anywhere in the app. No decorative gradients. Data is the hero.

---

## 2. Color Palette & Roles

- **Canvas** (`#F8FAFC`) — Primary content area background, Slate-50
- **Surface White** (`#FFFFFF`) — Card backgrounds, modal backgrounds, table row hover
- **Rail Night** (`#0F172A`) — Left icon rail background, Slate-950
- **Sidebar Deep** (`#1E293B`) — Secondary sidebar background, Slate-800
- **Sidebar Hover** (`#334155`) — Secondary sidebar item hover/active, Slate-700
- **Charcoal Ink** (`#0F172A`) — Primary text, headings, table cell primary values
- **Muted Slate** (`#64748B`) — Secondary text, labels, metadata, timestamps, Slate-500
- **Whisper Border** (`#E2E8F0`) — Table dividers, card borders, input borders, Slate-200
- **Sky Accent** (`#0EA5E9`) — Single accent: CTAs, active nav state, focus rings, step-active fill, Sky-500
- **Emerald Posted** (`#10B981`) — Status: Posted / Completed / Delivered / Passed
- **Amber Pending** (`#F59E0B`) — Status: Awaiting / Pending / In-Progress / Draft
- **Red Declined** (`#EF4444`) — Status: Declined / Returned / Failed / Overdue
- **Violet IC** (`#8B5CF6`) — Status chip: IC Review stage only (distinguishes from OM Approve)
- **Sidebar Text** (`#94A3B8`) — Inactive icon rail labels, Slate-400
- **Sidebar Active Text** (`#F1F5F9`) — Active icon rail label, Slate-100

> **Banned:** Pure black `#000000`, any neon or purple glow shadows, oversaturated gradients on text, warm gray mixed with cool gray.

---

## 3. Typography Rules

- **UI Sans:** `Geist Sans` — all labels, table headers, body text, navigation, buttons
- **Mono:** `Geist Mono` — all numeric values (weights, volumes, amounts, quantities, IDs), timestamps, status codes, ZRA refs
- **Scale:**
  - Page title: `24px / 700 / Geist Sans / Charcoal Ink`
  - Section heading: `16px / 600 / Geist Sans / Charcoal Ink`
  - Table header: `12px / 600 / Geist Sans / Muted Slate / UPPERCASE / tracking-wide`
  - Table cell primary: `14px / 500 / Geist Sans / Charcoal Ink`
  - Table cell secondary: `13px / 400 / Geist Mono / Muted Slate`
  - Badge/chip label: `11px / 600 / Geist Sans / UPPERCASE`
  - Number/value: `14px / 600 / Geist Mono / Charcoal Ink`
  - Large stat/KPI: `32px / 700 / Geist Mono / Charcoal Ink`
- **Banned:** Inter font anywhere. Any serif font. Generic system fonts.

---

## 4. Component Stylings

### Navigation Rail (Left, fixed)

- Background: Rail Night `#0F172A`
- Width: 64px collapsed, icon-only
- Icons: 22px, Slate-400 inactive → Slate-100 + Sky-500 background pill active
- Module name tooltip on hover (dark tooltip, Slate-800 bg, white text)
- Bottom: Avatar icon (user initials), Settings icon
- Phase 2 locked items: icon visible, 50% opacity, lock overlay icon, no click

### Secondary Sidebar (Left, fixed, 240px)

- Background: Sidebar Deep `#1E293B`
- Module title: 11px / 600 / Slate-400 / uppercase / letter-spacing 0.08em
- Group label: 11px / 500 / Slate-500 / uppercase (non-clickable section header)
- Nav item: 13px / 500 / Slate-300, hover: Slate-100 text + Sidebar Hover bg, rounded-md
- Active item: Slate-100 text + Sky Accent left border 2px + slightly lighter bg
- Count badge (approval queues only): Sky-500 bg, white text, 11px Geist Mono, pill shape

### Topbar

- Background: Surface White `#FFFFFF`
- Height: 52px
- Left: Breadcrumb — `Module / Group / Page` in 14px Geist Sans, Muted Slate separators
- Right: Notification bell (amber dot if pending), User avatar circle (initials), Role chip (tiny, Slate-100 bg)
- Bottom: 1px Whisper Border divider

### Status Chips / Badges

- Shape: `rounded-full`, `px-2.5 py-0.5`
- Font: 11px / 600 / Geist Sans / uppercase
- States with exact colors:
  - Draft: Slate-100 bg / Slate-600 text
  - Awaiting OM: Amber-50 bg / Amber-700 text
  - Awaiting IC: Violet-50 bg / Violet-700 text
  - Awaiting Payment / Awaiting Finance: Sky-50 bg / Sky-700 text
  - Posted / Completed / Approved: Emerald-50 bg / Emerald-700 text
  - Declined / Returned: Red-50 bg / Red-700 text
  - In-Transit: Sky-100 bg / Sky-800 text

### 4-Stage Approval Stepper (the reusable component)

Used on: PO Detail, Stock Adjustment Request Detail  
Layout: Full-width horizontal bar, pinned below topbar/breadcrumb, above content  
Structure:

```
[Stage 1: Submit] ——— [Stage 2: OM Approve] ——— [Stage 3: IC Review] ——— [Stage 4: Finance Post]
```

- Each stage: pill/lozenge shape, 36px height
- Connecting lines: 2px, Whisper Border (incomplete) → Sky-500 (completed path)
- Stage states:
  - Completed: Emerald-500 bg, white text, checkmark icon left
  - Active (current): Sky-500 bg, white text, animated pulse ring
  - Pending: Slate-200 bg, Slate-500 text, lock icon
  - Declined: Red-500 bg, white text, X icon
- Below each stage node: Actor label in 11px Geist Sans Muted Slate (e.g. "Depot Manager", "Ops Manager", "Internal Control", "Finance")
- Timestamp shown below completed stages in 11px Geist Mono Muted Slate
- Container: Surface White bg, 1px Whisper Border bottom, 16px horizontal padding

### Data Tables

- Header row: Canvas bg `#F8FAFC`, 12px / 600 / Geist Sans / Muted Slate / uppercase
- Row height: 52px with comfortable padding
- Row hover: Surface White → very subtle Slate-50 tint
- Row dividers: 1px Whisper Border
- Sortable columns: chevron icon in Slate-400, active sort in Sky-500
- Checkbox column (bulk select): leftmost, 40px wide
- Action column: rightmost, icon buttons (View, Edit, kebab menu) appear on row hover only
- Empty state: centered illustration-free composition — icon + heading + subtext + optional CTA button

### Forms

- Label: 13px / 500 / Charcoal Ink, above input, 6px gap
- Input: Surface White bg, 1px Whisper Border, rounded-md, 40px height
- Focus ring: Sky-500 2px outline
- Helper text: 12px / Muted Slate / below input
- Error text: 12px / Red-500 / below input with error icon
- Required indicator: Red-500 asterisk after label
- Section dividers within long forms: horizontal rule with 14px / 600 label in Slate-600
- Submit button: Sky-500 bg, white text, 40px height, rounded-md

### Approval Action Buttons (inline on detail pages)

- Approve: Emerald-500 bg, white text, `rounded-md`, 36px height
- Decline / Return: Red-50 bg, Red-700 text, outline variant
- Submit for Approval: Sky-500 bg, white text
- Post to Finance: Violet-500 bg, white text
- These buttons render only if the logged-in user has the correct approval-stage authorization. Otherwise hidden (not disabled — absent).

### KPI / Stat Cards (used on Overview pages)

- Container: Surface White, 1px Whisper Border, rounded-xl, 20px padding
- Value: 32px / 700 / Geist Mono / Charcoal Ink
- Label: 13px / 500 / Geist Sans / Muted Slate
- Delta indicator: small arrow icon + percentage in 12px Geist Mono (Emerald for positive, Red for negative)
- Icon accent: 40px circle, Sky-50 bg, Sky-500 icon (or relevant status color)
- Max 4 KPI cards in a row, never equal-width 3-column

### Page Header Block (top of every content page)

- Page title: 24px / 700 / Geist Sans / Charcoal Ink
- Subtitle / description: 14px / 400 / Geist Sans / Muted Slate
- Right side: primary action button(s) (permission-gated)
- Below: filter bar (search input + status filter chips + date range picker if applicable)
- Separator: 1px Whisper Border below the header block

---

## 5. Layout Principles

- **Shell is fixed:** Left rail (64px) + secondary sidebar (240px) are always present. Content area fills remaining width.
- **Content max-width:** 1280px centered within the content area for data-heavy pages; full-bleed tables.
- **Content padding:** 32px top/bottom, 24px left/right within the content canvas
- **Grid:** CSS Grid for page-level layout. Flexbox only for inline component-level alignment.
- **No absolute-positioned stacking** — every element in its own spatial zone
- **Table pages:** Table fills full content width below the page header block
- **Detail pages:** Two-column layout — main content (65%) left, metadata/timeline sidebar (35%) right — below the stepper bar
- **Wizard pages:** Single-column, centered, max-width 640px, step indicator at top

---

## 6. Motion & Interaction

- **Stepper transitions:** 200ms ease-in-out on stage activation. Sky-500 fill expands left-to-right along the connector line when a stage completes.
- **Table row actions:** Icon buttons fade in over 150ms on row hover (opacity 0 → 1).
- **Status chip changes:** 200ms crossfade on status transitions (e.g. "Awaiting OM" → "Awaiting IC").
- **Sidebar expand/collapse:** Not used in this pattern — sidebar is always visible at 240px.
- **Form validation:** Inline error messages slide down 4px with 150ms ease when field blurs with error.
- **Toast notifications:** Slide in from bottom-right, 300ms ease-out. Auto-dismiss at 4s. Emerald for success, Red for error, Amber for warning.
- **Skeleton loaders:** Full-layout skeletons matching exact table/card dimensions. No spinners anywhere.

---

## 7. Anti-Patterns (Banned)

- No `Inter` font anywhere
- No pure black `#000000` — use Charcoal Ink `#0F172A`
- No neon glow shadows or outer glows
- No purple UI accent (Violet is reserved for IC Review status chip only, not structural UI)
- No gradient text on headings
- No 3-column equal-width card grid — use 4 KPIs or 2-column asymmetric layout
- No circular progress spinners — use skeletal loaders
- No emoji in any UI element
- No generic placeholder names ("John Doe", "User 1", "Acme Corp")
- No AI copywriting clichés ("Seamless", "Elevate", "Next-Gen", "Streamline")
- No decorative hero imagery or illustrations in the app shell
- No per-role "dashboards" — one Home screen, permission-driven
- No disabled/greyed nav items for unauthorized screens — they simply don't appear
- No floating labels on inputs — label always above
- No modal confirmation dialogs for non-destructive actions
- No full-page loading screens — skeleton loaders in-situ
