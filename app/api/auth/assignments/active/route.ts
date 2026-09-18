import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";

/** POST /api/auth/assignments/active — switch the caller's active role/SBU/unit context */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { assignment_id } = body as { assignment_id?: string };
  if (!assignment_id) {
    return NextResponse.json({ error: "assignment_id is required" }, { status: 400 });
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("user_role_assignments")
    .select("id, user_id, role, sbu_id, unit_id, is_active")
    .eq("id", assignment_id)
    .maybeSingle();

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  if (!assignment || assignment.user_id !== user.id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  if (!assignment.is_active) {
    return NextResponse.json({ error: "This role assignment has been disabled" }, { status: 400 });
  }

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      role: assignment.role,
      sbu_id: assignment.sbu_id,
      unit_id: assignment.unit_id,
      active_assignment_id: assignment.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("role, sbu_id, unit_id")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Keep Auth metadata in sync for defense-in-depth (RLS, any JWT-based checks).
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      role: assignment.role,
      sbu_id: assignment.sbu_id,
      unit_id: assignment.unit_id,
    },
  });

  return NextResponse.json({ success: true, active: updatedProfile });
}
