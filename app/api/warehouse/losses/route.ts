import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/warehouse/losses
 * WAREHOUSE_MANAGER | ADMIN: read the full stock loss ledger.
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
    .from("stock_losses")
    .select(
      `id, reference_number, quantity_lost, unit_cost_at_loss, value_lost,
       decided_at, reason_notes, created_at,
       product_id, sbu_id, transfer_request_id, grn_id, decided_by,
       products ( id, name, sku, unit_of_measure ),
       sbus ( id, name, code ),
       transfer_requests ( id, reference_number )`,
    )
    .order("created_at", { ascending: false });

  if (filterSbu) query = query.eq("sbu_id", filterSbu);
  if (filterProduct) query = query.eq("product_id", filterProduct);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
