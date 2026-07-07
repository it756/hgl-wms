import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";
import {
  buildGrnNotificationMessage,
} from "../../../lib/notifications/messages";

interface AtomicGrnResult {
  grn_id: string;
  status: string;
  has_variance: boolean;
  proposal_id: string | null;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden")) return 403;
  if (message.includes("required") || message.includes("at least one")) return 400;
  return 500;
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (role !== "UNIT_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { transfer_request_id, date_received, items, condition_notes } = body;

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "No items" }, { status: 400 });

    const { data, error: rpcError } = await supabaseAdmin.rpc("submit_grn_atomic", {
      p_actor_id: user.id,
      p_transfer_request_id: transfer_request_id,
      p_date_received: date_received ?? null,
      p_condition_notes: condition_notes ?? null,
      p_items: items,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message },
        { status: statusForRpcError(rpcError.message) },
      );
    }

    const result = data as AtomicGrnResult;
    const grnId = result.grn_id;
    const newStatus = result.status;
    const hasVariance = result.has_variance;
    const proposalId = result.proposal_id;

    if (hasVariance && proposalId) {
      const proposalMessage = await buildGrnNotificationMessage({
        grnId,
        headline: "Variance proposal auto-raised from receipt — pending Finance review",
        actorId: user.id,
        actorLabel: "Received by",
        notes: condition_notes,
      });
      await createNotification({
        related_entity_id: proposalId,
        type: "variance_proposal_submitted",
        message: proposalMessage,
        user_role: "FINANCE_MANAGER",
        dispatchChannels: true,
      });
    }

    // notify warehouse manager on variance
    if (hasVariance) {
      const grnVarianceMessage = await buildGrnNotificationMessage({
        grnId,
        headline: "A goods receipt reported a variance against the issued quantity",
        actorId: user.id,
        actorLabel: "Received by",
        notes: condition_notes,
      });
      await createNotification({
        related_entity_id: transfer_request_id,
        type: "grn_variance",
        message: grnVarianceMessage,
        user_role: "WAREHOUSE_MANAGER",
        dispatchChannels: true,
      });
    }

    return NextResponse.json({ grnId, status: newStatus }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
