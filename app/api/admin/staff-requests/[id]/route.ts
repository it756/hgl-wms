import { NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "../../../../../lib/supabaseServer";
import {
  approveStaffRequest,
  rejectStaffRequest,
} from "../../../../../lib/services/staffRequestService";

/**
 * PUT /api/admin/staff-requests/[id]
 * Admin approves or rejects a pending staff request.
 *
 * Body: { action: "approve" | "reject", notes?: string }
 *
 * On approval the request moves to APPROVED. The Admin must then separately
 * create the user account via POST /api/admin/users using the request details.
 *
 * Auth: ADMIN
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  let body: { action?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, notes } = body;
  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  try {
    const updated =
      action === "approve"
        ? await approveStaffRequest(id, user.id, notes)
        : await rejectStaffRequest(id, user.id, notes);

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("not pending") || message.includes("already reviewed")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
