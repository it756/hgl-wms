# API Contracts — hgl-wms

**61 route handlers under `app/api/`.** No middleware — every handler enforces auth/authz inline (see [architecture.md](./architecture.md) for the full request-flow diagram). No schema-validation library is used; request bodies are checked manually per field.

## Authentication (all routes except `external/*`)

```
Authorization: Bearer <supabase-jwt>
```

Obtained client-side via `supabase.auth.signInWithPassword(...)` (`lib/supabaseClient.ts`), stored in `localStorage.access_token`, attached manually per fetch call. Server-side verification is `getUserFromAuthHeader(req)` in `lib/supabaseServer.ts`.

## Response conventions

- Success: `NextResponse.json(data)`
- Error: `NextResponse.json({ error: message }, { status })`
- Status codes in use: `400` (validation), `401` (unauthenticated), `403` (forbidden/role), `409` (conflict/invalid state transition), `422` (missing required relation, e.g. no `sbu_id`), `500` (unexpected/DB error)

## Route groups

| Path prefix                      | Purpose                                                                         | Primary role(s)                                |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `admin/*`                        | Users, SBUs, products, licenses, damage/expiry ledgers, variance, settings CRUD | ADMIN                                          |
| `audit/*`                        | Read audit log entries                                                          | ADMIN (typically)                              |
| `auth/*`                         | session, profile, register, password reset, deactivate                          | All / unauthenticated for reset                |
| `bu/*`                           | BU-scoped staff, stock, units, catalogue, approvals                             | BU_MANAGER, UNIT_STAFF                         |
| `documents/*`                    | Generic file upload/retrieval (Supabase Storage)                                | Various                                        |
| `exports/*`                      | CSV export (transfers)                                                          | ADMIN                                          |
| `external/procurement/[token]/*` | Token-based external partner actions — **not Supabase-authenticated**           | External procurement contacts                  |
| `finance/*`                      | Approval queue for transfers, supplier GRNs, intra-transfers, returns           | FINANCE_MANAGER                                |
| `grns/*`                         | GRN submission (SBU receiving from warehouse)                                   | UNIT_STAFF                                     |
| `issuances/*`                    | Warehouse stock issuance                                                        | WAREHOUSE_MANAGER                              |
| `notifications/*`                | User notification center (list/mark read)                                       | All authenticated                              |
| `purchase-requests/*`            | PR lifecycle (create/list/submit/internal-control approval)                     | BU staff, ADMIN                                |
| `return-requests/*`              | Returns lifecycle (approve/finance-approve/receive)                             | BU_MANAGER, WAREHOUSE_MANAGER, FINANCE_MANAGER |
| `supplier-grns/*`                | Supplier GRN incl. CSV import                                                   | WAREHOUSE_MANAGER                              |
| `support/*`                      | Support/issue tickets                                                           | All authenticated                              |
| `transfer-requests/*`            | Inter-unit/SBU transfer CRUD                                                    | BU_MANAGER, UNIT_STAFF                         |
| `warehouse/*`                    | Stats, intra-warehouse transfers, losses                                        | WAREHOUSE_MANAGER                              |

## External (tokenized, non-login) API

`app/api/external/procurement/[token]/route.ts` (GET — redacted view) and `.../action/route.ts` (POST — approve/reject/request-changes). Backed by `lib/services/externalTokenService.ts`:

- Random 48-byte token generated, only its SHA-256 hash persisted (`external_action_tokens`); raw token is emailed once, never stored.
- Scoped to `entityType` + `entityId` + `actorEmail` + `allowedActions`, 7-day expiry.
- Single-use via compare-and-swap (`is("used_at", null)`) for APPROVE/REJECT; `CHANGES_REQUESTED` stays reusable.
- Audit entries from external actions have `performed_by: undefined` (no `auth.users` id exists for the actor).

## OpenAPI

`docs/openapi/openapi.json` is the source of truth for generated types (`npm run openapi:types` → `lib/api/openapi-types.ts`); `openapi:check` in `ui.yml` CI fails the build if generated types drift from the spec. Update the spec alongside any route contract change.

## Known gap

`lib/rbac.ts` (`hasRole`, `hasAnyRole`, `isAdmin`, etc.) is unused by any route handler — role checks are inline string comparisons repeated per route instead. Worth knowing before assuming a change to `rbac.ts` affects live authorization.
