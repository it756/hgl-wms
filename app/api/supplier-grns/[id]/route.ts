import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

interface AtomicSupplierGrnUpdateResult {
  id: string;
  reference_number: string;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden")) return 403;
  if (message.includes("awaiting Finance approval")) return 422;
  if (message.includes("required") || message.includes("at least one")) return 400;
  return 500;
}

/** GET /api/supplier-grns/[id] — single GRN with line items + product info */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("supplier_grns")
    .select(
      `*, supplier_grn_line_items(
        id, product_id, quantity_received, unit_cost, expiry_date,
        products(id, name, sku, unit_of_measure, unit_cost)
      )`,
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/supplier-grns/[id] — update a GRN that is still AWAITING_FINANCE_APPROVAL */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "WAREHOUSE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    supplier_name,
    supplier_invoice_reference,
    invoice_amount,
    date_received,
    sbu_id,
    items,
  } = body;

  if (!supplier_name || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "supplier_name and at least one line item are required" },
      { status: 400 },
    );
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc("update_supplier_grn_atomic", {
    p_grn_id: id,
    p_actor_id: user.id,
    p_supplier_name: supplier_name,
    p_supplier_invoice_reference: supplier_invoice_reference ?? null,
    p_invoice_amount: invoice_amount ?? null,
    p_date_received: date_received ?? null,
    p_sbu_id: sbu_id ?? null,
    p_items: items,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: statusForRpcError(rpcError.message) },
    );
  }

  const updated = data as AtomicSupplierGrnUpdateResult;

  return NextResponse.json({ id: updated.id, reference_number: updated.reference_number });
}
