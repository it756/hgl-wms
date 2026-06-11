import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/admin/variance
 * Admin read-only registry — lists all COMPLETED_WITH_VARIANCE transfers
 * with GRN line detail and product information.
 * Access: ADMIN | WAREHOUSE_MANAGER
 *
 * NOTE: Variance resolution (disposition) is now handled by BU Managers via
 *       POST /api/bu/variance/[id]/disposition
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("transfer_requests")
    .select(
      `id, reference_number, sbu_id, created_at, updated_at,
       grns (
         id, has_variance, condition_notes, created_at,
         grn_line_items (
           id, product_id, issued_quantity, quantity_received, variance_notes,
           products ( id, name, sku, unit_cost )
         )
       )`,
    )
    .eq("status", "COMPLETED_WITH_VARIANCE")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
