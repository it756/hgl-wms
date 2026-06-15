import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const WHATSAPP_RE = /^\+[1-9]\d{7,14}$/;

/** GET /api/auth/profile — fetch the authenticated user's own profile */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role, sbu_id, whatsapp_number")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  let sbuName: string | null = null;
  if ((profile as any).sbu_id) {
    const { data: sbu } = await supabaseAdmin
      .from("sbus")
      .select("name")
      .eq("id", (profile as any).sbu_id)
      .maybeSingle();
    sbuName = (sbu as any)?.name ?? null;
  }

  return NextResponse.json({
    id: user.id,
    email: user.email ?? null,
    full_name: (profile as any).full_name ?? null,
    role: (profile as any).role,
    sbu_name: sbuName,
    whatsapp_number: (profile as any).whatsapp_number ?? null,
  });
}

/** PATCH /api/auth/profile — update the authenticated user's own profile */
export async function PATCH(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { full_name, whatsapp_number } = body as {
    full_name?: string;
    whatsapp_number?: string | null;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (full_name !== undefined) {
    const trimmed = typeof full_name === "string" ? full_name.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "full_name cannot be empty" }, { status: 400 });
    updates.full_name = trimmed;
  }

  if (whatsapp_number !== undefined) {
    if (whatsapp_number !== null && whatsapp_number !== "") {
      const trimmed = whatsapp_number.trim();
      if (!WHATSAPP_RE.test(trimmed)) {
        return NextResponse.json(
          { error: "whatsapp_number must be in E.164 format, e.g. +260977000000" },
          { status: 400 },
        );
      }
      updates.whatsapp_number = trimmed;
    } else {
      updates.whatsapp_number = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("full_name, role, sbu_id, whatsapp_number")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep auth user_metadata.full_name in sync
  if (updates.full_name !== undefined) {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { full_name: updates.full_name },
    });
  }

  return NextResponse.json({ success: true, profile: data });
}
