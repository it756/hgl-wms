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

interface BulkUserEntry {
  full_name?: string;
  email: string;
  password: string;
  role: string;
  sbu_code?: string;
  whatsapp_number?: string;
}

/**
 * POST /api/admin/users/bulk
 * Admin-only: create multiple users from a CSV-parsed payload.
 * Body: { users: BulkUserEntry[] }
 * Returns: { results: Array<{ email, success, id?, error? }> }
 */
export async function POST(req: Request) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((caller.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const users: BulkUserEntry[] = body?.users;

  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json(
      { error: "users array is required and must not be empty" },
      { status: 400 },
    );
  }
  if (users.length > 200) {
    return NextResponse.json({ error: "Maximum 200 users per import" }, { status: 400 });
  }

  // Pre-fetch SBUs for code→id lookup
  const { data: sbus } = await supabaseAdmin.from("sbus").select("id, code");
  const sbuMap: Record<string, string> = {};
  for (const s of sbus ?? []) sbuMap[s.code.toUpperCase()] = s.id;

  const results: { email: string; success: boolean; id?: string; error?: string }[] = [];

  for (const entry of users) {
    const { email, password, full_name, role, sbu_code, whatsapp_number } = entry;

    // Basic field validation
    if (!email || !password || !role) {
      results.push({
        email: email ?? "(missing)",
        success: false,
        error: "email, password, and role are required",
      });
      continue;
    }
    if (!VALID_ROLES.includes(role as UserRole)) {
      results.push({ email, success: false, error: `Invalid role: ${role}` });
      continue;
    }
    if (!PW_POLICY.test(password)) {
      results.push({
        email,
        success: false,
        error: "Password must be ≥8 chars with at least one number and one special character",
      });
      continue;
    }

    let sbu_id: string | null = null;
    if (sbu_code) {
      sbu_id = sbuMap[sbu_code.toUpperCase()] ?? null;
      if (!sbu_id) {
        results.push({ email, success: false, error: `Unknown SBU code: ${sbu_code}` });
        continue;
      }
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, sbu_id, full_name: full_name ?? null },
    });

    if (createError) {
      results.push({ email, success: false, error: createError.message });
      continue;
    }

    const userId = newUser.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: full_name ?? null,
      role,
      sbu_id,
      whatsapp_number: whatsapp_number ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    results.push({ email, success: true, id: userId });
  }

  return NextResponse.json({ results }, { status: 207 });
}
