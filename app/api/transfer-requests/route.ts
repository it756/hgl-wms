import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email";

export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // basic role check (assumes role stored in user.user_metadata.role)
    const role = (user.user_metadata as any)?.role || "";
    if (role !== "BU_MANAGER" && role !== "UNIT_STAFF")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isUnitStaff = role === "UNIT_STAFF";

    const body = await req.json();
    const { required_date, notes, lines, requesting_unit_id, estimated_value } = body;

    if (!Array.isArray(lines) || lines.length === 0)
      return NextResponse.json({ error: "No line items" }, { status: 400 });

    if (!requesting_unit_id)
      return NextResponse.json({ error: "requesting_unit_id is required." }, { status: 422 });

    // Resolve the user's real sbu_id from their profile (never trust client-sent value)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.sbu_id)
      return NextResponse.json(
        { error: "Your account has no SBU assigned. Contact an administrator." },
        { status: 422 },
      );
    const sbu_id = profile.sbu_id;

    // Verify the requesting unit belongs to the user's SBU
    const { data: unitCheck, error: unitCheckError } = await supabaseAdmin
      .from("sbu_units")
      .select("sbu_id, is_active")
      .eq("id", requesting_unit_id)
      .single();
    if (unitCheckError || !unitCheck)
      return NextResponse.json({ error: "Requesting unit not found." }, { status: 422 });
    if (unitCheck.sbu_id !== sbu_id)
      return NextResponse.json(
        { error: "Requesting unit does not belong to your SBU." },
        { status: 422 },
      );
    if (!unitCheck.is_active)
      return NextResponse.json({ error: "Requesting unit is inactive." }, { status: 422 });

    // Validate stock availability for each requested line item
    const productIds: string[] = lines.map((l: any) => l.product_id);
    const { data: products, error: stockError } = await supabaseAdmin
      .from("products")
      .select("id, name, stock_quantity")
      .in("id", productIds);
    if (stockError) throw stockError;

    const stockMap = new Map<string, { name: string; stock_quantity: number }>(
      (products ?? []).map((p: any) => [p.id, { name: p.name, stock_quantity: p.stock_quantity }]),
    );

    for (const line of lines) {
      const product = stockMap.get(line.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${line.product_id} not found.` },
          { status: 422 },
        );
      }
      if (line.requested_quantity <= 0) {
        return NextResponse.json(
          { error: `Requested quantity for "${product.name}" must be greater than zero.` },
          { status: 422 },
        );
      }
      if (line.requested_quantity > product.stock_quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}": requested ${line.requested_quantity}, available ${product.stock_quantity}.`,
          },
          { status: 422 },
        );
      }
    }

    // generate a simple reference (TRF-YYYY-NNNNN)
    const now = new Date();
    const year = now.getFullYear();
    const refSeed = Math.floor(Math.random() * 90000 + 10000);
    const reference_number = `TRF-${year}-${refSeed}`;

    // Determine initial status and finance approval flag based on role and threshold
    let initialStatus: string;
    let requiresFinanceApproval: boolean;

    if (isUnitStaff) {
      // Unit staff requests always require BU approval first, then Finance approval
      initialStatus = "PENDING_BU_APPROVAL";
      requiresFinanceApproval = true;
    } else {
      // BU_MANAGER: always requires Finance approval before warehouse can issue
      initialStatus = "PENDING_APPROVAL";
      requiresFinanceApproval = true;
    }

    const { data: trData, error: trError } = await supabaseAdmin
      .from("transfer_requests")
      .insert([
        {
          reference_number,
          sbu_id,
          requesting_unit_id,
          raised_by: user.id,
          status: initialStatus,
          required_date,
          notes,
          estimated_value: estimated_value ?? null,
          requires_finance_approval: requiresFinanceApproval,
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
    const { error: liError } = await supabaseAdmin.from("transfer_line_items").insert(lineInserts);
    if (liError) throw liError;

    if (isUnitStaff) {
      // Notify BU_MANAGER(s) in the same SBU that a new request awaits their approval
      await supabaseAdmin.from("notifications").insert([
        {
          user_role: "BU_MANAGER",
          type: "transfer_request_pending_bu_approval",
          message: `Transfer ${reference_number} requires your approval`,
          related_entity_id: transferId,
        },
      ]);
    } else {
      // BU_MANAGER-raised: notify warehouse (or finance if requires approval)
      const notifyRole = requiresFinanceApproval ? "FINANCE_MANAGER" : "WAREHOUSE_MANAGER";
      await supabaseAdmin.from("notifications").insert([
        {
          user_role: notifyRole,
          type: "transfer_request_submitted",
          message: `New transfer ${reference_number}`,
          related_entity_id: transferId,
        },
      ]);

      // optionally send an email (best-effort)
      try {
        const warehouseEmail = process.env.WAREHOUSE_MANAGER_EMAIL;
        if (warehouseEmail && !requiresFinanceApproval) {
          await sendEmail(
            warehouseEmail,
            `New transfer request ${reference_number}`,
            `<p>New transfer request ${reference_number} raised by ${user.email}</p>`,
          );
        }
      } catch (e) {
        console.error("Email send failed", e);
      }
    }

    return NextResponse.json({ id: transferId, reference_number }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
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
      .select(
        "*, sbus(id, name), sbu_units(id, name, code), transfer_line_items(*, products(id, name, sku, stock_quantity, unit_of_measure, unit_cost, warehouse_location))",
      )
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
