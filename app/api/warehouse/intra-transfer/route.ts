import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { createNotification } from "../../../../lib/services/notificationService";

function generateIntraTransferReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `IWT-${year}-${seq}`;
}

/**
 * POST /api/warehouse/intra-transfer
 *  Creates a direct intra-warehouse asset reassignment.
 *  Decrements warehouse stock and inserts a row in intra_warehouse_transfers
 *  (status = COMPLETED) atomically via process_intra_transfer RPC.
 *
 *  Body: { product_id, quantity, to_sbu_id, from_sbu_id?, notes? }
 *  Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { product_id, quantity, to_sbu_id, from_sbu_id, notes } = body as {
    product_id?: string;
    quantity?: number;
    to_sbu_id?: string;
    from_sbu_id?: string | null;
    notes?: string;
  };

  if (!product_id || !to_sbu_id) {
    return NextResponse.json({ error: "product_id and to_sbu_id are required" }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  const reference_number = generateIntraTransferReference();

  const { data: rpcId, error: rpcError } = await supabaseAdmin.rpc("process_intra_transfer", {
    p_reference_number: reference_number,
    p_product_id: product_id,
    p_quantity: qty,
    p_from_sbu_id: from_sbu_id ?? null,
    p_to_sbu_id: to_sbu_id,
    p_transferred_by: user.id,
    p_notes: notes ?? null,
  });

  if (rpcError) {
    console.error("process_intra_transfer RPC failed", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  // Notify BU Manager of the receiving SBU
  try {
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("name, sku")
      .eq("id", product_id)
      .single();
    const productLabel = prod ? `${(prod as any).name} (${(prod as any).sku})` : "product";

    await createNotification({
      user_role: "BU_MANAGER",
      type: "intra_transfer_completed",
      message: `Intra-warehouse transfer ${reference_number}: ${qty} of ${productLabel} assigned to your SBU`,
      related_entity_id: rpcId as string,
    });
  } catch (e) {
    console.error("intra-transfer notify failed", e);
  }

  return NextResponse.json({ id: rpcId, reference_number }, { status: 201 });
}

/**
 * GET /api/warehouse/intra-transfer
 *  List intra-warehouse transfers, scoped by role.
 *  WAREHOUSE_MANAGER / FINANCE_MANAGER / ADMIN → all
 *  BU_MANAGER / UNIT_STAFF → those targeting their SBU
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (
    !["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "BU_MANAGER", "UNIT_STAFF", "ADMIN"].includes(role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("intra_warehouse_transfers")
    .select(
      `id, reference_number, product_id, quantity, from_sbu_id, to_sbu_id,
       transfer_date, status, notes, transferred_by, created_at, updated_at,
       products ( id, name, sku, unit_of_measure ),
       to_sbu:sbus!intra_warehouse_transfers_to_sbu_id_fkey ( id, name, code ),
       from_sbu:sbus!intra_warehouse_transfers_from_sbu_id_fkey ( id, name, code )`,
    )
    .order("created_at", { ascending: false });

  if (role === "BU_MANAGER" || role === "UNIT_STAFF") {
    const sbu_id = (user.user_metadata as any)?.sbu_id ?? null;
    if (!sbu_id) return NextResponse.json([], { status: 200 });
    query = query.eq("to_sbu_id", sbu_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
