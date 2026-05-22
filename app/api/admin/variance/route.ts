import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";

/** GET /api/admin/variance — list COMPLETED_WITH_VARIANCE transfers (ADMIN/WH_MANAGER) */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("transfer_requests")
    .select(
      `id, reference_number, sbu_id, created_at, updated_at,
       grns ( id, has_variance, condition_notes, created_at,
         grn_line_items ( product_id, issued_quantity, quantity_received, variance_notes ) )`,
    )
    .eq("status", "COMPLETED_WITH_VARIANCE")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/admin/variance — record resolution for a variance transfer */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { transfer_request_id, resolution_notes } = body;
  if (!transfer_request_id || !resolution_notes) {
    return NextResponse.json(
      { error: "transfer_request_id and resolution_notes are required" },
      { status: 400 },
    );
  }

  // Transition to COMPLETED and record notes
  const { data, error } = await supabaseAdmin
    .from("transfer_requests")
    .update({
      status: "COMPLETED",
      variance_resolution_notes: resolution_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transfer_request_id)
    .eq("status", "COMPLETED_WITH_VARIANCE")
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "Transfer not found or not in COMPLETED_WITH_VARIANCE" },
      { status: 404 },
    );
  }

  await writeAuditLog({
    entity_type: "transfer_request",
    entity_id: transfer_request_id,
    action: "variance_resolved",
    performed_by: user.id,
    details: { resolution_notes },
  });

  return NextResponse.json(data);
}
