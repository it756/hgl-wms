import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

async function getBuManagerProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("sbu_id, role")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// GET /api/bu/units — list active units for the BU manager's SBU
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getBuManagerProfile(user.id);
    if (!["BU_MANAGER", "UNIT_STAFF"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!profile.sbu_id) {
      return NextResponse.json({ error: "Your account has no SBU assigned." }, { status: 422 });
    }

    const { data, error } = await supabaseAdmin
      .from("sbu_units")
      .select("id, name, code, sbu_id, is_active, created_at, updated_at")
      .eq("sbu_id", profile.sbu_id)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}

// POST /api/bu/units — create a new unit under the BU manager's SBU
export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getBuManagerProfile(user.id);
    if (profile.role !== "BU_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!profile.sbu_id) {
      return NextResponse.json({ error: "Your account has no SBU assigned." }, { status: 422 });
    }

    const body = await req.json();
    const { name, code } = body as { name?: string; code?: string };

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json({ error: "name and code are required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sbu_units")
      .insert({ name: name.trim(), code: code.trim().toUpperCase(), sbu_id: profile.sbu_id })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A unit with that code already exists in your SBU." },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
