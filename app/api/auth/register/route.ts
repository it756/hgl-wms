import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import type { UserRole } from "../../../../lib/models/user";

const VALID_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
];

/**
 * POST /api/auth/register
 * Admin-only: create a new user with a role and optional SBU.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.split(" ")[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is an ADMIN
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callerRole = (callerData.user.user_metadata as any)?.role ?? "";
  if (callerRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, role, sbu_id, whatsapp_number } = body;

  if (!email || !password || !role) {
    return NextResponse.json({ error: "email, password and role are required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  // Password policy: min 8 chars, one number, one special char
  const pwPolicy = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?])(.{8,})$/;
  if (!pwPolicy.test(password)) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters and contain at least one number and one special character",
      },
      { status: 400 },
    );
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, sbu_id: sbu_id ?? null, full_name: full_name ?? null },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Upsert profile
  const userId = newUser.user.id;
  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: full_name ?? null,
    role,
    sbu_id: sbu_id ?? null,
    whatsapp_number: whatsapp_number ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ id: userId, email, role }, { status: 201 });
}
