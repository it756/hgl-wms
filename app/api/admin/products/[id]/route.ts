import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";

/** PATCH /api/admin/products/[id] — edit product or adjust stock */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Distinguish a stock-adjustment payload from a product-edit payload
  if (body.adjustment_type !== undefined) {
    const { adjustment_type, quantity, reason } = body;
    if (!["add", "remove"].includes(adjustment_type) || !quantity || !reason) {
      return NextResponse.json(
        { error: "adjustment_type (add|remove), quantity, and reason are required" },
        { status: 400 },
      );
    }

    const delta = adjustment_type === "add" ? Number(quantity) : -Number(quantity);

    const { data: product, error: fetchErr } = await supabaseAdmin
      .from("products")
      .select("stock_quantity")
      .eq("id", id)
      .single();

    if (fetchErr || !product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const newQty = product.stock_quantity + delta;
    if (newQty < 0) {
      return NextResponse.json({ error: "Insufficient stock for removal" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      entity_type: "product",
      entity_id: id,
      action: `stock_${adjustment_type}`,
      performed_by: user.id,
      details: { delta, reason, previous: product.stock_quantity, new: newQty },
    });

    return NextResponse.json(data);
  }

  // Regular product field update
  const { name, sku, description, unit_of_measure, low_stock_threshold, unit_cost, is_active } =
    body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (sku !== undefined) updates.sku = sku;
  if (description !== undefined) updates.description = description;
  if (unit_of_measure !== undefined) updates.unit_of_measure = unit_of_measure;
  if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold;
  if (unit_cost !== undefined) updates.unit_cost = unit_cost;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
