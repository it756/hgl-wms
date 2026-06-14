import nodemailer from "nodemailer";
import { supabaseAdmin } from "./supabaseServer";

// Do not throw on missing env at import time; failing sends will surface at runtime
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  // Common Node network errors
  const transientCodes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH"];
  if (err.code && transientCodes.includes(err.code)) return true;

  // Nodemailer / SMTP response codes: treat 5xx as transient (server-side), 4xx as permanent client errors
  const resp = Number(err?.responseCode || err?.statusCode || 0);
  if (resp >= 500) return true;
  if (resp >= 400 && resp < 500) return false;

  // Fallback: consider network-like failures transient
  return true;
}

async function recordDeadLetter(payload: any, attempts: number, lastError: any) {
  try {
    await supabaseAdmin.from("audit_logs").insert([
      {
        entity_type: "email",
        entity_id: payload.to ?? null,
        action: "email_dead_letter",
        details: {
          payload,
          attempts,
          lastError: (lastError && lastError.message) || String(lastError),
        },
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // Best-effort: log and continue — don't throw from the dead-letter recorder
    // eslint-disable-next-line no-console
    console.error("recordDeadLetter: failed to write audit_logs", e);
  }
}

export async function sendEmail(to: string, subject: string, html: string) {
  // Use configured EMAIL_FROM, fall back to SMTP_USER, then final default
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "wms@harvestgl.com";
  if (!from) throw new Error("EMAIL_FROM or SMTP_USER must be set");

  const maxAttempts = Number(process.env.EMAIL_MAX_RETRIES ?? process.env.EMAIL_RETRIES ?? 5);
  const baseDelay = Number(process.env.EMAIL_BASE_DELAY_MS ?? 200);
  const maxDelay = Number(process.env.EMAIL_MAX_DELAY_MS ?? 10000);
  const useJitter = (process.env.EMAIL_USE_JITTER ?? "true") !== "false";

  const payload = { from, to, subject, html };

  let attempt = 1;
  let lastErr: any = null;

  while (true) {
    try {
      await transporter.sendMail(payload as any);
      return;
    } catch (err: any) {
      lastErr = err;

      const transient = isTransientError(err);

      if (!transient) {
        // Permanent error — record dead-letter and rethrow
        await recordDeadLetter(payload, attempt, err);
        throw err;
      }

      if (attempt >= maxAttempts) {
        await recordDeadLetter(payload, attempt, err);
        throw err;
      }

      // Exponential backoff with optional full jitter
      const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
      const delay = useJitter ? Math.floor(Math.random() * expDelay) : expDelay;

      // eslint-disable-next-line no-console
      console.warn(
        `sendEmail: attempt ${attempt} failed for ${to}, retrying after ${delay}ms: ${err?.message || err}`,
      );

      await sleep(delay);
      attempt += 1;
    }
  }
}
