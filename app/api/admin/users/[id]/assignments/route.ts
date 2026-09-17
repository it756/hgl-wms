import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { validateAssignmentShape } from "../../../../../../lib/models/roleAssignment";
import type { UserRole } from "../../../../../../lib/models/user";

const VALID_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
  "INTERNAL_CONTROL_OFFICER",
];

async function requireAdmin(req: Request) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((caller.user_metadata as any)?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 }) };
  }
  return { caller };
}

/** GET /api/admin/users/[id]/assignments — list all role assignments for a user (ADMIN only) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data: assignments, error } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id, role, sbu_id, unit_id, is_active, created_at, updated_at")
    .eq("user_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, sbu_id, unit_id")
    .eq("id", id)
    .maybeSingle();

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
      !!profile &&
      a.role === profile.role &&
      (a.sbu_id ?? null) === (profile.sbu_id ?? null) &&
      (a.unit_id ?? null) === (profile.unit_id ?? null),
    created_at: a.created_at,
  }));

  return NextResponse.json(enriched);
}

/** POST /api/admin/users/[id]/assignments — grant a user an additional role assignment (ADMIN only) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { role, sbu_id, unit_id } = body as {
    role?: string;
    sbu_id?: string | null;
    unit_id?: string | null;
  };

  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  const shapeError = validateAssignmentShape({
    role: role as UserRole,
    sbu_id: sbu_id ?? null,
    unit_id: unit_id ?? null,
  });
  if (shapeError) return NextResponse.json({ error: shapeError.error }, { status: 400 });

  const { data: targetUser, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id, active_assignment_id")
    .eq("id", id)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (unit_id) {
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("sbu_units")
      .select("id, sbu_id")
      .eq("id", unit_id)
      .eq("is_active", true)
      .single();
    if (unitError || !unit) {
      return NextResponse.json({ error: "Selected unit was not found" }, { status: 400 });
    }
    if (sbu_id && unit.sbu_id !== sbu_id) {
      return NextResponse.json(
        { error: "Selected unit does not belong to the selected SBU" },
        { status: 400 },
      );
    }
  }

  const { count: existingCount } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);

  const { data: created, error: createError } = await supabaseAdmin
    .from("user_role_assignments")
    .insert({
      user_id: id,
      role,
      sbu_id: sbu_id || null,
      unit_id: unit_id || null,
      is_active: true,
    })
    .select("id, role, sbu_id, unit_id, is_active, created_at")
    .single();

  if (createError) {
    if ((createError as any).code === "23505") {
      return NextResponse.json(
        { error: "The user already has this exact role/SBU/unit assignment" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // A user's very first assignment becomes their active context automatically.
  if (!existingCount) {
    await supabaseAdmin
      .from("profiles")
      .update({
        role: created.role,
        sbu_id: created.sbu_id,
        unit_id: created.unit_id,
        active_assignment_id: created.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json(created, { status: 201 });
}
