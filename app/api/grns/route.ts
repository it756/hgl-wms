import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";
import {
  buildGrnNotificationMessage,
  buildTransferNotificationMessage,
} from "../../../lib/notifications/messages";

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

      // Auto-raise a variance proposal so Finance can see and act on the variance
      // immediately (without waiting for a Warehouse Manager to file one manually).
      try {
        const { data: existingProposal } = await supabaseAdmin
          .from("variance_proposals")
          .select("id")
          .eq("transfer_request_id", transfer_request_id)
          .eq("status", "PENDING_FINANCE_REVIEW")
          .maybeSingle();

        if (!existingProposal) {
          const { data: proposal, error: propError } = await supabaseAdmin
            .from("variance_proposals")
            .insert([
              {
                transfer_request_id,
                grn_id: grnId,
                proposed_by: user.id,
                proposal_notes:
                  condition_notes ??
                  "Auto-raised from receipt — variance detected when staff confirmed quantities.",
                status: "PENDING_FINANCE_REVIEW",
              },
            ])
            .select("id")
            .single();

          if (!propError && proposal) {
            const proposalId = (proposal as any).id;
            const varianceLines = (insertedLines ?? [])
              .map((li: any) => {
                const delta = Number(li.quantity_received ?? 0) - Number(li.issued_quantity ?? 0);
                if (delta === 0) return null;
                return {
                  proposal_id: proposalId,
                  grn_line_item_id: li.id,
                  product_id: li.product_id,
                  variance_quantity: delta,
                  // Shortage → damage write-off; excess → stock reintegration
                  recommended_resolution: delta < 0 ? "damage_writeoff" : "stock_reintegration",
                };
              })
              .filter((row): row is NonNullable<typeof row> => row !== null);

            if (varianceLines.length > 0) {
              await supabaseAdmin.from("variance_proposal_lines").insert(varianceLines);
              const proposalMessage = await buildTransferNotificationMessage({
                transferId: transfer_request_id,
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
          } else if (propError) {
            console.error("Auto variance_proposal insert failed:", propError);
          }
        }
      } catch (e) {
        console.error("Auto variance_proposal flow failed:", e);
      }
    }

    return NextResponse.json({ grnId, status: newStatus }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
