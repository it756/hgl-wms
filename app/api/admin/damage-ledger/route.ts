import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/admin/damage-ledger
 * Returns all damage write-off entries with product details, recall status,
 * and enriched user display names.
 * Roles: ADMIN, FINANCE_MANAGER, WAREHOUSE_MANAGER.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "FINANCE_MANAGER", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("damage_ledger")
    .select(
      `id, quantity, unit_cost_at_writeoff, estimated_value, currency,
       writeoff_reason, transfer_reference, written_off_by, written_off_at,
       product_id,
       products ( id, name, sku, unit_of_measure ),
       damage_recalls ( id, status, notes, initiated_by, received_by, received_at, created_at )`,
    )
    .order("written_off_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = data ?? [];

  // Collect all user IDs needing name resolution
  const userIds = [
    ...new Set([
      ...entries.map((e: any) => e.written_off_by).filter(Boolean),
      ...entries
        .flatMap((e: any) => [e.damage_recalls?.initiated_by, e.damage_recalls?.received_by])
        .filter(Boolean),
    ]),
  ];

  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name ?? ""]));
    }
  }

  const enriched = entries.map((e: any) => ({
    ...e,
    written_off_by_name: profileMap[e.written_off_by] ?? null,
    damage_recalls: e.damage_recalls
      ? {
          ...e.damage_recalls,
          initiated_by_name: profileMap[e.damage_recalls.initiated_by] ?? null,
          received_by_name: profileMap[e.damage_recalls.received_by] ?? null,
        }
      : null,
  }));

  return NextResponse.json(enriched);
}
