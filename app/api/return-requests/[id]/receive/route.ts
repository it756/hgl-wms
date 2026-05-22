import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";
import { createNotification } from "../../../../../lib/services/notificationService";

/**
 * POST /api/return-requests/[id]/receive
 * Warehouse Manager confirms physical receipt of approved returned goods.
 * Calls the process_return_receipt RPC which atomically:
 *   - Marks the return as RECEIVED
 *   - Increments warehouse stock for each returned line item
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  const { id } = await params;

  // Verify the return exists and is APPROVED before calling the RPC
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("return_requests")
    .select("id, reference_number, status, sbu_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }
  if ((existing as any).status !== "APPROVED") {
    return NextResponse.json(
      { error: `Return request must be APPROVED to receive (current: ${(existing as any).status})` },
      { status: 409 },
    );
  }

  // Atomically restore stock and mark RECEIVED via RPC
  const { error: rpcError } = await supabaseAdmin.rpc("process_return_receipt", {
    p_return_request_id: id,
    p_received_by: user.id,
  });

  if (rpcError) {
    console.error(rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const ref = (existing as any).reference_number;

  // Notify BU Manager and Unit Staff that the goods have been received
  await Promise.all([
    createNotification({
      user_role: "BU_MANAGER",
      type: "return_received",
      message: `Return request ${ref} has been received at the warehouse and stock has been restored`,
      related_entity_id: id,
    }),
    createNotification({
      user_role: "UNIT_STAFF",
      type: "return_received",
      message: `Return request ${ref} has been received at the warehouse`,
      related_entity_id: id,
    }),
  ]);

  await writeAuditLog({
    entity_type: "return_request",
    entity_id: id,
    action: "return_received",
    performed_by: user.id,
    previous_value: { status: "APPROVED" },
    new_value: { status: "RECEIVED" },
  });

  return NextResponse.json({ id, reference_number: ref, status: "RECEIVED" });
}
