import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { createPurchaseRequest } from "../../../lib/services/purchaseRequestService";
import type { PurchaseRequestCreateInput } from "../../../lib/models/purchaseRequest";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/purchase-requests
 * SBU_MANAGER sees their own SBU's requests.
 * ADMIN / FINANCE_MANAGER / WAREHOUSE_MANAGER see all or filtered.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  const allowedRoles = ["BU_MANAGER", "ADMIN", "FINANCE_MANAGER", "WAREHOUSE_MANAGER"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = supabaseAdmin
    .from("purchase_requests")
    .select(
      `id, reference_number, status, supplier_name, procurement_email, estimated_total,
       procurement_action, internal_control_action, created_at, updated_at,
       sbus(id, name, code),
       purchase_request_line_items(id, product_name, sku, quantity_requested, unit_of_measure, unit_cost)`,
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // BU_MANAGER only sees their own SBU's requests
  if (role === "BU_MANAGER") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id")
      .eq("id", user.id)
      .single();
    if (!profile?.sbu_id) {
      return NextResponse.json({ error: "No SBU assigned to your account." }, { status: 422 });
    }
    query = query.eq("sbu_id", profile.sbu_id);
  }

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/purchase-requests
 * BU_MANAGER creates a new purchase request (starts as DRAFT).
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "BU_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("sbu_id")
    .eq("id", user.id)
    .single();

  const body = (await req.json()) as PurchaseRequestCreateInput;

  // Always use the user's actual SBU — never trust a client-supplied sbu_id
  const sbu_id = profile?.sbu_id;
  if (!sbu_id) {
    return NextResponse.json({ error: "No SBU assigned to your account." }, { status: 422 });
  }

  if (!body.procurement_email) {
    return NextResponse.json({ error: "procurement_email is required." }, { status: 400 });
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
  }

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

  try {
    const pr = await createPurchaseRequest({ ...body, sbu_id }, user.id);
    return NextResponse.json({ id: pr.id, reference_number: pr.reference_number }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
