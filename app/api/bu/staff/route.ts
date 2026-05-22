import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

// GET /api/bu/staff — list all staff (BU_MANAGER + UNIT_STAFF) in BU manager's SBU with unit info
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

    // Fetch profiles in this SBU (excluding ADMIN, WAREHOUSE_MANAGER, FINANCE_MANAGER)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, sbu_id, unit_id, is_active, sbu_units(id, name, code)")
      .eq("sbu_id", profile.sbu_id)
      .in("role", ["BU_MANAGER", "UNIT_STAFF"])
      .order("full_name");
    if (profilesError) throw profilesError;

    // Enrich with emails from auth.users
    const userIds = (profiles ?? []).map((p: any) => p.id);
    const { data: { users: authUsers } = { users: [] }, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;

    const emailMap: Record<string, string> = {};
    for (const au of authUsers ?? []) emailMap[au.id] = au.email ?? "";

    const enriched = (profiles ?? []).map((p: any) => ({
      ...p,
      email: emailMap[p.id] ?? "",
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}

// PATCH /api/bu/staff — assign a staff member to a unit, or deactivate them
// Body: { user_id, unit_id? } or { user_id, is_active }
export async function PATCH(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: managerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id, role")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (managerProfile.role !== "BU_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, unit_id, is_active, full_name } = body as {
      user_id?: string;
      unit_id?: string | null;
      is_active?: boolean;
      full_name?: string;
    };

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    // Verify the target user belongs to this manager's SBU
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, sbu_id, role")
      .eq("id", user_id)
      .single();
    if (targetError || !targetProfile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (targetProfile.sbu_id !== managerProfile.sbu_id) {
      return NextResponse.json({ error: "Forbidden — user is not in your SBU." }, { status: 403 });
    }
    // BU Managers cannot deactivate/reassign other BU Managers
    if (targetProfile.role === "BU_MANAGER") {
      return NextResponse.json({ error: "Cannot modify another BU Manager." }, { status: 403 });
    }

    // If assigning a unit, verify it belongs to the same SBU
    if (unit_id !== undefined && unit_id !== null) {
      const { data: unitCheck, error: unitCheckError } = await supabaseAdmin
        .from("sbu_units")
        .select("sbu_id")
        .eq("id", unit_id)
        .single();
      if (unitCheckError || !unitCheck) {
        return NextResponse.json({ error: "Unit not found." }, { status: 404 });
      }
      if (unitCheck.sbu_id !== managerProfile.sbu_id) {
        return NextResponse.json({ error: "Unit does not belong to your SBU." }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (unit_id !== undefined) updates.unit_id = unit_id;
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (typeof full_name === "string") updates.full_name = full_name.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", user_id)
      .select()
      .single();
    if (error) throw error;

    // Sync is_active to auth.users metadata if changed
    if (typeof is_active === "boolean") {
      await supabaseAdmin.auth.admin.updateUserById(user_id, {
        user_metadata: { is_active },
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}

// POST /api/bu/staff — BU Manager creates a new UNIT_STAFF account in their SBU
// Body: { full_name, email, password, unit_id? }
export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: managerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id, role")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (managerProfile.role !== "BU_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!managerProfile.sbu_id) {
      return NextResponse.json({ error: "Your account has no SBU assigned." }, { status: 422 });
    }

    const body = await req.json();
    const { full_name, email, password, unit_id } = body as {
      full_name?: string;
      email?: string;
      password?: string;
      unit_id?: string | null;
    };

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "email and password are required." }, { status: 400 });
    }

    // Password policy: min 8 chars, one number, one special char
    const pwPolicy = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?])(.{8,})$/;
    if (!pwPolicy.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and contain at least one number and one special character.",
        },
        { status: 400 },
      );
    }

    // If unit_id provided, verify it belongs to the manager's SBU
    if (unit_id) {
      const { data: unitCheck, error: unitCheckError } = await supabaseAdmin
        .from("sbu_units")
        .select("sbu_id")
        .eq("id", unit_id)
        .single();
      if (unitCheckError || !unitCheck) {
        return NextResponse.json({ error: "Unit not found." }, { status: 404 });
      }
      if (unitCheck.sbu_id !== managerProfile.sbu_id) {
        return NextResponse.json({ error: "Unit does not belong to your SBU." }, { status: 403 });
      }
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        role: "UNIT_STAFF",
        sbu_id: managerProfile.sbu_id,
        full_name: full_name?.trim() ?? null,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = newUser.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: full_name?.trim() ?? null,
      role: "UNIT_STAFF",
      sbu_id: managerProfile.sbu_id,
      unit_id: unit_id ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { id: userId, email: email.trim(), role: "UNIT_STAFF" },
      { status: 201 },
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
