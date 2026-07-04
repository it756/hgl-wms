import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";

interface AtomicReturnResult {
  id: string;
  reference_number: string;
}

function generateReturnReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `RTN-${year}-${seq}`;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden") || message.includes("does not belong")) return 403;
  if (message.includes("completed transfers")) return 409;
  if (message.includes("required") || message.includes("at least one")) return 400;
  return 500;
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

  const reference_number = generateReturnReference();

  const { data, error: rpcError } = await supabaseAdmin.rpc("create_return_request_atomic", {
    p_actor_id: user.id,
    p_reference_number: reference_number,
    p_original_transfer_request_id: original_transfer_request_id ?? null,
    p_reason: reason.trim(),
    p_notes: notes?.trim() ?? null,
    p_items: items,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: statusForRpcError(rpcError.message) },
    );
  }

  const created = data as AtomicReturnResult;
  const returnId = created.id;

  // Notify BU Manager for their SBU
  await createNotification({
    user_role: "BU_MANAGER",
    type: "return_request_submitted",
    message: `Return request ${created.reference_number} requires your approval`,
    related_entity_id: returnId,
  });

  return NextResponse.json(
    { id: returnId, reference_number: created.reference_number },
    { status: 201 },
  );
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
