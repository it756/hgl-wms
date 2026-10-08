import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/** GET /api/auth/assignments — list the authenticated user's own role assignments */
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const metadata = (user.user_metadata as any) ?? {};

    const { data: assignments, error } = await supabaseAdmin
      .from("user_role_assignments")
      .select("id, role, sbu_id, unit_id, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sbuIds = [...new Set((assignments ?? []).map((a: any) => a.sbu_id).filter(Boolean))];
    const unitIds = [...new Set((assignments ?? []).map((a: any) => a.unit_id).filter(Boolean))];

    const [{ data: sbus }, { data: units }] = await Promise.all([
      sbuIds.length
        ? supabaseAdmin.from("sbus").select("id, name, code").in("id", sbuIds)
        : Promise.resolve({ data: [] as any[] }),
      unitIds.length
        ? supabaseAdmin.from("sbu_units").select("id, name, code").in("id", unitIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const sbuMap: Record<string, { name: string; code: string }> = {};
    for (const s of sbus ?? []) sbuMap[s.id] = { name: s.name, code: s.code };
    const unitMap: Record<string, { name: string; code: string }> = {};
    for (const u of units ?? []) unitMap[u.id] = { name: u.name, code: u.code };

    const enriched = (assignments ?? []).map((a: any) => ({
      id: a.id,
      role: a.role,
      sbu_id: a.sbu_id,
      sbu_name: a.sbu_id ? (sbuMap[a.sbu_id]?.name ?? null) : null,
      unit_id: a.unit_id,
      unit_name: a.unit_id ? (unitMap[a.unit_id]?.name ?? null) : null,
      is_active: a.is_active,
      is_current:
        a.role === metadata.role &&
        (a.sbu_id ?? null) === (metadata.sbu_id ?? null) &&
        (a.unit_id ?? null) === (metadata.unit_id ?? null),
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 });
  }
}
