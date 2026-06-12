import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../../lib/services/auditService";
import { createNotification } from "../../../../../../lib/services/notificationService";

function generateExpiryReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `EXP-${year}-${seq}`;
}

/**
 * POST /api/admin/products/[id]/expire-batch
 *  Move expired stock to the expiry_ledger and decrement products.stock_quantity.
 *
 *  Body: { quantity_expired, expiry_date?, supplier_grn_line_item_id?, unit_cost?, notes? }
 *  Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const { id: productId } = await params;
  const body = await req.json().catch(() => ({}));
  const { quantity_expired, expiry_date, supplier_grn_line_item_id, unit_cost, notes } = body as {
    quantity_expired?: number;
    expiry_date?: string;
    supplier_grn_line_item_id?: string;
    unit_cost?: number;
    notes?: string;
  };

  const qty = Number(quantity_expired);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json(
      { error: "quantity_expired must be a positive number" },
      { status: 400 },
    );
  }

  // Lock product row (best-effort via two-step in JS — the unique decrement here
  // is gated by a stock check; concurrent writes are protected by the conditional update).
  const { data: product, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, stock_quantity, unit_cost")
    .eq("id", productId)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const stock = (product as any).stock_quantity as number;
  if (stock < qty) {
    return NextResponse.json(
      { error: `Insufficient stock (available: ${stock}, requested: ${qty})` },
      { status: 409 },
    );
  }

  const resolvedUnitCost =
    typeof unit_cost === "number" && Number.isFinite(unit_cost)
      ? unit_cost
      : Number((product as any).unit_cost ?? 0);

  // Conditional decrement to guard against concurrent updates
  const { error: decErr } = await supabaseAdmin
    .from("products")
    .update({ stock_quantity: stock - qty, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("stock_quantity", stock);

  if (decErr) {
    console.error(decErr);
    return NextResponse.json({ error: decErr.message }, { status: 500 });
  }

  const reference_number = generateExpiryReference();

  const { data: ledger, error: ledgerErr } = await supabaseAdmin
    .from("expiry_ledger")
    .insert([
      {
        reference_number,
        product_id: productId,
        supplier_grn_line_item_id: supplier_grn_line_item_id ?? null,
        quantity_expired: qty,
        expiry_date: expiry_date ?? null,
        unit_cost_at_expiry: resolvedUnitCost,
        value_expired: qty * resolvedUnitCost,
        currency: "ZMW",
        expired_by: user.id,
        notes: notes ?? null,
      },
    ])
    .select()
    .single();

  if (ledgerErr) {
    // Best-effort rollback of stock decrement
    await supabaseAdmin
      .from("products")
      .update({ stock_quantity: stock, updated_at: new Date().toISOString() })
      .eq("id", productId);
    console.error(ledgerErr);
    return NextResponse.json({ error: ledgerErr.message }, { status: 500 });
  }

  const ledgerId = (ledger as any).id;

  await writeAuditLog({
    entity_type: "expiry_ledger",
    entity_id: ledgerId,
    action: "create",
    performed_by: user.id,
    new_value: {
      reference_number,
      product_id: productId,
      quantity_expired: qty,
      expiry_date,
      unit_cost_at_expiry: resolvedUnitCost,
    },
  });

  await Promise.all([
    createNotification({
      user_role: "ADMIN",
      type: "stock_expired",
      message: `Expiry write-off ${reference_number}: ${qty} units of ${(product as any).name} (${(product as any).sku}) expired`,
      related_entity_id: ledgerId,
    }),
    createNotification({
      user_role: "FINANCE_MANAGER",
      type: "stock_expired",
      message: `Expiry write-off ${reference_number}: ${qty} units of ${(product as any).name} expired (value loss recorded)`,
      related_entity_id: ledgerId,
    }),
  ]);

  return NextResponse.json(
    {
      expiry_ledger_id: ledgerId,
      reference_number,
      quantity_expired: qty,
      new_stock_quantity: stock - qty,
    },
    { status: 201 },
  );
}
