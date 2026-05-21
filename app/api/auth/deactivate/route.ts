import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * POST /api/auth/deactivate
 * Admin-only: deactivate a user account. Soft-deletes; preserves audit history.
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  if (user_id === user.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  await supabaseAdmin.from("profiles").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", user_id);
  await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" }); // ~100 years

  return NextResponse.json({ message: "User deactivated" });
}
