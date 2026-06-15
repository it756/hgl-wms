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
 *  Submits an intra-warehouse asset reassignment for Finance approval.
 *  Inserts a row with status = PENDING_FINANCE_APPROVAL and notifies Finance Manager.
 *  Stock is not decremented until Finance approves via /api/finance/approvals.
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

  // Early availability check — gives the user immediate feedback.
  // The authoritative check runs inside the approve_intra_transfer RPC at approval time.
  if (!from_sbu_id) {
    const { data: product, error: stockError } = await supabaseAdmin
      .from("products")
      .select("name, stock_quantity")
      .eq("id", product_id)
      .single();

    if (stockError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if ((product as any).stock_quantity < qty) {
      return NextResponse.json(
        {
          error: `Insufficient warehouse stock for "${(product as any).name}": available ${(product as any).stock_quantity}, requested ${qty}`,
        },
        { status: 400 },
      );
    }
  }

  const reference_number = generateIntraTransferReference();

  const { data: row, error: insertError } = await supabaseAdmin
    .from("intra_warehouse_transfers")
    .insert({
      reference_number,
      product_id,
      quantity: qty,
      from_sbu_id: from_sbu_id ?? null,
      to_sbu_id,
      transferred_by: user.id,
      status: "PENDING_FINANCE_APPROVAL",
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("intra-transfer insert failed", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const transferId = (row as any).id as string;

  // Notify Finance Manager to review the pending transfer
  try {
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("name, sku")
      .eq("id", product_id)
      .single();
    const productLabel = prod ? `${(prod as any).name} (${(prod as any).sku})` : "product";

    await createNotification({
      user_role: "FINANCE_MANAGER",
      type: "intra_transfer_pending_approval",
      message: `Intra-warehouse transfer ${reference_number}: ${qty} of ${productLabel} requires your approval`,
      related_entity_id: transferId,
      dispatchChannels: true,
    });
  } catch (e) {
    console.error("intra-transfer notify failed", e);
  }

  return NextResponse.json(
    { id: transferId, reference_number, status: "PENDING_FINANCE_APPROVAL" },
    { status: 201 },
  );
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
