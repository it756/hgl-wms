import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/warehouse/losses
 * WAREHOUSE_MANAGER | ADMIN: read the stock-loss ledger.
 *
 * Sourced from `damage_ledger` entries with source_type = 'variance_proposal' —
 * i.e. shortages that a Finance Manager wrote off via the variance proposal flow
 * (see supabase/migrations/009_variance_proposals.sql, execute_variance_resolution).
 * The legacy `stock_losses` table (populated by the now-retired BU Manager
 * disposition flow) is no longer written to and is kept only for historical audit.
 *
 * Optional query params:
 *   ?sbu_id=<uuid>      — filter by SBU
 *   ?product_id=<uuid>  — filter by product
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filterSbu = url.searchParams.get("sbu_id");
  const filterProduct = url.searchParams.get("product_id");

  let query = supabaseAdmin
    .from("damage_ledger")
    .select(
      `id, quantity, unit_cost_at_writeoff, estimated_value, writeoff_reason,
       transfer_reference, written_off_at, product_id,
       products ( id, name, sku, unit_of_measure ),
       variance_proposal_lines (
         id,
         variance_proposals (
           id, transfer_request_id,
           transfer_requests ( id, reference_number, sbu_id, sbus ( id, name, code ) )
         )
       )`,
    )
    .eq("source_type", "variance_proposal")
    .order("written_off_at", { ascending: false });

  if (filterProduct) query = query.eq("product_id", filterProduct);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the nested proposal → transfer chain into the shape the Loss Account
  // page expects (mirrors the retired stock_losses row shape for continuity).
  let losses = (data ?? []).map((row: any) => {
    const transfer = row.variance_proposal_lines?.variance_proposals?.transfer_requests ?? null;
    return {
      id: row.id,
      reference_number: row.transfer_reference ?? transfer?.reference_number ?? row.id,
      quantity_lost: row.quantity,
      unit_cost_at_loss: row.unit_cost_at_writeoff,
      value_lost: row.estimated_value,
      decided_at: row.written_off_at,
      reason_notes: row.writeoff_reason,
      created_at: row.written_off_at,
      product_id: row.product_id,
      sbu_id: transfer?.sbu_id ?? null,
      transfer_request_id: transfer?.id ?? null,
      products: row.products ?? null,
      sbus: transfer?.sbus ?? null,
      transfer_requests: transfer ? { id: transfer.id, reference_number: transfer.reference_number } : null,
    };
  });

  if (filterSbu) losses = losses.filter((l) => l.sbu_id === filterSbu);

  return NextResponse.json(losses);
}
