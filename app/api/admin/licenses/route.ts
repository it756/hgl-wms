import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import {
  assignLicense,
  listLicensedStaff,
} from "../../../../lib/services/licenseService";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/admin/licenses
 * Lists staff licence records. Optionally filter by sbu_id and/or licensed status.
 * Auth: ADMIN
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sbuId = searchParams.get("sbu_id") ?? undefined;
  const licensedParam = searchParams.get("licensed");
  const licensed =
    licensedParam === "true" ? true : licensedParam === "false" ? false : undefined;

  try {
    const staff = await listLicensedStaff({ sbu_id: sbuId, licensed });
    return NextResponse.json(staff);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/licenses
 * Assigns a licence to a staff member.
 * Body: { profile_id, license_type, license_issued_at?, license_expires_at?, notes? }
 * Auth: ADMIN
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  let body: {
    profile_id?: string;
    license_type?: string;
    license_issued_at?: string;
    license_expires_at?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profile_id, license_type } = body;
  if (!profile_id || !license_type) {
    return NextResponse.json(
      { error: "profile_id and license_type are required" },
      { status: 400 },
    );
  }

  try {
    const result = await assignLicense(
      {
        profile_id,
        license_type,
        license_issued_at: body.license_issued_at,
        license_expires_at: body.license_expires_at,
        notes: body.notes,
      },
      user.id,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("already has")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
