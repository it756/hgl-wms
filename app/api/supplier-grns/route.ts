import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { writeAuditLog } from "../../../lib/services/auditService";
import { createNotification } from "../../../lib/services/notificationService";
import type { SupplierGRNCreateInput } from "../../../lib/models/grn";

function generateSupplierGRNReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `SGRN-${year}-${seq}`;
}

/**
 * POST /api/supplier-grns
 * Warehouse Manager records receipt of goods from a supplier.
 * GRN starts as AWAITING_FINANCE_APPROVAL; stock is only updated after Finance approves.
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "WAREHOUSE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const body: SupplierGRNCreateInput = await req.json();
  const { supplier_name, supplier_invoice_reference, invoice_amount, date_received, sbu_id, items } = body;

  if (!supplier_name || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "supplier_name and at least one line item are required" },
      { status: 400 },
    );
  }

  const reference_number = generateSupplierGRNReference();

  const { data: grn, error: grnError } = await supabaseAdmin
    .from("supplier_grns")
    .insert([
      {
        reference_number,
        supplier_name,
        supplier_invoice_reference: supplier_invoice_reference ?? null,
        invoice_amount: invoice_amount ?? null,
        received_by: user.id,
        date_received: date_received ?? new Date().toISOString().split("T")[0],
        status: "AWAITING_FINANCE_APPROVAL",
        sbu_id: sbu_id ?? null,
      },
    ])
    .select()
    .single();

  if (grnError) throw grnError;
  const grnId = (grn as any).id;

  const lineInserts = items.map((item) => ({
    supplier_grn_id: grnId,
    product_id: item.product_id,
    quantity_received: item.quantity_received,
    unit_cost: item.unit_cost ?? null,
  }));

  const { error: liError } = await supabaseAdmin.from("supplier_grn_line_items").insert(lineInserts);
  if (liError) throw liError;

  // Notify Finance Manager for approval
  await createNotification({
    user_role: "FINANCE_MANAGER",
    type: "supplier_grn_awaiting_approval",
    message: `Supplier GRN ${reference_number} requires Finance approval before stock can be updated`,
    related_entity_id: grnId,
  });

  await writeAuditLog({
    entity_type: "supplier_grn",
    entity_id: grnId,
    action: "create",
    performed_by: user.id,
    new_value: { reference_number, status: "AWAITING_FINANCE_APPROVAL", supplier_name },
  });

  return NextResponse.json({ id: grnId, reference_number }, { status: 201 });
}

/**
 * GET /api/supplier-grns
 * List supplier GRNs. Finance Manager/Admin see all; Warehouse Manager sees all.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let query = supabaseAdmin
    .from("supplier_grns")
    .select("*, supplier_grn_line_items(*)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json(data ?? []);
}
