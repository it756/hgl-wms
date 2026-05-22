import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../lib/supabaseServer";

// PATCH /api/bu/units/[id] — rename unit or toggle active; scoped to BU manager's own SBU
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Verify the unit belongs to this manager's SBU
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("sbu_units")
      .select("id, sbu_id")
      .eq("id", id)
      .single();
    if (unitError || !unit) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }
    if (unit.sbu_id !== profile.sbu_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.code === "string" && body.code.trim())
      updates.code = body.code.trim().toUpperCase();
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from("sbu_units")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
