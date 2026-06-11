import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../../lib/services/auditService";

/**
 * POST /api/bu/variance/[id]/disposition
 * BU Manager: submit per-line-item disposition for a COMPLETED_WITH_VARIANCE transfer.
 *
 * Body: {
 *   line_dispositions: Array<{
 *     grn_line_item_id: string,
 *     disposition: "WRITE_BACK" | "LOSS",
 *     notes?: string
 *   }>
 * }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["BU_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transferId = params.id;
  if (!transferId) {
    return NextResponse.json({ error: "Transfer request ID is required" }, { status: 400 });
  }

  // BU_MANAGER: verify this transfer belongs to their SBU
  if (role === "BU_MANAGER") {
    const sbuId = (user.user_metadata as any)?.sbu_id ?? null;
    if (!sbuId) {
      return NextResponse.json({ error: "No SBU assigned to this account" }, { status: 400 });
    }

    const { data: tr, error: trErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, sbu_id, status")
      .eq("id", transferId)
      .single();

    if (trErr || !tr) {
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
    }
    if ((tr as any).sbu_id !== sbuId) {
      return NextResponse.json(
        { error: "Forbidden: transfer belongs to a different SBU" },
        { status: 403 },
      );
    }
    if ((tr as any).status !== "COMPLETED_WITH_VARIANCE") {
      return NextResponse.json(
        { error: `Transfer must be COMPLETED_WITH_VARIANCE, got: ${(tr as any).status}` },
        { status: 400 },
      );
    }
  }

  const body = await req.json();
  const { line_dispositions } = body;

  if (!Array.isArray(line_dispositions) || line_dispositions.length === 0) {
    return NextResponse.json({ error: "line_dispositions array is required" }, { status: 400 });
  }

  // Validate each entry
  for (const item of line_dispositions) {
    if (!item.grn_line_item_id) {
      return NextResponse.json({ error: "Each item requires grn_line_item_id" }, { status: 400 });
    }
    if (!["WRITE_BACK", "LOSS"].includes(item.disposition)) {
      return NextResponse.json(
        { error: `Invalid disposition value: ${item.disposition}. Must be WRITE_BACK or LOSS` },
        { status: 400 },
      );
    }
  }

  // Call the atomic RPC
  const { error: rpcError } = await supabaseAdmin.rpc("process_variance_disposition", {
    p_transfer_request_id: transferId,
    p_decided_by: user.id,
    p_line_dispositions: JSON.stringify(line_dispositions),
  });

  if (rpcError) {
    console.error("process_variance_disposition RPC failed", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // Notify Warehouse Manager
  await supabaseAdmin.from("notifications").insert([
    {
      related_entity_id: transferId,
      type: "variance_disposed",
      message: `Variance disposition submitted for transfer by BU Manager — check Loss Account`,
      user_role: "WAREHOUSE_MANAGER",
    },
  ]);

  await writeAuditLog({
    entity_type: "transfer_request",
    entity_id: transferId,
    action: "variance_disposition",
    performed_by: user.id,
    details: { line_count: line_dispositions.length },
  });

  return NextResponse.json({ success: true });
}
