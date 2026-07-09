# Data Models — hgl-wms

Schema source of truth: `supabase/migrations/*.sql` (29 files, `000_initial_schema.sql` → `028_license_management.sql`). TypeScript mirrors: `lib/models/*.ts`.

## Core entities

Everything hangs off Supabase Auth's `auth.users` via `public.profiles`.

| Entity                                                                      | Purpose                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                                                  | Extends `auth.users`. `role` (ADMIN/BU_MANAGER/WAREHOUSE_MANAGER/UNIT_STAFF/FINANCE_MANAGER), `sbu_id`, `unit_id`, plus license fields (`028`).                                     |
| `sbus` / `sbu_units`                                                        | Strategic Business Units and their sub-departments (`007`) — units are where staff/transfer requests originate.                                                                     |
| `products`                                                                  | Warehouse catalogue: `stock_quantity`, `low_stock_threshold`, `unit_cost`, `warehouse_location` (`011`), `expiry_date` (`013`).                                                     |
| `transfer_requests` + `transfer_line_items`                                 | Core SBU→warehouse stock request. `status`, dual approval columns (BU Manager + Finance), `requires_finance_approval`, `estimated_value`.                                           |
| `issuances` + `issuance_line_items`                                         | Warehouse's fulfillment of a transfer request; may have shortfalls (`shortfall_reason`).                                                                                            |
| `grns` + `grn_line_items`                                                   | SBU-side confirmation of what arrived vs. what was issued; `has_variance`.                                                                                                          |
| `supplier_grns` + `supplier_grn_line_items`                                 | Warehouse Manager's receipt from **external suppliers** (distinct from `grns`). Finance-gated (`status`); can tag an `sbu_id` for direct-to-SBU stock; batch `expiry_date` (`013`). |
| `return_requests` + `return_line_items`                                     | SBU returns to warehouse (`005`); BU Manager then (from `014`) Finance approval before stock is restored.                                                                           |
| `purchase_requests` + `purchase_request_line_items`                         | Pre-procurement workflow (`023`): SBU → external Procurement (via token link) → Internal Control → supplier GRN.                                                                    |
| `external_action_tokens`                                                    | Secure token-based external approval links (procurement).                                                                                                                           |
| `variance_proposals` (`009`)                                                | Finance-reviewed variance reconciliation with per-line disposition (stock write-back vs. `damage_ledger`).                                                                          |
| `variance_dispositions` + `stock_losses` (`012`)                            | An earlier, simpler variance mechanism — BU-Manager-decided WRITE_BACK/LOSS. **Overlaps with `variance_proposals`; check which one a request means.**                               |
| `damage_ledger` (`009`, extended `017`)                                     | Permanent write-off ledger; `source_type` distinguishes variance-sourced vs. `direct_writeoff`.                                                                                     |
| `damage_recalls` (`010`)                                                    | Tracks physical transit of already-written-off goods back to the warehouse (logistics only, no stock restoration).                                                                  |
| `expiry_ledger` (`015`)                                                     | Permanent loss ledger for expired stock, with financial snapshot (`unit_cost_at_expiry`, `value_expired`).                                                                          |
| `intra_warehouse_transfers` (`016`, Finance-gated from `022`)               | Single-step stock ownership reassignment between SBUs, bypassing the full transfer-request lifecycle.                                                                               |
| `transaction_documents` (`008`)                                             | Polymorphic file attachment table (Supabase Storage), keyed by `(transaction_type, transaction_id)`.                                                                                |
| `notifications` / `audit_logs`                                              | In-app notifications; immutable audit trail (`previous_value`/`new_value` JSONB).                                                                                                   |
| `license_audit_log` (`028`)                                                 | History of staff license ASSIGNED/UPDATED/REVOKED, paired with `profiles.licensed`/`license_type`/`license_expires_at`.                                                             |
| `sbu_stock`                                                                 | **A view, not a table** — iteratively redefined `019`→`022`: issued − returned, then + supplier-GRN-seeded stock, then SKU-prefix-tagged stock, then intra-transfer movements.      |
| `app_settings` / `sbu_settings` / `sbus.finance_approval_threshold` (`027`) | Global vs. per-SBU configurable Finance approval thresholds.                                                                                                                        |

