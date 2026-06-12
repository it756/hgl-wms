import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";
import { createNotification } from "../../../../../lib/services/notificationService";

/**
 * POST /api/return-requests/[id]/receive
 * Warehouse Manager confirms physical receipt of approved returned goods.
 * Calls the process_return_physical_receipt RPC which:
 *   - Marks the return as AWAITING_FINANCE_APPROVAL
 *   - Does NOT modify stock — Finance Manager must approve the stock credit
 *     via /api/return-requests/[id]/finance-approve.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      {
        error: `Return request must be APPROVED to receive (current: ${(existing as any).status})`,
      },
      { status: 409 },
    );
  }

  // Mark as physically received via RPC (no stock change)
  const { error: rpcError } = await supabaseAdmin.rpc("process_return_physical_receipt", {
    p_return_request_id: id,
    p_received_by: user.id,
  });

  if (rpcError) {
    console.error(rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const ref = (existing as any).reference_number;

  // Notify Finance Manager that the return now needs stock-credit approval.
  await Promise.all([
    createNotification({
      user_role: "FINANCE_MANAGER",
      type: "return_awaiting_finance_approval",
      message: `Return ${ref} has been physically received and needs Finance approval to credit stock`,
      related_entity_id: id,
    }),
    createNotification({
      user_role: "BU_MANAGER",
      type: "return_received_pending_finance",
      message: `Return ${ref} received at warehouse — awaiting Finance approval to restore stock`,
      related_entity_id: id,
    }),
  ]);

  await writeAuditLog({
    entity_type: "return_request",
    entity_id: id,
    action: "return_physical_receipt",
    performed_by: user.id,
    previous_value: { status: "APPROVED" },
    new_value: { status: "AWAITING_FINANCE_APPROVAL" },
  });

  return NextResponse.json({
    id,
    reference_number: ref,
    status: "AWAITING_FINANCE_APPROVAL",
  });
}
