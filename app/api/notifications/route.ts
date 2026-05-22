import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../lib/supabaseServer";
import {
  getUnreadNotifications,
  markNotificationRead,
} from "../../../lib/services/notificationService";

/**
 * GET /api/notifications
 * Returns unread notifications for the authenticated user.
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  const notifications = await getUnreadNotifications(user.id, role);
  return NextResponse.json(notifications);
}

/**
 * PATCH /api/notifications
 * Mark a notification as read.
 * Body: { id: string }
 */
export async function PATCH(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing notification id" }, { status: 400 });

  const role = (user.user_metadata as any)?.role ?? undefined;
  await markNotificationRead(id, user.id, role);
  return NextResponse.json({ success: true });
}
