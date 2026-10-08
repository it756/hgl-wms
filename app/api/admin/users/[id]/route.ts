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

/** PATCH /api/admin/users/[id] — update user profile, role, SBU/unit, email, password, or active status (ADMIN only) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((caller.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role, sbu_id, unit_id, full_name, whatsapp_number, email, is_active, password } = body;

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

  let nextSbuId = sbu_id;
  let nextUnitId = unit_id;

  if (role !== undefined && role !== "UNIT_STAFF") {
    nextUnitId = null;
  }

  if (nextSbuId === null || nextSbuId === "") {
    nextUnitId = null;
  }

  if (
    role === "UNIT_STAFF" &&
    (nextUnitId === undefined || nextUnitId === null || nextUnitId === "")
  ) {
    return NextResponse.json(
      { error: "Unit Staff users must be assigned to a unit" },
      { status: 400 },
    );
  }

  if (nextUnitId !== undefined && nextUnitId !== null && nextUnitId !== "") {
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("sbu_units")
      .select("id, sbu_id")
      .eq("id", nextUnitId)
      .eq("is_active", true)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Selected unit was not found" }, { status: 400 });
    }

    if (nextSbuId !== undefined && nextSbuId !== null && nextSbuId !== unit.sbu_id) {
      return NextResponse.json(
        { error: "Selected unit does not belong to the selected SBU" },
        { status: 400 },
      );
    }

    if (nextSbuId === undefined) nextSbuId = unit.sbu_id;
  }

  // --- Profile table update ---
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role !== undefined) profileUpdates.role = role;
  if (nextSbuId !== undefined) profileUpdates.sbu_id = nextSbuId || null;
  if (nextUnitId !== undefined) profileUpdates.unit_id = nextUnitId || null;
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
  if (nextSbuId !== undefined) metadataUpdate.sbu_id = nextSbuId || null;
  if (nextUnitId !== undefined) metadataUpdate.unit_id = nextUnitId || null;
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
