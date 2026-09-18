import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../../lib/supabaseServer";

async function requireAdmin(req: Request) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((caller.user_metadata as any)?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 }) };
  }
  return { caller };
}

/** PATCH /api/admin/users/[id]/assignments/[assignmentId] — enable/disable a role assignment (ADMIN only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { id, assignmentId } = await params;
  const body = await req.json();
  const { is_active } = body as { is_active?: boolean };

  if (is_active === undefined) {
    return NextResponse.json({ error: "is_active is required" }, { status: 400 });
  }

  const { data: assignment, error: fetchError } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id, user_id, role, sbu_id, unit_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!assignment || assignment.user_id !== id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("user_role_assignments")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .select("id, role, sbu_id, unit_id, is_active")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // If the currently-active context was just disabled, clear the pointer so the
  // assignments UI stops marking it "current"; profiles.role/sbu_id/unit_id are left
  // untouched until the user or an admin explicitly selects a new active assignment.
  if (!is_active) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_assignment_id")
      .eq("id", id)
      .maybeSingle();
    if (profile?.active_assignment_id === assignmentId) {
      await supabaseAdmin
        .from("profiles")
        .update({ active_assignment_id: null, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  }

  return NextResponse.json(updated);
}

/** DELETE /api/admin/users/[id]/assignments/[assignmentId] — remove a role assignment (ADMIN only) */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { id, assignmentId } = await params;

  const { data: assignment, error: fetchError } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id, user_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!assignment || assignment.user_id !== id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "A user must retain at least one role assignment" },
      { status: 400 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("user_role_assignments")
    .delete()
    .eq("id", assignmentId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
