import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";
import { createNotification } from "../../../../lib/services/notificationService";

/**
 * POST /api/finance/approvals
 * Finance Manager approves or rejects a transfer request or supplier GRN.
 *
 * Body: { entity_type: "transfer_request" | "supplier_grn", entity_id: string, action: "approve" | "reject", notes?: string }
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "FINANCE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Finance Manager only" }, { status: 403 });
  }

  const body = await req.json();
  const { entity_type, entity_id, action, notes } = body;

  if (!entity_type || !entity_id || !action) {
    return NextResponse.json(
      { error: "entity_type, entity_id and action are required" },
      { status: 400 },
    );
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  if (entity_type === "transfer_request") {
    const { data: tr, error: fetchError } = await supabaseAdmin
      .from("transfer_requests")
      .select("status, reference_number, requires_finance_approval")
      .eq("id", entity_id)
      .single();

    if (fetchError || !tr) {
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
    }
    if ((tr as any).status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Transfer is not awaiting approval. Current status: ${(tr as any).status}` },
        { status: 409 },
      );
    }

    const newStatus = action === "approve" ? "APPROVED_FOR_ISSUE" : "CANCELLED";
    const { error: updateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        status: newStatus,
        approved_by: action === "approve" ? user.id : null,
        approved_at: action === "approve" ? new Date().toISOString() : null,
        finance_approval_notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entity_id);

    if (updateError) throw updateError;

    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: action === "approve" ? "transfer_approved_for_issue" : "transfer_rejected",
      message:
        action === "approve"
          ? `Transfer ${(tr as any).reference_number} approved for issuance`
          : `Transfer ${(tr as any).reference_number} rejected by Finance`,
      related_entity_id: entity_id,
    });

    await writeAuditLog({
      entity_type: "transfer_request",
      entity_id,
      action: `finance_${action}`,
      performed_by: user.id,
      new_value: { status: newStatus, notes },
    });

    return NextResponse.json({ id: entity_id, status: newStatus });
  }

  if (entity_type === "supplier_grn") {
    const { data: grn, error: fetchError } = await supabaseAdmin
      .from("supplier_grns")
      .select("status, reference_number")
      .eq("id", entity_id)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "Supplier GRN not found" }, { status: 404 });
    }
    if ((grn as any).status !== "AWAITING_FINANCE_APPROVAL") {
      return NextResponse.json(
        { error: `Supplier GRN is not awaiting approval. Current status: ${(grn as any).status}` },
        { status: 409 },
      );
    }

    if (action === "approve") {
      // Increment stock via DB RPC
      const { error: rpcError } = await supabaseAdmin.rpc("increment_stock_after_grn", {
        p_grn_id: entity_id,
        p_approved_by: user.id,
        p_approval_notes: notes ?? null,
      });

      if (rpcError) {
        // If RPC fails because status not yet GRN_APPROVED, update status first then retry
        const { error: statusError } = await supabaseAdmin
          .from("supplier_grns")
          .update({
            status: "GRN_APPROVED",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            approval_notes: notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entity_id);

        if (statusError) throw statusError;

        const { error: rpcRetryError } = await supabaseAdmin.rpc("increment_stock_after_grn", {
          p_grn_id: entity_id,
          p_approved_by: user.id,
          p_approval_notes: notes ?? null,
        });
        if (rpcRetryError) throw rpcRetryError;
      } else {
        // Update status in case RPC doesn't
        await supabaseAdmin
          .from("supplier_grns")
          .update({
            status: "GRN_APPROVED",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            approval_notes: notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entity_id);
      }
    } else {
      await supabaseAdmin
        .from("supplier_grns")
        .update({
          status: "GRN_REJECTED",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entity_id);
    }

    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: action === "approve" ? "supplier_grn_approved" : "supplier_grn_rejected",
      message:
        action === "approve"
          ? `Supplier GRN ${(grn as any).reference_number} approved — stock updated`
          : `Supplier GRN ${(grn as any).reference_number} rejected by Finance`,
      related_entity_id: entity_id,
    });

    await writeAuditLog({
      entity_type: "supplier_grn",
      entity_id,
      action: `finance_${action}`,
      performed_by: user.id,
      new_value: { notes },
    });

    return NextResponse.json({
      id: entity_id,
      status: action === "approve" ? "GRN_APPROVED" : "GRN_REJECTED",
    });
  }

  return NextResponse.json({ error: `Unknown entity_type: ${entity_type}` }, { status: 400 });
}

/**
 * GET /api/finance/approvals
 * Returns items pending Finance Manager approval.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "FINANCE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [transfersResult, grnsResult] = await Promise.all([
    supabaseAdmin
      .from("transfer_requests")
      .select("*, transfer_line_items(*)")
      .eq("status", "PENDING_APPROVAL")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("supplier_grns")
      .select("*, supplier_grn_line_items(*)")
      .eq("status", "AWAITING_FINANCE_APPROVAL")
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    transfer_requests: transfersResult.data ?? [],
    supplier_grns: grnsResult.data ?? [],
  });
}

