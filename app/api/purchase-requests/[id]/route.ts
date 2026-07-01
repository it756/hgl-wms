import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { updatePurchaseRequest } from "../../../../lib/services/purchaseRequestService";
import type { PurchaseRequestUpdateInput } from "../../../../lib/models/purchaseRequest";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/purchase-requests/[id]
 * Returns a single purchase request with line items.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  const allowedRoles = ["BU_MANAGER", "ADMIN", "FINANCE_MANAGER", "WAREHOUSE_MANAGER"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("purchase_requests")
    .select(
      `*, sbus(id, name, code),
       purchase_request_line_items(*)`,
    )
    .eq("id", id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Purchase request not found" }, { status: 404 });

  // BU_MANAGER can only see their own SBU's requests
  if (role === "BU_MANAGER") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id")
      .eq("id", user.id)
      .single();
    if ((data as { sbu_id: string }).sbu_id !== profile?.sbu_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/purchase-requests/[id]
 * BU_MANAGER can edit while in DRAFT or PROCUREMENT_CHANGES_REQUESTED.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "BU_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  // Verify ownership for BU_MANAGER
  if (role === "BU_MANAGER") {
    const { data: existing } = await supabaseAdmin
      .from("purchase_requests")
      .select("created_by, sbu_id")
      .eq("id", id)
      .single();
    if (!existing)
      return NextResponse.json({ error: "Purchase request not found" }, { status: 404 });
    if ((existing as { created_by: string }).created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden: not the owner" }, { status: 403 });
    }
  }

  const body = (await req.json()) as PurchaseRequestUpdateInput;

  if (body.lines) {
    for (const line of body.lines) {
      if (!line.product_name?.trim()) {
        return NextResponse.json(
          { error: "Each line item must have a product_name." },
          { status: 400 },
        );
      }
      if (!Number.isInteger(line.quantity_requested) || line.quantity_requested < 1) {
        return NextResponse.json(
          { error: `quantity_requested must be a positive integer for "${line.product_name}".` },
          { status: 400 },
        );
      }
    }
  }

  try {
    const updated = await updatePurchaseRequest(id, body, user.id);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("cannot be edited")
      ? 409
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
