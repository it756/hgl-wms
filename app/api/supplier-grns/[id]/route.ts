import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";

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
        id, product_id, quantity_received, unit_cost,
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

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("supplier_grns")
    .select("id, status, reference_number")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "GRN not found" }, { status: 404 });
  }
  if ((existing as any).status !== "AWAITING_FINANCE_APPROVAL") {
    return NextResponse.json(
      { error: "Only GRNs awaiting Finance approval can be edited." },
      { status: 422 },
    );
  }

  const body = await req.json();
  const { supplier_name, supplier_invoice_reference, invoice_amount, date_received, sbu_id, items } =
    body;

  if (!supplier_name || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "supplier_name and at least one line item are required" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("supplier_grns")
    .update({
      supplier_name,
      supplier_invoice_reference: supplier_invoice_reference ?? null,
      invoice_amount: invoice_amount ?? null,
      date_received,
      sbu_id: sbu_id ?? null,
    })
    .eq("id", id);

  if (updateError) throw updateError;

  // Replace line items
  await supabaseAdmin.from("supplier_grn_line_items").delete().eq("supplier_grn_id", id);

  const lineInserts = items.map((item: any) => ({
    supplier_grn_id: id,
    product_id: item.product_id,
    quantity_received: item.quantity_received,
    unit_cost: item.unit_cost ?? null,
  }));

  const { error: liError } = await supabaseAdmin.from("supplier_grn_line_items").insert(lineInserts);
  if (liError) throw liError;

  await writeAuditLog({
    entity_type: "supplier_grn",
    entity_id: id,
    action: "update",
    performed_by: user.id,
    new_value: { supplier_name, item_count: items.length },
  });

  return NextResponse.json({ id, reference_number: (existing as any).reference_number });
}
