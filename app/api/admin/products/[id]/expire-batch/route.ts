import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { createNotification } from "../../../../../../lib/services/notificationService";

interface ExpireBatchResult {
  expiry_ledger_id: string;
  reference_number: string;
  quantity_expired: number;
  new_stock_quantity: number;
  product_name: string;
  product_sku: string;
}

function generateExpiryReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `EXP-${year}-${seq}`;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden")) return 403;
  if (message.includes("insufficient stock")) return 409;
  if (message.includes("positive") || message.includes("required")) return 400;
  return 500;
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

  const reference_number = generateExpiryReference();

  const { data, error: rpcError } = await supabaseAdmin.rpc("expire_product_batch_atomic", {
    p_product_id: productId,
    p_actor_id: user.id,
    p_reference_number: reference_number,
    p_quantity_expired: qty,
    p_expiry_date: expiry_date ?? null,
    p_supplier_grn_line_item_id: supplier_grn_line_item_id ?? null,
    p_unit_cost: typeof unit_cost === "number" && Number.isFinite(unit_cost) ? unit_cost : null,
    p_notes: notes ?? null,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: statusForRpcError(rpcError.message) },
    );
  }

  const result = data as ExpireBatchResult;
  const ledgerId = result.expiry_ledger_id;

  await Promise.all([
    createNotification({
      user_role: "ADMIN",
      type: "stock_expired",
      message: `Expiry write-off ${result.reference_number}: ${qty} units of ${result.product_name} (${result.product_sku}) expired`,
      related_entity_id: ledgerId,
    }),
    createNotification({
      user_role: "FINANCE_MANAGER",
      type: "stock_expired",
      message: `Expiry write-off ${result.reference_number}: ${qty} units of ${result.product_name} expired (value loss recorded)`,
      related_entity_id: ledgerId,
    }),
  ]);

  return NextResponse.json(
    {
      expiry_ledger_id: ledgerId,
      reference_number: result.reference_number,
      quantity_expired: qty,
      new_stock_quantity: result.new_stock_quantity,
    },
    { status: 201 },
  );
}
