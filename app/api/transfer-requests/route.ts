import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";
import { buildTransferNotificationMessage } from "../../../lib/notifications/messages";

interface AtomicTransferResult {
  id: string;
  reference_number: string;
  status: string;
  requires_finance_approval: boolean;
}

function statusForRpcError(message: string): number {
  if (message.includes("insufficient stock")) return 422;
  if (message.includes("not found")) return 404;
  if (message.includes("forbidden")) return 403;
  if (
    message.includes("required") ||
    message.includes("inactive") ||
    message.includes("does not belong")
  ) {
    return 422;
  }
  return 500;
}

function messageForRpcError(message: string): string {
  if (message.includes("insufficient stock")) {
    return message.replace("insufficient stock", "Insufficient stock");
  }
  return message;
}

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

    // generate a simple reference (TRF-YYYY-NNNNN)
    const now = new Date();
    const year = now.getFullYear();
    const refSeed = Math.floor(Math.random() * 90000 + 10000);
    const reference_number = `TRF-${year}-${refSeed}`;

    const sbuId = (user.user_metadata as any)?.sbu_id ?? null;
    if (!sbuId) {
      return NextResponse.json({ error: "User has no SBU assigned" }, { status: 400 });
    }

    const { data: unit, error: unitError } = await supabaseAdmin
      .from("sbu_units")
      .select("sbu_id, is_active")
      .eq("id", requesting_unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Requesting unit not found." }, { status: 422 });
    }
    if (unit.sbu_id !== sbuId) {
      return NextResponse.json(
        { error: "Requesting unit does not belong to your SBU." },
        { status: 422 },
      );
    }
    if (!unit.is_active) {
      return NextResponse.json({ error: "Requesting unit is inactive." }, { status: 422 });
    }

    const productIds = [...new Set(lines.map((line: any) => line.product_id))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, stock_quantity")
      .in("id", productIds);

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    const productMap = new Map((products ?? []).map((product: any) => [product.id, product]));
    for (const line of lines as Array<{ product_id: string; requested_quantity: number }>) {
      const product = productMap.get(line.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${line.product_id}` },
          { status: 404 },
        );
      }

      if (Number(product.stock_quantity) < Number(line.requested_quantity)) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 422 },
        );
      }
    }

    const transferStatus = isUnitStaff ? "PENDING_BU_APPROVAL" : "PENDING_APPROVAL";
    const { data: trData, error: trError } = await supabaseAdmin
      .from("transfer_requests")
      .insert([
        {
          reference_number,
          sbu_id: sbuId,
          requesting_unit_id,
          raised_by: user.id,
          status: transferStatus,
          required_date: required_date ?? null,
          notes: notes ?? null,
          estimated_value: estimated_value ?? null,
          requires_finance_approval: true,
        },
      ])
      .select()
      .single();

    if (trError) {
      return NextResponse.json({ error: trError.message }, { status: 500 });
    }

    const created = trData as AtomicTransferResult;
    const transferId = created.id;

    const lineInsertRows = (lines as Array<{ product_id: string; requested_quantity: number }>).map(
      (line) => ({
        transfer_request_id: transferId,
        product_id: line.product_id,
        requested_quantity: line.requested_quantity,
      }),
    );

    const { error: lineError } = await supabaseAdmin
      .from("transfer_line_items")
      .insert(lineInsertRows);

    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 500 });
    }

    const requiresFinanceApproval = true;

    if (isUnitStaff) {
      // Notify BU_MANAGER(s) in the same SBU that a new request awaits their approval
      const message = await buildTransferNotificationMessage({
        transferId,
        headline: `Transfer ${reference_number} requires your approval`,
        actorId: user.id,
        actorLabel: "Raised by",
      });
      await createNotification({
        user_role: "BU_MANAGER",
        type: "transfer_request_pending_bu_approval",
        message,
        related_entity_id: transferId,
        dispatchChannels: true,
      });
    } else {
      // BU_MANAGER-raised: notify warehouse (or finance if requires approval)
      const notifyRole = requiresFinanceApproval ? "FINANCE_MANAGER" : "WAREHOUSE_MANAGER";
      const message = await buildTransferNotificationMessage({
        transferId,
        headline: `New transfer ${reference_number} raised`,
        actorId: user.id,
        actorLabel: "Raised by",
      });
      await createNotification({
        user_role: notifyRole,
        type: "transfer_request_submitted",
        message,
        related_entity_id: transferId,
        dispatchChannels: true,
      });
    }

    return NextResponse.json(
      { id: transferId, reference_number: created.reference_number },
      { status: 201 },
    );
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
