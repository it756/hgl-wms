import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";
import { createNotification } from "../../../../../lib/services/notificationService";

/**
 * POST /api/return-requests/[id]/finance-approve
 * Finance Manager approves or rejects the stock-credit step of a returned
 * goods request that has been physically received by the Warehouse Manager.
 *
 * Body: { action: "approve" | "reject", notes?: string }
 *   - approve: calls process_return_stock_credit RPC → status STOCK_RESTORED, stock incremented
 *   - reject:  status REJECTED, no stock change, BU Manager notified
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["FINANCE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Finance Manager only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, notes } = body as { action?: string; notes?: string };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("return_requests")
    .select("id, reference_number, status")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }
  if ((existing as any).status !== "AWAITING_FINANCE_APPROVAL") {
    return NextResponse.json(
      {
        error: `Return must be AWAITING_FINANCE_APPROVAL (current: ${(existing as any).status})`,
      },
      { status: 409 },
    );
  }

  const ref = (existing as any).reference_number;

  if (action === "approve") {
    const { error: rpcError } = await supabaseAdmin.rpc("process_return_stock_credit", {
      p_return_request_id: id,
      p_approved_by: user.id,
      p_notes: notes ?? null,
    });
    if (rpcError) {
      console.error(rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    await Promise.all([
      createNotification({
        user_role: "BU_MANAGER",
        type: "return_stock_restored",
        message: `Return ${ref} approved by Finance — stock restored`,
        related_entity_id: id,
      }),
      createNotification({
        user_role: "UNIT_STAFF",
        type: "return_stock_restored",
        message: `Return ${ref} fully closed — stock restored`,
        related_entity_id: id,
      }),
      createNotification({
        user_role: "WAREHOUSE_MANAGER",
        type: "return_stock_restored",
        message: `Return ${ref} closed — stock has been credited`,
        related_entity_id: id,
      }),
    ]);

    await writeAuditLog({
      entity_type: "return_request",
      entity_id: id,
      action: "finance_approve",
      performed_by: user.id,
      previous_value: { status: "AWAITING_FINANCE_APPROVAL" },
      new_value: { status: "STOCK_RESTORED", notes: notes ?? null },
    });

    return NextResponse.json({ id, reference_number: ref, status: "STOCK_RESTORED" });
  }

  // Reject path — no stock change
  const { error: updateError } = await supabaseAdmin
    .from("return_requests")
    .update({
      status: "REJECTED",
      finance_approved_by: user.id,
      finance_approved_at: new Date().toISOString(),
      finance_approval_notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await Promise.all([
    createNotification({
      user_role: "BU_MANAGER",
      type: "return_rejected_by_finance",
      message: `Return ${ref} was rejected by Finance${notes ? `: ${notes}` : ""}`,
      related_entity_id: id,
    }),
    createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "return_rejected_by_finance",
      message: `Return ${ref} rejected by Finance — stock NOT credited`,
      related_entity_id: id,
    }),
  ]);

  await writeAuditLog({
    entity_type: "return_request",
    entity_id: id,
    action: "finance_reject",
    performed_by: user.id,
    previous_value: { status: "AWAITING_FINANCE_APPROVAL" },
    new_value: { status: "REJECTED", notes: notes ?? null },
  });

  return NextResponse.json({ id, reference_number: ref, status: "REJECTED" });
}
