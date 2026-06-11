import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../../lib/services/auditService";
import { createNotification } from "../../../../../../lib/services/notificationService";

/**
 * PATCH /api/admin/variance/proposals/[id]
 * Finance Manager approves or rejects a variance resolution proposal.
 * On approval: optionally overrides per-line decisions, then calls the
 *              execute_variance_resolution RPC atomically.
 * On rejection: proposal stays and transfer remains COMPLETED_WITH_VARIANCE
 *               so a revised proposal can be re-submitted.
 *
 * Roles: FINANCE_MANAGER, ADMIN.
 *
 * Body: {
 *   action: "approve" | "reject",
 *   review_notes?: string,
 *   line_decisions?: Array<{
 *     line_id: string,
 *     finance_decision: "damage_writeoff" | "stock_reintegration",
 *     finance_decision_notes?: string
 *   }>
 * }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["FINANCE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Finance Manager only" }, { status: 403 });
  }

  const { id: proposalId } = await params;
  const body = await req.json();
  const { action, review_notes, line_decisions } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (action === "reject" && !review_notes?.trim()) {
    return NextResponse.json(
      { error: "review_notes are required when rejecting" },
      { status: 400 },
    );
  }

  // Fetch proposal + transfer reference for notifications
  const { data: proposal, error: fetchError } = await supabaseAdmin
    .from("variance_proposals")
    .select("id, status, proposed_by, transfer_request_id, transfer_requests(reference_number)")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if ((proposal as any).status !== "PENDING_FINANCE_REVIEW") {
    return NextResponse.json(
      { error: `Proposal is not pending review (current status: ${(proposal as any).status})` },
      { status: 409 },
    );
  }

  const transferRef = (proposal as any).transfer_requests?.reference_number ?? proposalId;

  // ── REJECTION ─────────────────────────────────────────────────────────────
  if (action === "reject") {
    const { error: rejectError } = await supabaseAdmin
      .from("variance_proposals")
      .update({
        status: "REJECTED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId);

    if (rejectError) return NextResponse.json({ error: rejectError.message }, { status: 500 });

    // Notify the proposer
    await createNotification({
      user_id: (proposal as any).proposed_by,
      type: "variance_proposal_rejected",
      message: `Your variance resolution proposal for transfer ${transferRef} was rejected by Finance. You may submit a revised proposal.`,
      related_entity_id: proposalId,
    });

    await writeAuditLog({
      entity_type: "variance_proposal",
      entity_id: proposalId,
      action: "variance_proposal_rejected",
      performed_by: user.id,
      details: { review_notes, transfer_reference: transferRef },
    });

    return NextResponse.json({ id: proposalId, status: "REJECTED" });
  }

  // ── APPROVAL ──────────────────────────────────────────────────────────────

  // Apply Finance line-level overrides before calling the RPC
  if (Array.isArray(line_decisions) && line_decisions.length > 0) {
    for (const ld of line_decisions) {
      if (!["damage_writeoff", "stock_reintegration"].includes(ld.finance_decision)) {
        return NextResponse.json(
          { error: `Invalid finance_decision value: ${ld.finance_decision}` },
          { status: 400 },
        );
      }
    }

    const updatePromises = line_decisions.map((ld: any) =>
      supabaseAdmin
        .from("variance_proposal_lines")
        .update({
          finance_decision: ld.finance_decision,
          finance_decision_notes: ld.finance_decision_notes ?? null,
        })
        .eq("id", ld.line_id)
        .eq("proposal_id", proposalId),
    );
    const results = await Promise.all(updatePromises);
    for (const result of results) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
    }
  }

  // Save review notes before calling RPC (RPC doesn't set them)
  await supabaseAdmin
    .from("variance_proposals")
    .update({
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes ?? null,
    })
    .eq("id", proposalId);

  // Execute atomically via the database RPC
  const { error: rpcError } = await supabaseAdmin.rpc("execute_variance_resolution", {
    p_proposal_id: proposalId,
    p_reviewed_by: user.id,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: `Resolution execution failed: ${rpcError.message}` },
      { status: 500 },
    );
  }

  // Notify the proposer of approval
  await createNotification({
    user_id: (proposal as any).proposed_by,
    type: "variance_proposal_approved",
    message: `Your variance resolution proposal for transfer ${transferRef} was approved by Finance and has been executed.`,
    related_entity_id: proposalId,
  });

  return NextResponse.json({ id: proposalId, status: "APPROVED" });
}
