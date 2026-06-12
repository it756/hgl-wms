import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/admin/expiry-ledger
 *  Returns expiry_ledger entries with product details and resolved user names.
 *  Auth: ADMIN | WAREHOUSE_MANAGER | FINANCE_MANAGER
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id");
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  let query = supabaseAdmin
    .from("expiry_ledger")
    .select(
      `id, reference_number, product_id, supplier_grn_line_item_id,
       quantity_expired, expiry_date, unit_cost_at_expiry, value_expired,
       currency, expired_by, expired_at, notes,
       products ( id, name, sku, unit_of_measure )`,
    )
    .order("expired_at", { ascending: false });

  if (productId) query = query.eq("product_id", productId);
  if (fromDate) query = query.gte("expired_at", fromDate);
  if (toDate) query = query.lte("expired_at", toDate);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r: any) => r.expired_by).filter(Boolean))];

  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name ?? ""]));
    }
  }

  const enriched = rows.map((r: any) => ({
    ...r,
    expired_by_name: profileMap[r.expired_by] ?? null,
  }));

  return NextResponse.json(enriched);
}
