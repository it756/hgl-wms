import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserFromAuthHeader,
} from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email";

export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (role !== "UNIT_STAFF")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
      quantity_received: i.quantity_received,
    }));
    const { error: liError } = await supabaseAdmin
      .from("grn_line_items")
      .insert(lineInserts);
    if (liError) throw liError;

    // update transfer status
    const newStatus = hasVariance ? "COMPLETED_WITH_VARIANCE" : "COMPLETED";
    await supabaseAdmin
      .from("transfer_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", transfer_request_id);

    // notify warehouse manager on variance
    if (hasVariance) {
      await supabaseAdmin
        .from("notifications")
        .insert([
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
    }

    return NextResponse.json({ grnId, status: newStatus }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal" },
      { status: 500 },
    );
  }
}
