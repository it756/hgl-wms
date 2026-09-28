import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { printPurchaseRequest } from "../../../../../../lib/services/purchaseRequestService";

interface AuthMetadata {
  role?: string;
}

/**
 * POST /api/admin/purchase-requests/[id]/print
 *
 * Records a print event (sets printed_at, writes audit log) and returns the full
 * PR data (including line items) so the client can render a print-friendly view.
 *
 * The PR must be in a printable status: APPROVED_FOR_PURCHASE, EXPECTED_ORDER,
 * PARTIALLY_RECEIVED, or RECEIVED.
 *
 * Auth: ADMIN | FINANCE_MANAGER
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (!["ADMIN", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Admin or Finance Manager only" }, { status: 403 });
  }

  try {
    const pr = await printPurchaseRequest(id, user.id);
    return NextResponse.json(pr);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("cannot be printed")
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
