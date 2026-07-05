import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createNotification } from "../../../lib/services/notificationService";

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

    const { data, error: rpcError } = await supabaseAdmin.rpc("create_transfer_request_atomic", {
      p_actor_id: user.id,
      p_reference_number: reference_number,
      p_requesting_unit_id: requesting_unit_id,
      p_required_date: required_date ?? null,
      p_notes: notes ?? null,
      p_estimated_value: estimated_value ?? null,
      p_lines: lines,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: messageForRpcError(rpcError.message) },
        { status: statusForRpcError(rpcError.message) },
      );
    }

    const created = data as AtomicTransferResult;
    const transferId = created.id;

    if (isUnitStaff) {
      // Notify BU_MANAGER(s) in the same SBU that a new request awaits their approval
      await createNotification({
        user_role: "BU_MANAGER",
        type: "transfer_request_pending_bu_approval",
        message: `Transfer ${reference_number} requires your approval`,
        related_entity_id: transferId,
        dispatchChannels: true,
      });
    } else {
      // BU_MANAGER-raised: notify warehouse (or finance if requires approval)
      const notifyRole = created.requires_finance_approval
        ? "FINANCE_MANAGER"
        : "WAREHOUSE_MANAGER";
      await createNotification({
        user_role: notifyRole,
        type: "transfer_request_submitted",
        message: `New transfer ${reference_number}`,
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
