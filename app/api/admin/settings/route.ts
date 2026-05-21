import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const ALLOWED_KEYS = [
  "finance_approval_threshold",
  "finance_approval_scope",
  "session_timeout_minutes",
  "low_stock_alert_enabled",
  "email_notifications_enabled",
];

/** GET /api/admin/settings — ADMIN only */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from("app_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert to simple key→value object
  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

/** PATCH /api/admin/settings — ADMIN only; body: { key: value, ... } */
export async function PATCH(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.user_metadata as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const keys = Object.keys(body);
  const invalid = keys.filter((k) => !ALLOWED_KEYS.includes(k));
  if (invalid.length) {
    return NextResponse.json(
      { error: `Unknown setting keys: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const upserts = keys.map((k) => ({
    key: k,
    value: String(body[k]),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from("app_settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
