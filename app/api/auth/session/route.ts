import { NextResponse } from "next/server";
import { licenseDenialMessage } from "../../../../lib/licensePolicy";
import { getAppAuthFromToken, supabaseAdmin } from "../../../../lib/supabaseServer";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.split(" ")[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getAppAuthFromToken(token);
  if (!result.ok) {
    if (result.reason === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { code: result.reason, error: licenseDenialMessage(result.reason) },
      { status: 403 },
    );
  }

  let sbuName: string | null = null;
  if (result.profile.sbu_id) {
    const { data: sbu } = await supabaseAdmin
      .from("sbus")
      .select("name")
      .eq("id", result.profile.sbu_id)
      .maybeSingle();
    sbuName = sbu?.name ?? null;
  }

  return NextResponse.json({
    id: result.user.id,
    email: result.user.email ?? null,
    full_name: result.profile.full_name,
    role: result.profile.role,
    sbu_id: result.profile.sbu_id,
    sbu_name: sbuName,
    unit_id: result.profile.unit_id,
    is_active: result.profile.is_active,
    licensed: result.profile.licensed,
    license_type: result.profile.license_type,
    license_issued_at: result.profile.license_issued_at,
    license_expires_at: result.profile.license_expires_at,
  });
}