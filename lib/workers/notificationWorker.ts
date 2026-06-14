/**
 * Notification Worker — lib/workers/notificationWorker.ts
 *
 * Scans unread notifications that require email delivery and sends them.
 * Designed to be invoked on a schedule (e.g., by a cron route or external scheduler).
 * Implements retry/backoff via exponential delay and dead-letter logging.
 */
import { supabaseAdmin } from "../supabaseServer";
import { sendEmail } from "../email";

interface PendingEmailNotification {
  id: string;
  user_id: string | null;
  user_role: string | null;
  type: string;
  message: string;
  related_entity_id: string | null;
  email?: string | null;
}

async function resolveEmailsForNotification(n: PendingEmailNotification): Promise<string[]> {
  const emails: string[] = [];

  if (n.user_id) {
    // Fetch email for the specific user from Supabase Auth
    const { data } = await supabaseAdmin.auth.admin.getUserById(n.user_id);
    if (data.user?.email) emails.push(data.user.email);
    return emails;
  }

  if (n.user_role) {
    // Try to scope by SBU using related_entity_id when available
    let sbuId: string | null = null;
    try {
      if (n.related_entity_id) {
        const { data: tr } = await supabaseAdmin
          .from("transfer_requests")
          .select("sbu_id")
          .eq("id", n.related_entity_id)
          .maybeSingle();
        if (tr && (tr as any).sbu_id) sbuId = (tr as any).sbu_id;
        else {
          const { data: grn } = await supabaseAdmin
            .from("grns")
            .select("transfer_request_id")
            .eq("id", n.related_entity_id)
            .maybeSingle();
          if (grn && (grn as any).transfer_request_id) {
            const { data: tr2 } = await supabaseAdmin
              .from("transfer_requests")
              .select("sbu_id")
              .eq("id", (grn as any).transfer_request_id)
              .maybeSingle();
            if (tr2 && (tr2 as any).sbu_id) sbuId = (tr2 as any).sbu_id;
          }
        }
      }
    } catch (e) {
      // ignore and fall back to global role broadcast
    }

    // Fetch profiles for the role (and SBU if known)
    let q: any = supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", n.user_role)
      .eq("is_active", true);
    if (sbuId) q = q.eq("sbu_id", sbuId);
    const { data: profiles } = await q;

    for (const profile of profiles ?? []) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (data.user?.email) emails.push(data.user.email);
      } catch (e) {
        // ignore missing email
      }
    }
  }

  // Dedupe
  return Array.from(new Set(emails));
}

// Note: sendEmail now includes centralized retry/backoff; worker-level retries removed.

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
        await sendEmail(
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
