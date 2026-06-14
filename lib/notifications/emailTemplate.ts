/**
 * lib/notifications/emailTemplate.ts
 *
 * Single source of truth for the WMS notification email HTML template.
 * Used by both the live dispatcher (dispatchToChannels) and the test script.
 */

export interface EmailTemplateData {
  type: string;
  role: string;
  message: string;
}

export function buildNotificationEmail(data: EmailTemplateData): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1a4d2e;padding:20px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">Harvest WMS — Notification</h2>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Notification type</p>
    <p style="margin:0 0 20px 0;font-family:monospace;font-size:13px;color:#1a4d2e;background:#f0f7f0;padding:6px 10px;border-radius:4px">${data.type}</p>

    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Recipient role</p>
    <p style="margin:0 0 20px 0;font-weight:600;color:#222">${data.role}</p>

    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Message</p>
    <p style="margin:0 0 24px 0;color:#333;font-size:15px;line-height:1.5">${data.message}</p>

    <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 16px 0"/>
    <p style="margin:0;color:#999;font-size:11px">This is an automated alert from Harvest WMS. Please do not reply to this email.</p>
  </div>
</div>`.trim();
}
