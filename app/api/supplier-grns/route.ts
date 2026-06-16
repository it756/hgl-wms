import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { writeAuditLog } from "../../../lib/services/auditService";
import { createNotification } from "../../../lib/services/notificationService";
import { buildSupplierGrnNotificationMessage } from "../../../lib/notifications/messages";
import type { SupplierGRNCreateInput } from "../../../lib/models/grn";

interface AuthMetadata {
  role?: string;
}

interface CreatedSupplierGrnRow {
  id: string;
}

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

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "WAREHOUSE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const body: SupplierGRNCreateInput = await req.json();
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
  const grnId = (grn as CreatedSupplierGrnRow).id;

  // Detect packing-list variance: any line with quantity_expected != quantity_received
  let hasPackingVariance = false;

  const lineInserts = items.map((item) => {
    if (
      typeof item.quantity_expected === "number" &&
      item.quantity_expected !== item.quantity_received
    ) {
      hasPackingVariance = true;
    }
    return {
      supplier_grn_id: grnId,
      product_id: item.product_id,
      quantity_received: item.quantity_received,
      unit_cost: item.unit_cost ?? null,
      expiry_date: item.expiry_date ?? null,
    };
  });

  const { error: liError } = await supabaseAdmin
    .from("supplier_grn_line_items")
    .insert(lineInserts);
  if (liError) throw liError;

  const baseMessage = await buildSupplierGrnNotificationMessage({
    grnId,
    headline: `Supplier GRN ${reference_number} requires Finance approval before stock can be updated`,
    actorId: user.id,
    actorLabel: role === "ADMIN" ? "Admin recorder" : "Received by",
  });

  // Notify Finance Manager for approval
  await createNotification({
    user_role: "FINANCE_MANAGER",
    type: "supplier_grn_awaiting_approval",
    message: baseMessage,
    related_entity_id: grnId,
    dispatchChannels: true,
  });

  // Notify Admin + Finance silently if there was a packing variance
  if (hasPackingVariance) {
    const varianceMessage = await buildSupplierGrnNotificationMessage({
      grnId,
      headline: `Packing variance detected on Supplier GRN ${reference_number}`,
      actorId: user.id,
      actorLabel: role === "ADMIN" ? "Admin recorder" : "Received by",
    });

    await Promise.all([
      createNotification({
        user_role: "ADMIN",
        type: "supplier_grn_packing_variance",
        message: varianceMessage,
        related_entity_id: grnId,
        dispatchChannels: true,
      }),
      createNotification({
        user_role: "FINANCE_MANAGER",
        type: "supplier_grn_packing_variance",
        message: varianceMessage,
        related_entity_id: grnId,
        dispatchChannels: true,
      }),
    ]);
  }

  await writeAuditLog({
    entity_type: "supplier_grn",
    entity_id: grnId,
    action: "create",
    performed_by: user.id,
    new_value: {
      reference_number,
      status: "AWAITING_FINANCE_APPROVAL",
      supplier_name,
      has_packing_variance: hasPackingVariance,
    },
  });

  return NextResponse.json(
    { id: grnId, reference_number, has_packing_variance: hasPackingVariance },
    { status: 201 },
  );
}

/**
 * GET /api/supplier-grns
 * List supplier GRNs. Finance Manager/Admin see all; Warehouse Manager sees all.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
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
