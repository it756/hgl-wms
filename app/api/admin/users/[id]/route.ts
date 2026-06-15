import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import type { UserRole } from "../../../../../lib/models/user";

const VALID_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
];

const PW_POLICY = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?])(.{8,})$/;

/** PATCH /api/admin/users/[id] — update user profile, role, SBU, email, password, or active status (ADMIN only) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((caller.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role, sbu_id, full_name, whatsapp_number, email, is_active, password } = body;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  if (password !== undefined && password !== "") {
    if (!PW_POLICY.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters with at least one number and one special character",
        },
        { status: 400 },
      );
    }
  }

  // Prevent admin from deactivating their own account
  if (is_active === false && id === caller.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  // --- Profile table update ---
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role !== undefined) profileUpdates.role = role;
  if (sbu_id !== undefined) profileUpdates.sbu_id = sbu_id;
  if (full_name !== undefined) profileUpdates.full_name = full_name;
  if (whatsapp_number !== undefined) profileUpdates.whatsapp_number = whatsapp_number;
  if (is_active !== undefined) profileUpdates.is_active = is_active;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // --- Auth user update (email, password, ban, metadata) ---
  const authUpdate: Record<string, unknown> = {};
  const metadataUpdate: Record<string, unknown> = {};

  if (email !== undefined) authUpdate.email = email;
  if (password !== undefined && password !== "") authUpdate.password = password;

  if (role !== undefined) metadataUpdate.role = role;
  if (sbu_id !== undefined) metadataUpdate.sbu_id = sbu_id;
  if (full_name !== undefined) metadataUpdate.full_name = full_name;

  if (is_active === false) {
    authUpdate.ban_duration = "876600h"; // ~100 years
  } else if (is_active === true) {
    authUpdate.ban_duration = "none";
  }

  if (Object.keys(metadataUpdate).length > 0) authUpdate.user_metadata = metadataUpdate;

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
