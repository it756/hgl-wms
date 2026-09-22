import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * Lists transfer requests that still need a GRN from the caller's own unit.
 * A single transfer request may fan out to several destination units, so an
 * ISSUED/PARTIALLY_RECEIVED request only appears here if the caller's unit
 * has pending line items and hasn't already submitted its own GRN.
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (role !== "UNIT_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("unit_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.unit_id)
      return NextResponse.json(
        { error: "Your account has no unit assigned. Contact an administrator." },
        { status: 422 },
      );
    const unitId = profile.unit_id;

    // Transfer requests carrying at least one line item for this unit.
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("transfer_requests")
      .select(
        "*, sbus(id, name), transfer_line_items!inner(*, products(id, name, sku, stock_quantity, unit_of_measure, warehouse_location))",
      )
      .in("status", ["ISSUED", "PARTIALLY_RECEIVED"])
      .eq("transfer_line_items.destination_unit_id", unitId)
      .order("created_at", { ascending: false });
    if (candidatesError) throw candidatesError;

    // Exclude requests where this unit has already submitted its GRN.
    const candidateIds = (candidates ?? []).map((t: any) => t.id);
    let alreadySubmitted = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: existingGrns, error: grnsError } = await supabaseAdmin
        .from("grns")
        .select("transfer_request_id")
        .eq("unit_id", unitId)
        .in("transfer_request_id", candidateIds);
      if (grnsError) throw grnsError;
      alreadySubmitted = new Set((existingGrns ?? []).map((g: any) => g.transfer_request_id));
    }

    const pending = (candidates ?? [])
      .filter((t: any) => !alreadySubmitted.has(t.id))
      .map((t: any) => ({
        ...t,
        // Only expose this unit's own line items — sibling destinations are not our concern.
        transfer_line_items: (t.transfer_line_items ?? []).filter(
          (l: any) => l.destination_unit_id === unitId,
        ),
      }));

    return NextResponse.json(pending);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
