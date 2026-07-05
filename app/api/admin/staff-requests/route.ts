import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { listStaffRequests } from "../../../../lib/services/staffRequestService";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/admin/staff-requests
 * Lists all staff requests. Optionally filter by status and/or sbu_id.
 * Auth: ADMIN
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((user.user_metadata as AuthMetadata | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;
  const sbuId = searchParams.get("sbu_id") ?? undefined;
  const parsedLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
  const parsedOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  try {
    const requests = await listStaffRequests({
      status: statusParam ?? undefined,
      sbu_id: sbuId,
      limit,
      offset,
    });
    return NextResponse.json(requests);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
