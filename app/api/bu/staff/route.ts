import { NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "../../../../lib/supabaseServer";

const DISABLED_MESSAGE =
  "This endpoint is disabled. Submit staff management requests via /api/bu/staff-requests.";

async function returnDisabledResponse(req: Request) {
  // Keep auth guard so disabled endpoints retain the same 401 behavior for unauthenticated callers.
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}

// GET /api/bu/staff — list staff in the caller's SBU. Management writes stay disabled.
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id, role")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    if (profile.role !== "BU_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!profile.sbu_id) {
      return NextResponse.json({ error: "Your account has no SBU assigned." }, { status: 422 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, role, unit_id, is_active, sbu_units ( id, name, code )",
      )
      .eq("sbu_id", profile.sbu_id)
      .eq("role", "UNIT_STAFF")
      .order("full_name", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const emailMap: Record<string, string> = {};
    for (const row of data ?? []) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.id);
      emailMap[row.id] = authUser.user?.email ?? "";
    }

    return NextResponse.json((data ?? []).map((row) => ({ ...row, email: emailMap[row.id] ?? "" })));
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return returnDisabledResponse(req);
}

export async function POST(req: Request) {
  return returnDisabledResponse(req);
}
