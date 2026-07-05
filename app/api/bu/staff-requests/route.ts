import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { createStaffRequest } from "../../../../lib/services/staffRequestService";

interface AuthMetadata {
  role?: string;
  sbu_id?: string;
}

/**
 * POST /api/bu/staff-requests
 * BU Manager submits a request to add a new staff member.
 * The request enters a PENDING state for Admin review — no user account is created here.
 *
 * Body: {
 *   requested_user_info: { full_name, email, proposed_role, notes? },
 *   requested_roles: string[],
 *   notes?: string
 * }
 * Auth: BU_MANAGER
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata as AuthMetadata | null;
  if (meta?.role !== "BU_MANAGER") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  const sbu_id = meta?.sbu_id;
  if (!sbu_id) {
    return NextResponse.json({ error: "BU Manager is not assigned to an SBU" }, { status: 422 });
  }

  let body: {
    requested_user_info?: { full_name?: string; email?: string; proposed_role?: string; notes?: string };
    requested_roles?: string[];
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { requested_user_info, requested_roles, notes } = body;
  if (!requested_user_info || !requested_roles?.length) {
    return NextResponse.json(
      { error: "requested_user_info and requested_roles are required" },
      { status: 400 },
    );
  }

  try {
    const staffRequest = await createStaffRequest(
      {
        requested_user_info: requested_user_info as { full_name: string; email: string; proposed_role: string; notes?: string },
        requested_roles,
        sbu_id,
        notes,
      },
      user.id,
    );
    return NextResponse.json(staffRequest, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Invalid role") || message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/bu/staff-requests
 * BU Manager lists their own SBU's staff requests.
 * Auth: BU_MANAGER
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata as AuthMetadata | null;
  if (meta?.role !== "BU_MANAGER") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  const sbu_id = meta?.sbu_id;
  if (!sbu_id) {
    return NextResponse.json({ error: "BU Manager is not assigned to an SBU" }, { status: 422 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;

  // Import inline to avoid circular deps
  const { listStaffRequests } = await import("../../../../lib/services/staffRequestService");

  try {
    const requests = await listStaffRequests({ sbu_id, status: statusParam ?? undefined });
    return NextResponse.json(requests);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
