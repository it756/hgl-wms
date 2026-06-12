import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";

/**
 * POST /api/admin/products/[id]/damage-writeoff
 *  Direct damage write-off from the product catalogue (no variance proposal needed).
 *  Atomically decrements stock and inserts a damage_ledger row with
 *  source_type = 'direct_writeoff'.
 *
 *  Body: { quantity, reason, notes? }
 *  Auth: WAREHOUSE_MANAGER | ADMIN | FINANCE_MANAGER
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json(
      { error: "Forbidden: Warehouse Manager, Finance Manager, or Admin only" },
      { status: 403 },
    );
  }

  const { id: productId } = await params;
  const body = await req.json().catch(() => ({}));
  const { quantity, reason, notes } = body as {
    quantity?: number;
    reason?: string;
    notes?: string;
  };

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  // Atomic operation via RPC (locks product row, validates stock, inserts ledger row)
  const { data: ledgerId, error: rpcError } = await supabaseAdmin.rpc(
    "process_direct_damage_writeoff",
    {
      p_product_id: productId,
      p_quantity: qty,
      p_reason: reason.trim(),
      p_written_off_by: user.id,
      p_notes: notes ?? null,
    },
  );

  if (rpcError) {
    console.error("process_direct_damage_writeoff RPC failed", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  // Read back the new stock for the response and notification context
  const { data: prod } = await supabaseAdmin
    .from("products")
    .select("stock_quantity, name, sku")
    .eq("id", productId)
    .single();

  // Notify Admin + Finance Manager
  try {
    await supabaseAdmin.from("notifications").insert([
      {
        related_entity_id: ledgerId as string,
        type: "damage_writeoff",
        message: `Damage write-off: ${qty} units of ${(prod as any)?.name ?? productId} (${(prod as any)?.sku ?? ""}) — ${reason}`,
        user_role: "ADMIN",
      },
      {
        related_entity_id: ledgerId as string,
        type: "damage_writeoff",
        message: `Damage write-off recorded: ${qty} units of ${(prod as any)?.name ?? productId}`,
        user_role: "FINANCE_MANAGER",
      },
    ]);
  } catch (e) {
    console.error("damage write-off notify failed", e);
  }

  return NextResponse.json(
    {
      damage_ledger_id: ledgerId,
      new_stock_quantity: (prod as any)?.stock_quantity ?? null,
    },
    { status: 201 },
  );
}
