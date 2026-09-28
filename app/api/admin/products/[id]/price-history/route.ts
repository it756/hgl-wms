import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";

/**
 * GET /api/admin/products/[id]/price-history
 *
 * Returns the full price history for a product, most-recent first.
 * Each row was created when Finance approved a Supplier GRN that contained
 * the product; rows are immutable — they are never updated after creation.
 *
 * Auth: ADMIN | WAREHOUSE_MANAGER | FINANCE_MANAGER
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: productId } = await params;

  // Confirm the product exists first so we return 404 rather than an empty array
  // for a non-existent product.
  const { data: product, error: productErr } = await supabaseAdmin
    .from("products")
    .select("id, name, sku")
    .eq("id", productId)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("product_price_history")
    .select(
      `
      id,
      product_id,
      supplier_grn_id,
      supplier_grn_line_item_id,
      source_type,
      unit_cost,
      currency,
      quantity_received,
      effective_at,
      recorded_by,
      created_at,
      supplier_grns (
        reference_number,
        supplier_name,
        date_received
      )
    `,
    )
    .eq("product_id", productId)
    .order("effective_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
