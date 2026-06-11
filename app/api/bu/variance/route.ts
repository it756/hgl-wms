import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/bu/variance
 * BU Manager: list their SBU's COMPLETED_WITH_VARIANCE transfers
 * with full GRN line detail (issued qty, received qty, variance notes, product info).
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["BU_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sbuId = (user.user_metadata as any)?.sbu_id ?? null;
  // BU_MANAGER must be scoped to their SBU; ADMIN sees all
  if (role === "BU_MANAGER" && !sbuId) {
    return NextResponse.json({ error: "No SBU assigned to this account" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("transfer_requests")
    .select(
      `id, reference_number, sbu_id, notes, estimated_value, created_at, updated_at,
       sbus ( id, name, code ),
       grns (
         id, has_variance, condition_notes, date_received, created_at,
         grn_line_items (
           id, product_id, issued_quantity, quantity_received, variance_notes,
           products ( id, name, sku, unit_of_measure, unit_cost )
         )
       )`,
    )
    .eq("status", "COMPLETED_WITH_VARIANCE")
    .order("updated_at", { ascending: false });

  if (role === "BU_MANAGER") {
    query = query.eq("sbu_id", sbuId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
