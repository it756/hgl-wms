import { NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "../../../../lib/supabaseServer";
import type { UserRole } from "../../../../lib/models/user";
import { createNotification } from "../../../../lib/services/notificationService";

const VALID_REQUESTED_ROLES: UserRole[] = ["UNIT_STAFF"];

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => null);
    const fullName = asTrimmedString(body?.full_name);
    const email = asTrimmedString(body?.email);
    const unitId = asTrimmedString(body?.unit_id) || null;
    const requestedRole = (asTrimmedString(body?.role) || "UNIT_STAFF") as UserRole;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (!VALID_REQUESTED_ROLES.includes(requestedRole)) {
      return NextResponse.json({ error: `Invalid requested role: ${requestedRole}` }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    if (unitId) {
      const { data: unit, error: unitError } = await supabaseAdmin
        .from("sbu_units")
        .select("id")
        .eq("id", unitId)
        .eq("sbu_id", profile.sbu_id)
        .maybeSingle();
      if (unitError) throw unitError;
      if (!unit) {
        return NextResponse.json({ error: "Selected unit does not belong to your SBU." }, { status: 400 });
      }
    }

    const { data: staffRequest, error } = await supabaseAdmin
      .from("staff_requests")
      .insert({
        requested_by_sbu_id: profile.sbu_id,
        requested_user_info: {
          full_name: fullName || null,
          email,
          unit_id: unitId,
        },
        requested_roles: [requestedRole],
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    await createNotification({
      user_role: "ADMIN",
      type: "STAFF_REQUEST_CREATED",
      message: `New staff creation request submitted for ${email}.`,
      related_entity_id: staffRequest.id,
    });

    return NextResponse.json({ message: "Staff creation request submitted.", id: staffRequest.id }, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}