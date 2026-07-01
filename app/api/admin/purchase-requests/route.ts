import { NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "../../../../lib/supabaseServer";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/admin/purchase-requests
 * Returns purchase requests pending internal control approval, and optionally filtered by status.
 * ADMIN only.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING_INTERNAL_CONTROL_APPROVAL";
  const parsedLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50, 200);
  const parsedOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const { data, error } = await supabaseAdmin
    .from("purchase_requests")
    .select(
      `id, reference_number, status, supplier_name, procurement_email, estimated_total,
       procurement_action, procurement_notes, procurement_actioned_at, procurement_document_url,
       notes, created_at, updated_at,
       sbus(id, name, code),
       purchase_request_line_items(id, product_name, sku, quantity_requested, unit_of_measure, unit_cost)`,
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
