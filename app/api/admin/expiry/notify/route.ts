import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { sendExpiryNotifications } from "../../../../../lib/services/expiryService";

interface AuthMetadata {
  role?: string;
}

/**
 * POST /api/admin/expiry/notify
 *
 * Triggers expiry notifications for all near-expiry and expired stock batches.
 * Intended to be called daily by a scheduled job (e.g. Vercel cron) or manually
 * by an admin.
 *
 * When invoked by a cron job, pass the CRON_SECRET as a Bearer token:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Auth: ADMIN (manual) or valid CRON_SECRET (automated)
 */
export async function POST(req: Request) {
  // Allow cron invocation via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let performedById = "cron";

  if (cronSecret && bearerToken === cronSecret) {
    // Authenticated as cron job — proceed
  } else {
    // Otherwise require ADMIN user
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }
    performedById = user.id;
  }

  try {
    const summary = await sendExpiryNotifications(performedById);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
