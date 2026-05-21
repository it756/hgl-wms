import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import type { UserRole } from "../../../../lib/models/user";

const VALID_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
];

/** GET /api/admin/users — list all profiles (ADMIN only) */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role") ?? undefined;
  const sbuId = url.searchParams.get("sbu_id") ?? undefined;
  const active = url.searchParams.get("is_active");

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sbu_id, is_active, created_at")
    .order("created_at", { ascending: false });

  if (role) query = query.eq("role", role);
  if (sbuId) query = query.eq("sbu_id", sbuId);
  if (active !== null && active !== undefined) query = query.eq("is_active", active === "true");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull emails from auth.users via admin API (batch)
  const userIds = (data ?? []).map((p: any) => p.id);
  const emailMap: Record<string, string> = {};
  for (const id of userIds) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authUser?.user) emailMap[id] = authUser.user.email ?? "";
  }

  const enriched = (data ?? []).map((p: any) => ({ ...p, email: emailMap[p.id] ?? "" }));
  return NextResponse.json(enriched);
}
