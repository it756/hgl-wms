import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";
import { applyInternalControlAction } from "../../../../../../lib/services/purchaseRequestService";

interface AuthMetadata {
  role?: string;
}

interface InternalControlBody {
  action?: string;
  notes?: string;
}

/**
 * POST /api/admin/purchase-requests/[id]/internal-control
 * ADMIN approves or rejects a purchase request at the internal control stage.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  let body: InternalControlBody;
  try {
    body = (await req.json()) as InternalControlBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }
  const { action, notes } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  try {
    const updated = await applyInternalControlAction(
      id,
      action === "approve" ? "APPROVED" : "REJECTED",
      { notes, adminId: user.id },
    );
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not awaiting internal control")
      ? 409
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
