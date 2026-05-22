import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/exports/transfers
 * Returns CSV of transfer requests within a date range.
 * Query params: from (ISO date), to (ISO date)
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabaseAdmin
    .from("transfer_requests")
    .select(
      "reference_number, status, sbu_id, raised_by, required_date, estimated_value, requires_finance_approval, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  if (rows.length === 0) {
    return new Response("No data", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const headers = Object.keys(rows[0]).join(",");
  const csvRows = rows.map((row) =>
    Object.values(row)
      .map((v) => (v == null ? "" : String(v).includes(",") ? `"${v}"` : String(v)))
      .join(","),
  );
  const csv = [headers, ...csvRows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transfers-export.csv"`,
    },
  });
}
