import { supabaseAdmin } from "../supabaseServer";
import type { Notification } from "../models/shared";

export interface NotifyInput {
  /** Target a specific user by ID */
  user_id?: string;
  /** Broadcast to all users with this role (used when user_id is not set) */
  user_role?: string;
  type: string;
  message: string;
  related_entity_id?: string;
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
  return data as Notification;
}

/** Mark a notification as read for a given user */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Get unread notifications for a user (direct + role-broadcast) */
export async function getUnreadNotifications(userId: string, role: string): Promise<Notification[]> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("is_read", false)
    .or(`user_id.eq.${userId},user_role.eq.${role}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Notification[]) ?? [];
}

export default { createNotification, markNotificationRead, getUnreadNotifications };
