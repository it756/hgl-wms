import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { writeAuditLog } from "../../../lib/services/auditService";
import { createNotification } from "../../../lib/services/notificationService";

function generateReturnReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `RTN-${year}-${seq}`;
}

/**
 * POST /api/return-requests
 * Unit Staff raises a return of previously received goods back to the warehouse.
 * Requires BU Manager sign-off before the Warehouse Manager can receive and restore stock.
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "UNIT_STAFF") {
    return NextResponse.json({ error: "Forbidden: Unit Staff only" }, { status: 403 });
  }

  const sbu_id = (user.user_metadata as any)?.sbu_id ?? null;
  if (!sbu_id) {
    return NextResponse.json({ error: "User has no SBU assigned" }, { status: 400 });
  }

  const body = await req.json();
  const { original_transfer_request_id, reason, notes, items } = body;

  if (!reason?.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
  }
  for (const item of items) {
    if (!item.product_id || !item.quantity_to_return || item.quantity_to_return < 1) {
      return NextResponse.json(
        { error: "Each item must have a product_id and quantity_to_return >= 1" },
        { status: 400 },
      );
    }
  }

  // If an original transfer is linked, verify it belongs to the user's SBU and is completed
  if (original_transfer_request_id) {
    const { data: transfer } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, sbu_id, status")
      .eq("id", original_transfer_request_id)
      .single();

    if (!transfer) {
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
    }
    if (transfer.sbu_id !== sbu_id) {
      return NextResponse.json({ error: "Transfer does not belong to your SBU" }, { status: 403 });
    }
    if (!["COMPLETED", "COMPLETED_WITH_VARIANCE"].includes(transfer.status)) {
      return NextResponse.json(
        { error: "Returns can only be raised against completed transfers" },
        { status: 409 },
      );
    }
  }

  const reference_number = generateReturnReference();

  const { data: returnRequest, error: insertError } = await supabaseAdmin
    .from("return_requests")
    .insert([
      {
        reference_number,
        original_transfer_request_id: original_transfer_request_id ?? null,
        sbu_id,
        raised_by: user.id,
        status: "PENDING_APPROVAL",
        reason: reason.trim(),
        notes: notes?.trim() ?? null,
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const returnId = (returnRequest as any).id;

  const lineInserts = items.map((item: any) => ({
    return_request_id: returnId,
    product_id: item.product_id,
    quantity_to_return: item.quantity_to_return,
  }));

  const { error: lineError } = await supabaseAdmin.from("return_line_items").insert(lineInserts);
  if (lineError) {
    console.error(lineError);
    return NextResponse.json({ error: lineError.message }, { status: 500 });
  }

  // Notify BU Manager for their SBU
  await createNotification({
    user_role: "BU_MANAGER",
    type: "return_request_submitted",
    message: `Return request ${reference_number} requires your approval`,
    related_entity_id: returnId,
  });

  await writeAuditLog({
    entity_type: "return_request",
    entity_id: returnId,
    action: "create",
    performed_by: user.id,
    new_value: { reference_number, status: "PENDING_APPROVAL", sbu_id, reason },
  });

  return NextResponse.json({ id: returnId, reference_number }, { status: 201 });
}

/**
 * GET /api/return-requests
 * List return requests scoped by role.
 * UNIT_STAFF / BU_MANAGER → their SBU only
 * WAREHOUSE_MANAGER / ADMIN → all
 * Optional ?status= filter
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  const allowedRoles = ["UNIT_STAFF", "BU_MANAGER", "WAREHOUSE_MANAGER", "ADMIN"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");

  let query = supabaseAdmin
    .from("return_requests")
    .select(
      `id, reference_number, status, reason, notes, approval_notes, sbu_id,
       raised_by, approved_by, approved_at, received_by, received_at,
       created_at, updated_at,
       original_transfer_request_id,
       transfer_requests ( reference_number ),
       return_line_items (
         id, product_id, quantity_to_return, quantity_received,
         products ( name, sku, unit_of_measure )
       )`,
    )
    .order("created_at", { ascending: false });

  // Scope to the user's SBU for UNIT_STAFF and BU_MANAGER
  if (role === "UNIT_STAFF" || role === "BU_MANAGER") {
    const sbu_id = (user.user_metadata as any)?.sbu_id ?? null;
    if (!sbu_id) return NextResponse.json([], { status: 200 });
    query = query.eq("sbu_id", sbu_id);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
