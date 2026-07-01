import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";
import { createNotification } from "../../../../lib/services/notificationService";
import {
  buildIntraTransferNotificationMessage,
  buildReturnNotificationMessage,
  buildSupplierGrnNotificationMessage,
  buildTransferNotificationMessage,
} from "../../../../lib/notifications/messages";

interface AuthMetadata {
  role?: string;
}

interface FinanceApprovalBody {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  notes?: string;
}

interface StatusReferenceRow {
  status: string;
  reference_number: string;
}

interface ProfileRow {
  id: string;
  full_name?: string | null;
}

interface RequesterRow extends Record<string, unknown> {
  raised_by?: string | null;
}

interface ProposalRow extends Record<string, unknown> {
  proposed_by?: string | null;
}

interface IntraTransferListRow extends Record<string, unknown> {
  transferred_by?: string | null;
}

/**
 * POST /api/finance/approvals
 * Finance Manager approves or rejects a transfer request, supplier GRN, return request,
 * or intra-warehouse transfer.
 *
 * Body: { entity_type: "transfer_request" | "supplier_grn" | "return_request" | "intra_transfer",
 *         entity_id: string, action: "approve" | "reject", notes?: string }
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "FINANCE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Finance Manager only" }, { status: 403 });
  }

  const body = (await req.json()) as FinanceApprovalBody;
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
    const transfer = tr as StatusReferenceRow;
    if (transfer.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Transfer is not awaiting approval. Current status: ${transfer.status}` },
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

    const message = await buildTransferNotificationMessage({
      transferId: entity_id,
      headline:
        action === "approve"
          ? `Transfer ${transfer.reference_number} approved for issuance`
          : `Transfer ${transfer.reference_number} rejected by Finance`,
      actorId: user.id,
      actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
      notes,
    });

    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: action === "approve" ? "transfer_approved_for_issue" : "transfer_rejected",
      message,
      related_entity_id: entity_id,
      dispatchChannels: true,
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
    const supplierGrn = grn as StatusReferenceRow;
    if (supplierGrn.status !== "AWAITING_FINANCE_APPROVAL") {
      return NextResponse.json(
        { error: `Supplier GRN is not awaiting approval. Current status: ${supplierGrn.status}` },
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

    const message = await buildSupplierGrnNotificationMessage({
      grnId: entity_id,
      headline:
        action === "approve"
          ? `Supplier GRN ${supplierGrn.reference_number} approved - stock updated`
          : `Supplier GRN ${supplierGrn.reference_number} rejected by Finance`,
      actorId: user.id,
      actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
      notes,
    });

    for (const r of ["WAREHOUSE_MANAGER", "ADMIN"] as const) {
      try {
        await createNotification({
          user_role: r,
          type: action === "approve" ? "supplier_grn_approved" : "supplier_grn_rejected",
          message,
          related_entity_id: entity_id,
          dispatchChannels: true,
        });
      } catch (notifErr) {
        console.error(`[finance/approvals] notification failed for ${r}`, notifErr);
      }
    }

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

  if (entity_type === "return_request") {
    const { data: rr, error: fetchError } = await supabaseAdmin
      .from("return_requests")
      .select("status, reference_number")
      .eq("id", entity_id)
      .single();

    if (fetchError || !rr) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }
    const returnRequest = rr as StatusReferenceRow;
    if (returnRequest.status !== "AWAITING_FINANCE_APPROVAL") {
      return NextResponse.json(
        {
          error: `Return is not awaiting Finance approval. Current status: ${returnRequest.status}`,
        },
        { status: 409 },
      );
    }

    const ref = returnRequest.reference_number;

    if (action === "approve") {
      const { error: rpcError } = await supabaseAdmin.rpc("process_return_stock_credit", {
        p_return_request_id: entity_id,
        p_approved_by: user.id,
        p_notes: notes ?? null,
      });
      if (rpcError) throw rpcError;

      const message = await buildReturnNotificationMessage({
        returnId: entity_id,
        headline: `Return ${ref} approved by Finance - stock restored`,
        actorId: user.id,
        actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
        notes,
      });

      for (const r of ["BU_MANAGER", "UNIT_STAFF", "WAREHOUSE_MANAGER"] as const) {
        await createNotification({
          user_role: r,
          type: "return_stock_restored",
          message,
          related_entity_id: entity_id,
          dispatchChannels: true,
        });
      }
    } else {
      const { error: updateError } = await supabaseAdmin
        .from("return_requests")
        .update({
          status: "REJECTED",
          finance_approved_by: user.id,
          finance_approved_at: new Date().toISOString(),
          finance_approval_notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entity_id);

      if (updateError) throw updateError;

      const message = await buildReturnNotificationMessage({
        returnId: entity_id,
        headline: `Return ${ref} was rejected by Finance`,
        actorId: user.id,
        actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
        notes,
      });

      for (const r of ["BU_MANAGER", "WAREHOUSE_MANAGER"] as const) {
        await createNotification({
          user_role: r,
          type: "return_rejected_by_finance",
          message,
          related_entity_id: entity_id,
          dispatchChannels: true,
        });
      }
    }

    await writeAuditLog({
      entity_type: "return_request",
      entity_id,
      action: `finance_${action}`,
      performed_by: user.id,
      new_value: { notes },
    });

    return NextResponse.json({
      id: entity_id,
      status: action === "approve" ? "STOCK_RESTORED" : "REJECTED",
    });
  }

  if (entity_type === "intra_transfer") {
    const { data: iwt, error: fetchError } = await supabaseAdmin
      .from("intra_warehouse_transfers")
      .select(
        `id, reference_number, status, product_id, quantity, from_sbu_id, to_sbu_id, notes,
         products ( id, name, sku, unit_of_measure ),
         to_sbu:sbus!intra_warehouse_transfers_to_sbu_id_fkey ( id, name, code ),
         from_sbu:sbus!intra_warehouse_transfers_from_sbu_id_fkey ( id, name, code )`,
      )
      .eq("id", entity_id)
      .single();

    if (fetchError || !iwt) {
      return NextResponse.json({ error: "Intra-transfer not found" }, { status: 404 });
    }
    const intraTransfer = iwt as StatusReferenceRow;
    if (intraTransfer.status !== "PENDING_FINANCE_APPROVAL") {
      return NextResponse.json(
        {
          error: `Intra-transfer is not awaiting approval. Current status: ${intraTransfer.status}`,
        },
        { status: 409 },
      );
    }

    const ref = intraTransfer.reference_number;

    if (action === "approve") {
      const { error: rpcError } = await supabaseAdmin.rpc("approve_intra_transfer", {
        p_transfer_id: entity_id,
        p_approved_by: user.id,
        p_notes: notes ?? null,
      });

      if (rpcError) {
        console.error("approve_intra_transfer RPC failed", rpcError);
        return NextResponse.json({ error: rpcError.message }, { status: 400 });
      }

      // Notify both Warehouse Manager and BU Manager of the receiving SBU
      const message = await buildIntraTransferNotificationMessage({
        transferId: entity_id,
        headline: `Intra-transfer ${ref} approved by Finance - stock updated`,
        actorId: user.id,
        actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
        notes,
      });

      await Promise.all([
        createNotification({
          user_role: "WAREHOUSE_MANAGER",
          type: "intra_transfer_approved",
          message,
          related_entity_id: entity_id,
          dispatchChannels: true,
        }),
        createNotification({
          user_role: "BU_MANAGER",
          type: "intra_transfer_approved",
          message,
          related_entity_id: entity_id,
        }),
      ]).catch((e) => console.error("intra-transfer approval notify failed", e));
    } else {
      const { error: updateError } = await supabaseAdmin
        .from("intra_warehouse_transfers")
        .update({
          status: "CANCELLED",
          finance_approved_by: user.id,
          finance_approved_at: new Date().toISOString(),
          finance_notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entity_id);

      if (updateError) throw updateError;

      const message = await buildIntraTransferNotificationMessage({
        transferId: entity_id,
        headline: `Intra-transfer ${ref} rejected by Finance`,
        actorId: user.id,
        actorLabel: role === "ADMIN" ? "Admin approver" : "Finance approver",
        notes,
      });

      await createNotification({
        user_role: "WAREHOUSE_MANAGER",
        type: "intra_transfer_rejected",
        message,
        related_entity_id: entity_id,
        dispatchChannels: true,
      });
    }

    await writeAuditLog({
      entity_type: "intra_warehouse_transfer",
      entity_id,
      action: `finance_${action}`,
      performed_by: user.id,
      new_value: { notes },
    });

    return NextResponse.json({
      id: entity_id,
      status: action === "approve" ? "COMPLETED" : "CANCELLED",
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

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "FINANCE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    transfersResult,
    grnsResult,
    proposalsResult,
    returnsResult,
    intraTransfersResult,
    approvedTodayResult,
    rejectedTodayResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("transfer_requests")
      .select("*, sbus(id, name), transfer_line_items(*, products(id, name, sku, unit_cost))")
      .eq("status", "PENDING_APPROVAL")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("supplier_grns")
      .select("*, supplier_grn_line_items(*, products(id, name, sku))")
      .eq("status", "AWAITING_FINANCE_APPROVAL")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("variance_proposals")
      .select(
        `id, proposal_notes, proposed_by, created_at, updated_at,
         transfer_requests ( id, reference_number, sbu_id ),
         variance_proposal_lines (
           id, product_id, variance_quantity,
           recommended_resolution, finance_decision, finance_decision_notes,
           products ( id, name, sku, unit_cost )
         )`,
      )
      .eq("status", "PENDING_FINANCE_REVIEW")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("return_requests")
      .select(
        `id, reference_number, status, reason, notes, sbu_id, raised_by,
         received_by, received_at, created_at, updated_at,
         sbus ( id, name ),
         return_line_items (
           id, product_id, quantity_to_return, quantity_received,
           products ( id, name, sku, unit_cost, unit_of_measure )
         )`,
      )
      .eq("status", "AWAITING_FINANCE_APPROVAL")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("intra_warehouse_transfers")
      .select(
        `id, reference_number, status, product_id, quantity, from_sbu_id, to_sbu_id,
         notes, transferred_by, transfer_date, created_at,
         products ( id, name, sku, unit_of_measure, unit_cost ),
         to_sbu:sbus!intra_warehouse_transfers_to_sbu_id_fkey ( id, name, code ),
         from_sbu:sbus!intra_warehouse_transfers_from_sbu_id_fkey ( id, name, code )`,
      )
      .eq("status", "PENDING_FINANCE_APPROVAL")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("transfer_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "APPROVED_FOR_ISSUE")
      .gte("approved_at", todayStart.toISOString()),
    supabaseAdmin
      .from("transfer_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "CANCELLED")
      .gte("updated_at", todayStart.toISOString()),
  ]);

  // Enrich transfer requests with requester full_name from profiles
  const transfers = (transfersResult.data ?? []) as RequesterRow[];
  const raisedByIds = [...new Set(transfers.map((t) => t.raised_by).filter(Boolean))];
  let profileMap: Record<string, string> = {};

  // Collect all user IDs needing name resolution (transfers + variance proposals + intra-transfers)
  const proposals = (proposalsResult.data ?? []) as ProposalRow[];
  const intraTransfers = (intraTransfersResult.data ?? []) as IntraTransferListRow[];
  const proposerIds = [...new Set(proposals.map((p) => p.proposed_by).filter(Boolean))];
  const intraTransferredByIds = [
    ...new Set(intraTransfers.map((t) => t.transferred_by).filter(Boolean)),
  ];
  const allProfileIds = [...new Set([...raisedByIds, ...proposerIds, ...intraTransferredByIds])];

  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", allProfileIds);
    if (profiles) {
      profileMap = Object.fromEntries(
        (profiles as ProfileRow[]).map((p) => [p.id, p.full_name ?? ""]),
      );
    }
  }

  const enrichedTransfers = transfers.map((t) => ({
    ...t,
    requester_name: t.raised_by ? (profileMap[t.raised_by] ?? null) : null,
  }));

  const enrichedProposals = proposals.map((p) => ({
    ...p,
    proposer_name: p.proposed_by ? (profileMap[p.proposed_by] ?? null) : null,
  }));

  const enrichedIntraTransfers = intraTransfers.map((t) => ({
    ...t,
    transferred_by_name: t.transferred_by ? (profileMap[t.transferred_by] ?? null) : null,
  }));

  return NextResponse.json({
    transfer_requests: enrichedTransfers,
    supplier_grns: grnsResult.data ?? [],
    variance_proposals: enrichedProposals,
    return_requests: returnsResult.data ?? [],
    intra_transfers: enrichedIntraTransfers,
    approved_today: approvedTodayResult.count ?? 0,
    rejected_today: rejectedTodayResult.count ?? 0,
  });
}
