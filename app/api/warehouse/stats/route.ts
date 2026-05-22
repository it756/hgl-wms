import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

function periodStart(period: "TODAY" | "WEEK" | "MONTH"): string {
  const now = new Date();
  if (period === "TODAY") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "WEEK") {
    return new Date(now.getTime() - 7 * 86_400_000).toISOString();
  }
  return new Date(now.getTime() - 30 * 86_400_000).toISOString();
}

export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (role !== "WAREHOUSE_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthStart = periodStart("MONTH");

  const [issuancesRes, grnsRes, completedRes, activityIssuancesRes, activityGrnsRes] =
    await Promise.all([
      // Issuances for rolling month
      supabaseAdmin
        .from("issuances")
        .select("id, issue_date, created_at")
        .gte("created_at", monthStart),

      // Supplier GRNs for rolling month
      supabaseAdmin
        .from("supplier_grns")
        .select("id, date_received, created_at, status")
        .gte("created_at", monthStart),

      // Completed transfer requests for rolling month (for variance rate)
      supabaseAdmin
        .from("transfer_requests")
        .select("id, status, updated_at")
        .in("status", ["COMPLETED", "COMPLETED_WITH_VARIANCE"])
        .gte("updated_at", monthStart),

      // Recent issuances for activity stream (with SBU + ref via transfer_requests join)
      supabaseAdmin
        .from("issuances")
        .select(
          "id, issue_date, created_at, transfer_request_id, transfer_requests(reference_number, sbus(name)), issuance_line_items(id)",
        )
        .order("created_at", { ascending: false })
        .limit(8),

      // Recent supplier GRNs for activity stream
      supabaseAdmin
        .from("supplier_grns")
        .select("id, reference_number, supplier_name, status, created_at, date_received")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  // Compute stats for each period
  const stats: Record<string, { dispatches: number; inbound: number; variance_pct: string }> = {};

  for (const period of ["TODAY", "WEEK", "MONTH"] as const) {
    const start = periodStart(period);

    const dispatches = (issuancesRes.data ?? []).filter(
      (i) => (i.issue_date ?? i.created_at) >= start,
    ).length;

    const inbound = (grnsRes.data ?? []).filter((g) => g.created_at >= start).length;

    const periodCompleted = (completedRes.data ?? []).filter((r) => r.updated_at >= start);
    const withVariance = periodCompleted.filter(
      (r) => r.status === "COMPLETED_WITH_VARIANCE",
    ).length;
    const variance_pct =
      periodCompleted.length > 0
        ? ((withVariance / periodCompleted.length) * 100).toFixed(2) + "%"
        : "0.00%";

    stats[period] = { dispatches, inbound, variance_pct };
  }

  // Build recent activity list (merge issuances + supplier GRNs, sort by timestamp desc)
  const issuanceActivity = (activityIssuancesRes.data ?? []).map((iss: any) => ({
    id: iss.id,
    ref: (iss.transfer_requests as any)?.reference_number ?? iss.transfer_request_id,
    type: "DISPATCH" as const,
    label: (iss.transfer_requests as any)?.sbus?.name ?? "Unknown SBU",
    status: "DISPATCHED",
    timestamp: iss.issue_date ?? iss.created_at,
    item_count: Array.isArray(iss.issuance_line_items) ? iss.issuance_line_items.length : 0,
  }));

  const grnActivity = (activityGrnsRes.data ?? []).map((grn: any) => ({
    id: grn.id,
    ref: grn.reference_number,
    type: "INBOUND" as const,
    label: grn.supplier_name,
    status:
      grn.status === "GRN_APPROVED"
        ? "APPROVED"
        : grn.status === "GRN_REJECTED"
          ? "REJECTED"
          : "PENDING",
    timestamp: grn.created_at,
    item_count: null,
  }));

  const activity = [...issuanceActivity, ...grnActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return NextResponse.json({ stats, activity });
}
