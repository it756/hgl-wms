import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../lib/services/auditService";
import { createNotification } from "../../../../../lib/services/notificationService";

const PROPOSAL_AUTHORS = ["ADMIN", "WAREHOUSE_MANAGER", "BU_MANAGER"];

/**
 * POST /api/admin/variance/proposals
 * Raises a variance resolution proposal with per-line resolution recommendations.
 * Roles: ADMIN, WAREHOUSE_MANAGER, BU_MANAGER (own SBU only).
 *
 * Body: {
 *   transfer_request_id: string,
 *   grn_id: string,
 *   proposal_notes?: string,
 *   lines: Array<{
 *     grn_line_item_id: string,
 *     product_id: string,
 *     variance_quantity: number,         // signed: positive=excess, negative=shortage
 *     recommended_resolution: "damage_writeoff" | "stock_reintegration"
 *   }>
 * }
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!PROPOSAL_AUTHORS.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { transfer_request_id, grn_id, proposal_notes, lines } = body;

  if (!transfer_request_id || !grn_id || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "transfer_request_id, grn_id, and at least one line are required" },
      { status: 400 },
    );
  }

  // Validate resolution types
  for (const line of lines) {
    if (!["damage_writeoff", "stock_reintegration"].includes(line.recommended_resolution)) {
      return NextResponse.json(
        { error: `Invalid recommended_resolution: ${line.recommended_resolution}` },
        { status: 400 },
      );
    }
    if (line.recommended_resolution === "stock_reintegration" && line.variance_quantity <= 0) {
      return NextResponse.json(
        {
          error: "stock_reintegration is only valid for lines with excess (variance_quantity > 0)",
        },
        { status: 400 },
      );
    }
  }

  // Fetch and validate transfer
  const { data: transfer, error: trError } = await supabaseAdmin
    .from("transfer_requests")
    .select("id, status, sbu_id, reference_number")
    .eq("id", transfer_request_id)
    .single();

  if (trError || !transfer) {
    return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
  }
  if ((transfer as any).status !== "COMPLETED_WITH_VARIANCE") {
    return NextResponse.json(
      {
        error: `Transfer is not in COMPLETED_WITH_VARIANCE status (current: ${(transfer as any).status})`,
      },
      { status: 409 },
    );
  }

  // BU_MANAGER: assert SBU ownership
  if (role === "BU_MANAGER") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id")
      .eq("id", user.id)
      .single();
    if (!profile || (profile as any).sbu_id !== (transfer as any).sbu_id) {
      return NextResponse.json(
        { error: "Forbidden: this transfer belongs to a different SBU" },
        { status: 403 },
      );
    }
  }

  // Block duplicate active proposals
  const { data: existing } = await supabaseAdmin
    .from("variance_proposals")
    .select("id")
    .eq("transfer_request_id", transfer_request_id)
    .eq("status", "PENDING_FINANCE_REVIEW")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A proposal is already pending Finance review for this transfer" },
      { status: 409 },
    );
  }

  // Insert proposal
  const { data: proposal, error: propError } = await supabaseAdmin
    .from("variance_proposals")
    .insert([
      {
        transfer_request_id,
        grn_id,
        proposed_by: user.id,
        proposal_notes: proposal_notes ?? null,
        status: "PENDING_FINANCE_REVIEW",
      },
    ])
    .select()
    .single();

  if (propError) return NextResponse.json({ error: propError.message }, { status: 500 });

  const proposalId = (proposal as any).id;

  // Insert lines
  const lineInserts = lines.map((l: any) => ({
    proposal_id: proposalId,
    grn_line_item_id: l.grn_line_item_id,
    product_id: l.product_id,
    variance_quantity: l.variance_quantity,
    recommended_resolution: l.recommended_resolution,
  }));

  const { error: linesError } = await supabaseAdmin
    .from("variance_proposal_lines")
    .insert(lineInserts);

  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 });

  // Notify Finance Manager
  await createNotification({
    user_role: "FINANCE_MANAGER",
    type: "variance_proposal_submitted",
    message: `Variance resolution proposal submitted for transfer ${(transfer as any).reference_number}`,
    related_entity_id: proposalId,
  });

  await writeAuditLog({
    entity_type: "variance_proposal",
    entity_id: proposalId,
    action: "variance_proposal_created",
    performed_by: user.id,
    new_value: { transfer_request_id, lines: lines.length },
  });

  return NextResponse.json({ id: proposalId, status: "PENDING_FINANCE_REVIEW" }, { status: 201 });
}

/**
 * GET /api/admin/variance/proposals
 * Returns proposals pending Finance review, enriched with transfer + line details.
 * Roles: FINANCE_MANAGER, ADMIN.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["FINANCE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("variance_proposals")
    .select(
      `id, status, proposal_notes, proposed_by, reviewed_by, reviewed_at, review_notes, created_at, updated_at,
       transfer_requests ( id, reference_number, sbu_id, updated_at ),
       grns ( id, condition_notes ),
       variance_proposal_lines (
         id, grn_line_item_id, product_id, variance_quantity,
         recommended_resolution, finance_decision, finance_decision_notes,
         products ( id, name, sku, unit_cost )
       )`,
    )
    .eq("status", "PENDING_FINANCE_REVIEW")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with proposer name
  const proposals = data ?? [];
  const proposerIds = [...new Set(proposals.map((p: any) => p.proposed_by).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (proposerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", proposerIds);
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name ?? ""]));
    }
  }

  const enriched = proposals.map((p: any) => ({
    ...p,
    proposer_name: profileMap[p.proposed_by] ?? null,
  }));

  return NextResponse.json(enriched);
}
