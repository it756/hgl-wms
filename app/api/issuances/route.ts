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
    if (role !== "WAREHOUSE_MANAGER")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { transfer_request_id, items, issue_date, logistics_notes } = body;

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "No items" }, { status: 400 });

    // Verify transfer belongs to user's SBU (based on user metadata) to enforce scoped visibility.
    try {
      const { data: tr } = await supabaseAdmin
        .from('transfer_requests')
        .select('sbu_id')
        .eq('id', transfer_request_id)
        .single();
      const userSbu = (user.user_metadata as any)?.sbu_id;
      if (userSbu && (tr as any)?.sbu_id !== userSbu) {
        return NextResponse.json({ error: 'Forbidden: SBU mismatch' }, { status: 403 });
      }
    } catch (e) {
      console.error('SBU check failed', e);
      // proceed — the process_issuance RPC performs core validations; this is a best-effort guard
    }

    // Use DB-side RPC to process issuance atomically (inserts, stock decrements, status transition)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("process_issuance", {
      p_transfer_request_id: transfer_request_id,
      p_issued_by: user.id,
      p_items: items,
      p_issue_date: issue_date || new Date().toISOString(),
      p_logistics_notes: logistics_notes || null,
    });
    if (rpcError) {
      console.error('process_issuance RPC failed', rpcError);
      throw rpcError;
    }
    const issuanceId = (rpcData as any) || null;

    // notify BU Manager and Unit Staff for the SBU (best-effort)
    await supabaseAdmin.from("notifications").insert([
      {
        related_entity_id: transfer_request_id,
        type: "goods_issued",
        message: "Goods have been issued",
        user_role: "BU_MANAGER",
      },
      {
        related_entity_id: transfer_request_id,
        type: "goods_issued",
        message: "Goods have been issued",
        user_role: "UNIT_STAFF",
      },
    ]);

    try {
      const { data: tr } = await supabaseAdmin
        .from("transfer_requests")
        .select("reference_number,sbu_id")
        .eq("id", transfer_request_id)
        .single();
      const ref = (tr as any)?.reference_number;
      const buEmail = process.env.BU_MANAGER_EMAIL;
      if (buEmail)
        await sendEmail(
          buEmail,
          `Goods issued ${ref}`,
          `<p>Goods for ${ref} have been issued.</p>`,
        );
    } catch (e) {
      console.error("BU notify/email failed", e);
    }

    return NextResponse.json({ issuanceId }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal" },
      { status: 500 },
    );
  }
}
