/**
 * Notification Worker — lib/workers/notificationWorker.ts
 *
 * Scans unread notifications that require email delivery and sends them.
 * Designed to be invoked on a schedule (e.g., by a cron route or external scheduler).
 * Implements retry/backoff via exponential delay and dead-letter logging.
 */
import { supabaseAdmin } from "../supabaseServer";
import { sendEmail } from "../email";

const MAX_RETRIES = 3;

interface PendingEmailNotification {
  id: string;
  user_id: string | null;
  user_role: string | null;
  type: string;
  message: string;
  related_entity_id: string | null;
  email?: string | null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveEmailsForNotification(
  n: PendingEmailNotification,
): Promise<string[]> {
  const emails: string[] = [];

  if (n.user_id) {
    // Fetch email for the specific user from Supabase Auth
    const { data } = await supabaseAdmin.auth.admin.getUserById(n.user_id);
    if (data.user?.email) emails.push(data.user.email);
  } else if (n.user_role) {
    // Fetch all active users with that role
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", n.user_role)
      .eq("is_active", true);

    for (const profile of profiles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (data.user?.email) emails.push(data.user.email);
    }
  }

  return emails;
}

async function sendWithRetry(
  to: string,
  subject: string,
  html: string,
  attempt = 1,
): Promise<void> {
  try {
    await sendEmail(to, subject, html);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(200 * Math.pow(2, attempt)); // exponential backoff
      return sendWithRetry(to, subject, html, attempt + 1);
    }
    throw err;
  }
}

export async function runNotificationWorker(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Fetch unread notifications not yet emailed
  const { data: notifications, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("is_read", false)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[notificationWorker] Failed to fetch notifications:", error.message);
    return { sent, failed };
  }

  for (const notification of notifications ?? []) {
    try {
      const emails = await resolveEmailsForNotification(notification as PendingEmailNotification);
      for (const email of emails) {
        await sendWithRetry(
          email,
          `Harvest WMS: ${notification.type.replace(/_/g, " ")}`,
          `<p>${notification.message}</p>`,
        );
        sent++;
      }
    } catch (err: any) {
      failed++;
      console.error(
        `[notificationWorker] Dead-letter notification ${notification.id}:`,
        err.message,
      );
      // Write to audit_logs as dead-letter record
      await supabaseAdmin.from("audit_logs").insert([
        {
          entity_type: "notification",
          entity_id: notification.id,
          action: "email_delivery_failed",
          details: { error: err.message, notification_type: notification.type },
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }

  return { sent, failed };
}

export default { runNotificationWorker };
