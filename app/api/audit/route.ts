import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../lib/supabaseServer";
import { queryAuditLogs } from "../../../lib/services/auditService";

/**
 * GET /api/audit
 * Query the immutable audit log.
 * Query params: entity_type, entity_id, performed_by, from, to, limit, offset
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type") ?? undefined;
  const entityId = url.searchParams.get("entity_id") ?? undefined;
  const performedBy = url.searchParams.get("performed_by") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const logs = await queryAuditLogs(entityType, entityId, performedBy, from, to, limit, offset);
  return NextResponse.json(logs);
}
