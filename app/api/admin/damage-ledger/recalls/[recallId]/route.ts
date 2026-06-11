import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../../lib/services/auditService";

const STATUS_TRANSITIONS: Record<string, string> = {
  PENDING: "IN_TRANSIT",
  IN_TRANSIT: "RECEIVED",
};

/**
 * PATCH /api/admin/damage-ledger/recalls/[recallId]
 * Advances the recall status: PENDING → IN_TRANSIT → RECEIVED.
 * Roles: ADMIN, WAREHOUSE_MANAGER.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ recallId: string }> }) {
  const { recallId } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or Warehouse Manager only" },
      { status: 403 },
    );
  }

  const { data: recall, error: fetchError } = await supabaseAdmin
    .from("damage_recalls")
    .select("id, status, damage_ledger_id")
    .eq("id", recallId)
    .single();

  if (fetchError || !recall) {
    return NextResponse.json({ error: "Recall not found" }, { status: 404 });
  }

  const currentStatus = (recall as any).status as string;
  const nextStatus = STATUS_TRANSITIONS[currentStatus];

  if (!nextStatus) {
    return NextResponse.json(
      { error: `Recall is already in terminal status: ${currentStatus}` },
      { status: 409 },
    );
  }

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus === "RECEIVED") {
    updatePayload.received_by = user.id;
    updatePayload.received_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("damage_recalls")
    .update(updatePayload)
    .eq("id", recallId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writeAuditLog({
    entity_type: "damage_recall",
    entity_id: recallId,
    action: `damage_recall_status_updated`,
    performed_by: user.id,
    new_value: { status: nextStatus, previous_status: currentStatus },
  });

  return NextResponse.json({ id: recallId, status: nextStatus });
}
