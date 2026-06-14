import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";
import { createNotification } from "../../../../../lib/services/notificationService";

/**
 * POST /api/return-requests/[id]/approve
 * BU Manager or Admin approves or rejects a PENDING_APPROVAL return request.
 * Body: { action: "approve" | "reject", approval_notes?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["BU_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, approval_notes } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Fetch and lock the return request
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("return_requests")
    .select("id, reference_number, status, sbu_id, raised_by")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }
  if ((existing as any).status !== "PENDING_APPROVAL") {
    return NextResponse.json(
      { error: `Return request is already ${(existing as any).status}` },
      { status: 409 },
    );
  }

  const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("return_requests")
    .update({
      status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: approval_notes?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDING_APPROVAL")
    .select()
    .single();

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const ref = (existing as any).reference_number;

  if (action === "approve") {
    // Notify Warehouse Manager to expect the returned goods
    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "return_approved",
      message: `Return request ${ref} has been approved and is awaiting receipt at the warehouse`,
      related_entity_id: id,
    });
  } else {
    // Notify Unit Staff that their return was rejected
    await createNotification({
      user_role: "UNIT_STAFF",
      type: "return_rejected",
      message: `Return request ${ref} was rejected by your BU Manager${approval_notes ? `: ${approval_notes}` : ""}`,
      related_entity_id: id,
    });
  }

  await writeAuditLog({
    entity_type: "return_request",
    entity_id: id,
    action: action === "approve" ? "return_approved" : "return_rejected",
    performed_by: user.id,
    previous_value: { status: "PENDING_APPROVAL" },
    new_value: { status: newStatus, approval_notes: approval_notes ?? null },
  });

  return NextResponse.json(updated);
}
