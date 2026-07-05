import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import {
  updateLicense,
  revokeLicense,
} from "../../../../../lib/services/licenseService";

interface AuthMetadata {
  role?: string;
}

/**
 * PUT /api/admin/licenses/[id]
 * Updates an existing licence for a staff member.
 * Body: { license_type?, license_issued_at?, license_expires_at?, notes? }
 * Auth: ADMIN
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  let body: {
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

  try {
    const result = await updateLicense(id, body, user.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("does not have")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/admin/licenses/[id]
 * Revokes a staff member's licence.
 * Body: { notes? }
 * Auth: ADMIN
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  let notes: string | undefined;
  try {
    const body = await req.json();
    notes = body?.notes;
  } catch {
    // notes is optional — ignore parse failures
  }

  try {
    const result = await revokeLicense(id, notes, user.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("does not have")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
