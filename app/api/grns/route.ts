import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email";

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

    // determine variance
    let hasVariance = false;
    for (const it of items) {
      if (Number(it.quantity_received) !== Number(it.issued_quantity)) {
        hasVariance = true;
        break;
      }
    }

    const { data: grnData, error: grnError } = await supabaseAdmin
      .from("grns")
      .insert([
        {
          transfer_request_id,
          received_by: user.id,
          date_received,
          condition_notes,
          has_variance: hasVariance,
        },
      ])
      .select()
      .single();
    if (grnError) throw grnError;

    const grnId = (grnData as any).id;
    const lineInserts = items.map((i: any) => ({
      grn_id: grnId,
      product_id: i.product_id,
      issued_quantity: i.issued_quantity,
      quantity_received: i.quantity_received,
    }));
    const { data: insertedLines, error: liError } = await supabaseAdmin
      .from("grn_line_items")
      .insert(lineInserts)
      .select("id, product_id, issued_quantity, quantity_received");
    if (liError) {
      // Roll back the orphaned GRN header so we don't leave empty GRN records
      await supabaseAdmin.from("grns").delete().eq("id", grnId);
      throw liError;
    }

    // update transfer status
    const newStatus = hasVariance ? "COMPLETED_WITH_VARIANCE" : "COMPLETED";
    await supabaseAdmin
      .from("transfer_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", transfer_request_id);

    // notify warehouse manager on variance
    if (hasVariance) {
      await supabaseAdmin.from("notifications").insert([
        {
          related_entity_id: transfer_request_id,
          type: "grn_variance",
          message: "GRN reported a variance",
          user_role: "WAREHOUSE_MANAGER",
        },
      ]);
      const wmEmail = process.env.WAREHOUSE_MANAGER_EMAIL;
      if (wmEmail) {
        try {
          await sendEmail(
            wmEmail,
            `Variance reported for transfer ${transfer_request_id}`,
            `<p>Variance detected on transfer ${transfer_request_id}</p>`,
          );
        } catch (e) {
          console.error("Email failed", e);
        }
      }

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
              await supabaseAdmin.from("notifications").insert([
                {
                  related_entity_id: proposalId,
                  type: "variance_proposal_submitted",
                  message: `Variance proposal auto-raised from receipt — pending Finance review`,
                  user_role: "FINANCE_MANAGER",
                },
              ]);
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
