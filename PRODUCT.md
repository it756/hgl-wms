# Product

## Register

product

## Users

Five internal, role-scoped users — Administrator, Business Unit (BU) Manager, Warehouse Manager, Unit Staff, and Finance Manager — plus a sixth, non-logged-in external procurement contact who acts via a one-time emailed link. Daily operational users doing repetitive, accountability-heavy tasks (raise/approve/issue/confirm stock movements, approvals, GRNs), not casual visitors. Usage frequency varies sharply by role: Warehouse Manager and Finance Manager are in the system continuously through the day; Unit Staff and BU Manager touch it in bursts around specific transfers; the external procurement contact uses it once per purchase request via a link, with no account and no prior context.

## Product Purpose

Harvest WMS replaces spreadsheet/email/phone-call coordination of warehouse-to-SBU stock movement with a single, auditable, role-based digital workflow (request → finance approval → issue → GRN confirm), plus supplier receipt, returns, procurement, staff licensing, expiry/damage tracking, and intra-warehouse transfers. Success is a complete, trustworthy record of who did what and when for every stock movement, with each role able to act on exactly what's relevant to them and nothing more.

## Brand Personality

Precise, trustworthy, efficient. Enterprise-SaaS register (per `docs/stitch-ui-prompt.md`) — clean, professional, high data density without feeling cluttered. Not playful or consumer-flashy; every visual choice should reinforce that this system is a system of record, not a convenience tool.

## Anti-references

None named explicitly. Inferred from the brand personality and register: avoid consumer-app/gamified aesthetics (confetti, badges, playful illustration, casual copy) that would undercut the accountability-first, audit-grade tone. Avoid generic SaaS-cream/gradient-hero marketing tropes — this is pure product register, not brand/landing.

## Design Principles

- **Accountability is always visible.** Status, approver, and audit trail are never buried — every screen that represents a stateful record (transfer, GRN, approval) should surface who acted, when, and what's pending, not just the current value.
- **Match density to role frequency.** Daily power-user roles (Warehouse Manager, Finance Manager) get dense, fast, low-click surfaces (queues, tables, bulk actions). Infrequent-use flows (Unit Staff GRN submission, the external procurement portal) get more guided, lower-training-overhead treatment — confirmation steps, inline help, fewer simultaneous decisions.
- **No feature outside its role's remit.** Reinforce RBAC visually as well as functionally — a role should never see a control it can't use; don't design generic screens and hide buttons with CSS.
- **Identity-preservation over reinvention.** `app/globals.css` already commits to a teal/amber MD3-style token system (`--color-primary: #005c55`, `--color-secondary-container: #fe932c`, Inter) — new design work builds on these tokens rather than introducing a new palette.
- **The external portal is a first impression, not an afterthought.** The one surface a non-employee sees (tokenized procurement links) should be as polished and self-explanatory as the internal app, since it has zero onboarding and no account to fall back on.

## Accessibility & Inclusion

WCAG 2.1 AA baseline: contrast ratios (≥4.5:1 body text, ≥3:1 large text), full keyboard navigation, visible focus states, `prefers-reduced-motion` support. No additional specific user needs identified beyond this baseline; revisit if a known accommodation need surfaces.