## Status / state machines

- **TransferRequest**: `PENDING_BU_APPROVAL → PENDING/PENDING_APPROVAL → APPROVED_FOR_ISSUE → ISSUED → COMPLETED | COMPLETED_WITH_VARIANCE`, or `CANCELLED`.
- **SupplierGRN**: `AWAITING_FINANCE_APPROVAL → GRN_APPROVED | GRN_REJECTED`.
- **ReturnRequest**: `PENDING_APPROVAL → APPROVED → AWAITING_FINANCE_APPROVAL → STOCK_RESTORED`, or `REJECTED` (legacy `RECEIVED` kept for old rows).
- **PurchaseRequest**: `DRAFT → PENDING_PROCUREMENT_APPROVAL → (PROCUREMENT_CHANGES_REQUESTED) → PENDING_INTERNAL_CONTROL_APPROVAL → APPROVED_FOR_PURCHASE → EXPECTED_ORDER → PARTIALLY_RECEIVED → RECEIVED`, with `CANCELLED`/`REJECTED`/`INTERNAL_CONTROL_REJECTED` branches.
- **IntraWarehouseTransfer**: `PENDING → PENDING_FINANCE_APPROVAL → COMPLETED | CANCELLED`.
- **DamageRecall**: `PENDING → IN_TRANSIT → RECEIVED`.
- **VarianceProposal**: `PENDING_FINANCE_REVIEW → ...` (approve/reject, executes atomically).

## Stock-movement / atomic SQL functions

Postgres RPCs (called via Supabase `.rpc()`), row-locking (`FOR UPDATE`), raise exceptions on invalid state:

- `decrement_stock` / `decrement_stock_batch` (`001`, `004`)
- `process_issuance` (`002`) — issuance + stock decrement + transfer-status validation in one transaction
- `increment_stock_after_grn` (`003`, bugfixed in `025` for correct table refs + idempotency)
- `process_variance_disposition` (`012`)
- `process_intra_transfer` (`016`)
- `create_transfer_request_atomic` and related RPCs (`024_atomic_core_workflows.sql`) — `SECURITY DEFINER` wrappers for multi-table writes

## Row-Level Security

Enabled repo-wide, but the app always connects via the service-role key (bypasses RLS) — RLS here is defense-in-depth, not the primary access gate (that's the per-route role check, see `architecture.md`). `000` enabled RLS as deny-all stubs; `010`/`015`/`016`/`017` added real policies for new tables; `024_enable_missing_rls.sql` and `026_rls_policies_for_gap_tables.sql` retroactively closed gaps for tables that had been missed.

## Migration history (chronological)

Base schema (`000`) → atomic stock RPCs (`001`–`004`) → returns workflow (`005`) → unit-staff request/BU-approval flow (`006`) → formalized SBU units (`007`) → file attachments (`008`) → variance-proposal reconciliation + damage ledger (`009`) → damage recall tracking (`010`) → warehouse bin locations (`011`) → simpler variance disposition/stock-loss ledger (`012`) → expiry dates + WhatsApp notifications (`013`) → Finance gate on returns (`014`) → expiry write-off ledger (`015`) → intra-warehouse transfers (`016`) → direct damage write-offs (`017`) → bugfix (`018`) → `sbu_stock` view introduced and refined (`019`–`022`, incl. Finance approval on intra-transfers at `022`) → purchase request/procurement workflow (`023`) → atomic core-workflow RPCs + RLS gap-closing (`024` ×2) → GRN RPC bugfix (`025`) → RLS policies for gap tables (`026`) → per-SBU finance threshold (`027`) → license management (`028`).
