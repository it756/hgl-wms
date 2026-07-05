import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { getExpiryAlerts } from "../../../../lib/services/expiryService";
import type { ExpiryStatus } from "../../../../lib/services/expiryService";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/admin/expiry
 *
 * Returns supplier GRN line items with expiry dates, categorised as:
 *   expired    — expiry_date is in the past
 *   near_expiry — expiry_date is within the configured threshold (default 30 days)
 *   ok          — more than threshold days away
 *
 * Query params:
 *   ?status=expired|near_expiry|ok  — filter by status
 *   ?sbu_id=<uuid>                  — filter by SBU
 *   ?threshold_days=<n>             — override the near-expiry threshold (default 30)
 *
 * Auth: ADMIN | WAREHOUSE_MANAGER | FINANCE_MANAGER
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") as ExpiryStatus | null;
  const sbuId = searchParams.get("sbu_id") ?? undefined;
  const parsedThreshold = parseInt(searchParams.get("threshold_days") ?? "30", 10);
  const thresholdDays = Number.isFinite(parsedThreshold) && parsedThreshold > 0 ? parsedThreshold : 30;

  const validStatuses: ExpiryStatus[] = ["expired", "near_expiry", "ok"];
  if (statusParam && !validStatuses.includes(statusParam)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const alerts = await getExpiryAlerts(thresholdDays, {
      sbu_id: sbuId,
      status: statusParam ?? undefined,
    });
    return NextResponse.json(alerts);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
