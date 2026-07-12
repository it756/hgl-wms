import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/** GET /api/admin/sbu-units — list SBU units for admin assignment flows */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const sbuId = url.searchParams.get("sbu_id") ?? undefined;

  let query = supabaseAdmin
    .from("sbu_units")
    .select("id, name, code, sbu_id, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (sbuId) query = query.eq("sbu_id", sbuId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}