import { supabaseAdmin } from "../supabaseServer";
import type { Notification } from "../models/shared";
import { dispatchToChannels } from "../notifications/channels";

interface NotificationRecipientProfile {
  id: string;
  whatsapp_number?: string | null;
}

type SbuLookupRow = Record<string, string | null | undefined>;

export interface NotifyInput {
  /** Target a specific user by ID */
  user_id?: string;
  /** Broadcast to all users with this role (used when user_id is not set) */
  user_role?: string;
  type: string;
  message: string;
  related_entity_id?: string;
  /**
   * Optional subject for email/whatsapp delivery. Falls back to a generic
   * subject derived from `type` when omitted.
   */
  subject?: string;
  /**
   * If true, fan out to email/whatsapp channels (per NOTIFICATION_CHANNELS env)
   * after persisting the in-app notification row. Defaults to false to preserve
   * existing call-site behaviour.
   */
  dispatchChannels?: boolean;
}

/**
 * Persist a notification record.  Sending the email is a separate concern
 * handled by the notification worker or inline email sends.
 */
export async function createNotification(input: NotifyInput): Promise<Notification> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert([
      {
        user_id: input.user_id ?? null,
        user_role: input.user_role ?? null,
        type: input.type,
        message: input.message,
        related_entity_id: input.related_entity_id ?? null,
        is_read: false,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // Optionally fan out to email + WhatsApp channels.
  if (input.dispatchChannels) {
    try {
      const subject = input.subject ?? input.type.replace(/_/g, " ");
      const recipients = await resolveRecipients({
        user_id: input.user_id,
        user_role: input.user_role,
        related_entity_id: input.related_entity_id,
      });
      await Promise.all(
        recipients.map((r) =>
          dispatchToChannels({
            recipient: { email: r.email, whatsapp_number: r.whatsapp_number },
            subject,
            message: input.message,
            type: input.type,
            role: input.user_role,
          }),
        ),
      );
    } catch (channelErr) {
      console.error("createNotification: channel dispatch failed", channelErr);
    }
  }

  return data as Notification;
}

/**
 * Resolve recipients (email + whatsapp_number) for a user_id or user_role
 * broadcast. Returns an empty array if neither is provided. Reads from
 * auth.users (email) and profiles (whatsapp_number).
 */
async function resolveRecipients(opts: {
  user_id?: string;
  user_role?: string;
  /** Optionally use the related entity (transfer/grn/etc) to scope recipients to an SBU */
  related_entity_id?: string | null;
}): Promise<{ email: string | null; whatsapp_number: string | null }[]> {
  if (opts.user_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, whatsapp_number")
      .eq("id", opts.user_id)
      .maybeSingle();

    let email: string | null = null;
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(opts.user_id);
      email = authUser.user?.email ?? null;
    } catch (e) {
      console.error("resolveRecipients: getUserById failed", e);
    }
    const profileRow = profile as NotificationRecipientProfile | null;
    return [{ email, whatsapp_number: profileRow?.whatsapp_number ?? null }];
  }

  if (opts.user_role) {
    // Try to infer SBU from a related entity (transfer, grn, etc.) so we notify
    // role-holders for the correct SBU only.
    const sbuId = await inferSbuId(opts.related_entity_id);

    const { data: profiles } = sbuId
      ? await supabaseAdmin
          .from("profiles")
          .select("id, whatsapp_number")
          .eq("role", opts.user_role)
          .eq("is_active", true)
          .eq("sbu_id", sbuId)
      : await supabaseAdmin
          .from("profiles")
          .select("id, whatsapp_number")
          .eq("role", opts.user_role)
          .eq("is_active", true);
    if (!profiles || profiles.length === 0) return [];

    const out = await Promise.all(
      (profiles as NotificationRecipientProfile[]).map(async (p) => {
        let email: string | null = null;
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
          email = authUser.user?.email ?? null;
        } catch {
          // ignore — leave email null
        }
        return { email, whatsapp_number: p.whatsapp_number ?? null };
      }),
    );
    return out;
  }

  return [];
}

async function inferSbuId(relatedEntityId?: string | null): Promise<string | null> {
  if (!relatedEntityId) return null;

  try {
    const directLookups = [
      { table: "transfer_requests", column: "sbu_id" },
      { table: "supplier_grns", column: "sbu_id" },
      { table: "return_requests", column: "sbu_id" },
      { table: "intra_warehouse_transfers", column: "to_sbu_id" },
    ];

    for (const lookup of directLookups) {
      const { data } = await supabaseAdmin
        .from(lookup.table)
        .select(lookup.column)
        .eq("id", relatedEntityId)
        .maybeSingle();
      const sbuId = (data as SbuLookupRow | null)?.[lookup.column];
      if (sbuId) return sbuId;
    }

    const { data: grn } = await supabaseAdmin
      .from("grns")
      .select("transfer_request_id")
      .eq("id", relatedEntityId)
      .maybeSingle();
    const grnRow = grn as { transfer_request_id?: string | null } | null;
    if (grnRow?.transfer_request_id) {
      const { data: transfer } = await supabaseAdmin
        .from("transfer_requests")
        .select("sbu_id")
        .eq("id", grnRow.transfer_request_id)
        .maybeSingle();
      const transferRow = transfer as { sbu_id?: string | null } | null;
      if (transferRow?.sbu_id) return transferRow.sbu_id;
    }

    const { data: proposal } = await supabaseAdmin
      .from("variance_proposals")
      .select("transfer_request_id")
      .eq("id", relatedEntityId)
      .maybeSingle();
    const proposalRow = proposal as { transfer_request_id?: string | null } | null;
    if (proposalRow?.transfer_request_id) {
      const { data: transfer } = await supabaseAdmin
        .from("transfer_requests")
        .select("sbu_id")
        .eq("id", proposalRow.transfer_request_id)
        .maybeSingle();
      const transferRow = transfer as { sbu_id?: string | null } | null;
      if (transferRow?.sbu_id) return transferRow.sbu_id;
    }
  } catch {
    // best-effort: fall back to global role broadcast
  }

  return null;
}

/** Mark a notification as read for a given user.
 * Handles both direct (user_id) and role-broadcast (user_role) notifications.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
  role?: string,
): Promise<void> {
  const filter = role ? `user_id.eq.${userId},user_role.eq.${role}` : `user_id.eq.${userId}`;

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .or(filter);

  if (error) throw error;
}

/** Get unread notifications for a user (direct + role-broadcast) */
export async function getUnreadNotifications(
  userId: string,
  role: string,
): Promise<Notification[]> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("is_read", false)
    .or(`user_id.eq.${userId},user_role.eq.${role}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Notification[]) ?? [];
}

const notificationService = { createNotification, markNotificationRead, getUnreadNotifications };

export default notificationService;
