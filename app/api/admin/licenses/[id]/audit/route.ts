import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { listLicenseAuditLog } from "../../../../../../lib/services/licenseService";

interface AuthMetadata {
  role?: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  try {
    const logs = await listLicenseAuditLog(id);
    return NextResponse.json(logs);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}