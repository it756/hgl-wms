import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";

interface AtomicGrnResult {
  grn_id: string;
  status: string;
  has_variance: boolean;
  proposal_id: string | null;
}

function statusForRpcError(message: string): number {
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden") || message.includes("does not match")) return 403;
  if (message.includes("must be ISSUED")) return 409;
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

    // notify warehouse manager on variance
    if (result.has_variance) {
      await createNotification({
        related_entity_id: transfer_request_id,
        type: "grn_variance",
        message: "GRN reported a variance",
        user_role: "WAREHOUSE_MANAGER",
        dispatchChannels: true,
      });

      if (result.proposal_id) {
        await createNotification({
          related_entity_id: result.proposal_id,
          type: "variance_proposal_submitted",
          message: `Variance proposal auto-raised from receipt - pending Finance review`,
          user_role: "FINANCE_MANAGER",
          dispatchChannels: true,
        });
      }
    }

    return NextResponse.json({ grnId, status: newStatus }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
