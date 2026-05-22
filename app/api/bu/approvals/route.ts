import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";
import { createNotification } from "../../../../lib/services/notificationService";

/**
 * GET /api/bu/approvals
 * Returns transfer requests pending BU Manager approval, scoped to the
 * BU_MANAGER's own SBU.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "BU_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  // Resolve approver's SBU from their profile (ADMIN gets all)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("sbu_id")
    .eq("id", user.id)
    .single();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let pendingQuery = supabaseAdmin
    .from("transfer_requests")
    .select(
      "*, sbus(id, name), sbu_units(id, name, code), transfer_line_items(*, products(id, name, sku, unit_cost, unit_of_measure))",
    )
    .eq("status", "PENDING_BU_APPROVAL")
    .order("created_at", { ascending: false });

  // Scope BU_MANAGER to their own SBU
  if (role === "BU_MANAGER" && (profile as any)?.sbu_id) {
    pendingQuery = pendingQuery.eq("sbu_id", (profile as any).sbu_id);
  }

  const [pendingResult, approvedTodayResult, rejectedTodayResult] = await Promise.all([
    pendingQuery,
    supabaseAdmin
      .from("transfer_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL")
      .not("bu_approved_at", "is", null)
      .gte("bu_approved_at", todayStart.toISOString()),
    supabaseAdmin
      .from("transfer_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "CANCELLED")
      .not("bu_approved_at", "is", null)
      .gte("bu_approved_at", todayStart.toISOString()),
  ]);

  return NextResponse.json({
    transfer_requests: pendingResult.data ?? [],
    approved_today: approvedTodayResult.count ?? 0,
    rejected_today: rejectedTodayResult.count ?? 0,
  });
}

/**
 * POST /api/bu/approvals
 * BU Manager approves or rejects a unit-staff-raised transfer request.
 *
 * Body: { transfer_request_id: string, action: "approve" | "reject", notes?: string }
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "BU_MANAGER") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  const body = await req.json();
  const { transfer_request_id, action, notes } = body;

  if (!transfer_request_id || !action) {
    return NextResponse.json(
      { error: "transfer_request_id and action are required" },
      { status: 400 },
    );
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  // Fetch the request and verify it's in the right state
  const { data: tr, error: fetchError } = await supabaseAdmin
    .from("transfer_requests")
    .select("id, status, reference_number, sbu_id, raised_by")
    .eq("id", transfer_request_id)
    .single();

  if (fetchError || !tr) {
    return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
  }
  if ((tr as any).status !== "PENDING_BU_APPROVAL") {
    return NextResponse.json(
      {
        error: `Transfer is not awaiting BU approval. Current status: ${(tr as any).status}`,
      },
      { status: 409 },
    );
  }

  // Verify the request belongs to the BU Manager's own SBU
  const { data: approverProfile } = await supabaseAdmin
    .from("profiles")
    .select("sbu_id")
    .eq("id", user.id)
    .single();

  if ((approverProfile as any)?.sbu_id !== (tr as any).sbu_id) {
    return NextResponse.json(
      { error: "This transfer request does not belong to your SBU" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const newStatus = action === "approve" ? "PENDING_APPROVAL" : "CANCELLED";

  const { error: updateError } = await supabaseAdmin
    .from("transfer_requests")
    .update({
      status: newStatus,
      bu_approved_by: user.id,
      bu_approved_at: now,
      bu_approval_notes: notes ?? null,
      updated_at: now,
    })
    .eq("id", transfer_request_id);

  if (updateError) throw updateError;

  const refNum = (tr as any).reference_number;
  const raisedBy = (tr as any).raised_by;

  if (action === "approve") {
    // Notify Finance Manager(s) that a request is ready for their review
    await createNotification({
      user_role: "FINANCE_MANAGER",
      type: "transfer_request_pending_finance_approval",
      message: `Transfer ${refNum} approved by BU Manager — awaiting Finance review`,
      related_entity_id: transfer_request_id,
    });
  } else {
    // Notify the originating unit staff member directly
    await createNotification({
      user_id: raisedBy,
      type: "transfer_request_rejected_by_bu",
      message: `Transfer ${refNum} was rejected by BU Manager`,
      related_entity_id: transfer_request_id,
    });
  }

  await writeAuditLog({
    entity_type: "transfer_request",
    entity_id: transfer_request_id,
    action: `bu_${action}`,
    performed_by: user.id,
    new_value: { status: newStatus, notes },
  });

  return NextResponse.json({ id: transfer_request_id, status: newStatus });
}
