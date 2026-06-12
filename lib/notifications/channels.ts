/**
 * lib/notifications/channels.ts
 *
 * Multi-channel notification dispatcher. Selects active channels from the
 * NOTIFICATION_CHANNELS env var (comma-separated; e.g. "email,whatsapp")
 * and forwards the message to each.
 *
 * This module is purely additive — callers can keep using
 * `createNotification()` to persist the in-app row, and optionally call
 * `dispatchToChannels()` to fan out to email/WhatsApp.
 */

import { sendEmail } from "../email";
import { sendWhatsApp } from "./whatsapp";

export type Channel = "email" | "whatsapp";

export interface ChannelRecipient {
  /** E.164 phone number (e.g. +260977000000) — required for whatsapp */
  whatsapp_number?: string | null;
  /** Email address — required for email */
  email?: string | null;
}

export interface DispatchInput {
  recipient: ChannelRecipient;
  subject: string;
  /** Plain-text or HTML message body. WhatsApp providers expect plain text. */
  message: string;
  /** Override active channels (defaults to NOTIFICATION_CHANNELS env). */
  channels?: Channel[];
}

function activeChannels(): Channel[] {
  const raw = (process.env.NOTIFICATION_CHANNELS ?? "email").trim();
  if (!raw) return ["email"];
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is Channel => c === "email" || c === "whatsapp");
}

/**
 * Best-effort fan-out. Per-channel failures are logged but do not throw,
 * so a single misconfigured channel cannot break the calling flow.
 */
export async function dispatchToChannels(input: DispatchInput): Promise<void> {
  const channels = input.channels ?? activeChannels();

  await Promise.all(
    channels.map(async (channel) => {
      try {
        if (channel === "email") {
          if (!input.recipient.email) return;
          await sendEmail(input.recipient.email, input.subject, input.message);
        } else if (channel === "whatsapp") {
          if (!input.recipient.whatsapp_number) return;
          await sendWhatsApp(input.recipient.whatsapp_number, input.message);
        }
      } catch (err) {
        console.error(`dispatchToChannels: ${channel} delivery failed`, err);
      }
    }),
  );
}

export default { dispatchToChannels };
