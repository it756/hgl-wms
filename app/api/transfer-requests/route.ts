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

    // basic role check (assumes role stored in user.user_metadata.role)
    const role = (user.user_metadata as any)?.role || "";
    if (role !== "BU_MANAGER")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { sbu_id, required_date, notes, lines } = body;

    if (!Array.isArray(lines) || lines.length === 0)
      return NextResponse.json({ error: "No line items" }, { status: 400 });

    // generate a simple reference (TRF-YYYY-NNNNN)
    const now = new Date();
    const year = now.getFullYear();
    const refSeed = Math.floor(Math.random() * 90000 + 10000);
    const reference_number = `TRF-${year}-${refSeed}`;

    const { data: trData, error: trError } = await supabaseAdmin
      .from("transfer_requests")
      .insert([
        {
          reference_number,
          sbu_id,
          raised_by: user.id,
          status: "PENDING",
          required_date,
          notes,
        },
      ])
      .select()
      .single();

    if (trError) throw trError;

    const transferId = (trData as any).id;

    // insert line items
    const lineInserts = lines.map((l: any) => ({
      transfer_request_id: transferId,
      product_id: l.product_id,
      requested_quantity: l.requested_quantity,
    }));
    const { error: liError } = await supabaseAdmin
      .from("transfer_line_items")
      .insert(lineInserts);
    if (liError) throw liError;

    // create a notification for warehouse manager(s)
    await supabaseAdmin
      .from("notifications")
      .insert([
        {
          user_role: "WAREHOUSE_MANAGER",
          type: "transfer_request_submitted",
          message: `New transfer ${reference_number}`,
          related_entity_id: transferId,
        },
      ]);

    // optionally send an email (best-effort)
    try {
      const warehouseEmail = process.env.WAREHOUSE_MANAGER_EMAIL;
      if (warehouseEmail) {
        await sendEmail(
          warehouseEmail,
          `New transfer request ${reference_number}`,
          `<p>New transfer request ${reference_number} raised by ${user.email}</p>`,
        );
      }
    } catch (e) {
      // swallow email errors
      console.error("Email send failed", e);
    }

    return NextResponse.json(
      { id: transferId, reference_number },
      { status: 201 },
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    const sbuId = (user.user_metadata as any)?.sbu_id || null;

    let query = supabaseAdmin
      .from("transfer_requests")
      .select("*, transfer_line_items(*)")
      .order("created_at", { ascending: false });

    // Scope BU_MANAGER and UNIT_STAFF to their own SBU
    if ((role === "BU_MANAGER" || role === "UNIT_STAFF") && sbuId) {
      query = query.eq("sbu_id", sbuId);
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}

