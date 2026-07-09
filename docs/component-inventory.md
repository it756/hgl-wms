# Component Inventory — hgl-wms

There is **no design-system/atoms library** (no `Button`/`Input`/`Card` primitives, no shadcn/ui, no CVA). Pages build UI inline with Tailwind utility classes against the design tokens in `app/globals.css`. The only shared components live at repo-root `components/` (aliased `@/components/*`):

| Component                 | Purpose                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthGuard.tsx`           | Rendered once in `app/layout.tsx`. Monkey-patches `window.fetch` to detect any `401` from a `/api/` call, clears `localStorage`, and redirects to `/` (login). This is the only centralized auth enforcement on the client. |
| `DashboardLayout.tsx`     | Main navigation shell — sidebar, notifications bell, avatar/account menu. Imported per-page by authenticated route pages.                                                                                                   |
| `DamageWriteOffModal.tsx` | Modal for recording a direct damage write-off (feeds `damage_ledger`).                                                                                                                                                      |
| `DocumentUpload.tsx`      | File upload widget backed by `app/api/documents/` (Supabase Storage).                                                                                                                                                       |

## Styling system

- Tailwind CSS v4, imported via `@import "tailwindcss"` in `app/globals.css`.
- Design tokens defined in a Tailwind v4 `@theme` block using Material-Design-3-style semantic names: `--color-primary`, `--color-surface-container-high`, `--color-on-surface-variant`, etc., plus `--radius-xl`.
- Fonts: Geist Sans/Mono via `next/font/google` in `app/layout.tsx`.
- Icons: `lucide-react`.

## Implication for new UI work

Since there's no shared primitive library, new pages currently copy patterns from existing pages rather than importing components. If a feature needs a new reusable widget (e.g. a data table, a status badge), check `app/warehouse/queue`, `app/finance/queue`, or `app/requests` first for an existing inline pattern to match, rather than assuming a component to import already exists.
