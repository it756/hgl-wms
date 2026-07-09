import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";
import { buildSupplierGrnNotificationMessage } from "../../../lib/notifications/messages";
import type { SupplierGRNCreateInput } from "../../../lib/models/grn";

interface AuthMetadata {
  role?: string;
}

interface AtomicSupplierGrnResult {
  id: string;
  reference_number: string;
  has_packing_variance: boolean;
}

type SupplierGrnItemInput = SupplierGRNCreateInput["items"][number];

interface SupplierGrnFallbackInput {
  supplier_name: string;
  supplier_invoice_reference?: string | null;
  invoice_amount?: number | null;
  date_received?: string | null;
  sbu_id?: string | null;
  items: SupplierGrnItemInput[];
}

function generateSupplierGRNReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `SGRN-${year}-${seq}`;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden")) return 403;
  if (message.includes("required") || message.includes("at least one")) return 400;
  return 500;
}

function isMissingCreateSupplierGrnRpc(message: string): boolean {
  return (
    message.includes("create_supplier_grn_atomic") &&
    (message.includes("schema cache") || message.includes("Could not find the function"))
  );
}

function hasPackingVariance(items: SupplierGrnItemInput[]): boolean {
  return items.some(
    (item) =>
      item.quantity_expected !== undefined &&
      item.quantity_expected !== item.quantity_received,
  );
}

function buildLineItems(
  grnId: string,
  items: SupplierGrnItemInput[],
  includeExpiryDate: boolean,
) {
  return items.map((item) => ({
    supplier_grn_id: grnId,
    product_id: item.product_id,
    quantity_received: item.quantity_received,
    unit_cost: item.unit_cost ?? null,
    ...(includeExpiryDate ? { expiry_date: item.expiry_date ?? null } : {}),
  }));
}

async function createSupplierGrnFallback(
  input: SupplierGrnFallbackInput,
  actorId: string,
  referenceNumber: string,
): Promise<AtomicSupplierGrnResult> {
  const { data: createdGrn, error: grnError } = await supabaseAdmin
    .from("supplier_grns")
    .insert([
      {
        reference_number: referenceNumber,
        supplier_name: input.supplier_name.trim(),
        supplier_invoice_reference: input.supplier_invoice_reference ?? null,
        invoice_amount: input.invoice_amount ?? null,
        received_by: actorId,
        date_received: input.date_received ?? new Date().toISOString().slice(0, 10),
        status: "AWAITING_FINANCE_APPROVAL",
        sbu_id: input.sbu_id ?? null,
      },
    ])
    .select("id, reference_number")
    .single();

  if (grnError) throw grnError;

  const grn = createdGrn as { id: string; reference_number: string };
  const lineItemsWithExpiry = buildLineItems(grn.id, input.items, true);
  let lineInsertError = (await supabaseAdmin.from("supplier_grn_line_items").insert(lineItemsWithExpiry))
    .error;

  if (
    lineInsertError &&
    lineInsertError.message?.includes("expiry_date") &&
    lineInsertError.message?.includes("schema cache")
  ) {
    const retry = await supabaseAdmin
      .from("supplier_grn_line_items")
      .insert(buildLineItems(grn.id, input.items, false));
    lineInsertError = retry.error;
  }

  if (lineInsertError) {
    await supabaseAdmin.from("supplier_grns").delete().eq("id", grn.id);
    throw lineInsertError;
  }

  await supabaseAdmin.from("audit_logs").insert([
    {
      entity_type: "supplier_grn",
      entity_id: grn.id,
      action: "create",
      performed_by: actorId,
      new_value: {
        reference_number: referenceNumber,
        status: "AWAITING_FINANCE_APPROVAL",
        supplier_name: input.supplier_name,
        has_packing_variance: hasPackingVariance(input.items),
        fallback: "direct_insert_missing_rpc",
      },
    },
  ]);

  return {
    id: grn.id,
    reference_number: grn.reference_number,
    has_packing_variance: hasPackingVariance(input.items),
  };
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

  const { data, error: rpcError } = await supabaseAdmin.rpc("create_supplier_grn_atomic", {
    p_actor_id: user.id,
    p_reference_number: reference_number,
    p_supplier_name: supplier_name,
    p_supplier_invoice_reference: supplier_invoice_reference ?? null,
    p_invoice_amount: invoice_amount ?? null,
    p_date_received: date_received ?? null,
    p_sbu_id: sbu_id ?? null,
    p_items: items,
  });

  let created: AtomicSupplierGrnResult;
  if (rpcError && isMissingCreateSupplierGrnRpc(rpcError.message)) {
    created = await createSupplierGrnFallback(
      {
        supplier_name,
        supplier_invoice_reference,
        invoice_amount,
        date_received,
        sbu_id,
        items,
      },
      user.id,
      reference_number,
    );
  } else if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: statusForRpcError(rpcError.message) },
    );
  } else {
    created = data as AtomicSupplierGrnResult;
  }

  const grnId = created.id;

  const baseMessage = await buildSupplierGrnNotificationMessage({
    grnId,
    headline: `Supplier GRN ${created.reference_number} requires Finance approval before stock can be updated`,
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
  if (created.has_packing_variance) {
    const varianceMessage = await buildSupplierGrnNotificationMessage({
      grnId,
      headline: `Packing variance detected on Supplier GRN ${created.reference_number}`,
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

  return NextResponse.json(
    {
      id: grnId,
      reference_number: created.reference_number,
      has_packing_variance: created.has_packing_variance,
    },
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
