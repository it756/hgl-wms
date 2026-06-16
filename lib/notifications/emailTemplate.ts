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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMessage(message: string): string {
  return message
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const escaped = escapeHtml(line);
      if (index === 0) {
        return `<p style="margin:0 0 14px 0;color:#333;font-size:15px;line-height:1.5;font-weight:600">${escaped}</p>`;
      }
      const separator = escaped.includes(":") ? escaped.indexOf(":") : -1;
      if (separator > 0) {
        const label = escaped.slice(0, separator);
        const value = escaped.slice(separator + 1).trim();
        return `<p style="margin:0 0 8px 0;color:#333;font-size:14px;line-height:1.45"><strong>${label}:</strong> ${value}</p>`;
      }
      return `<p style="margin:0 0 8px 0;color:#333;font-size:14px;line-height:1.45">${escaped}</p>`;
    })
    .join("\n");
}

export function buildNotificationEmail(data: EmailTemplateData): string {
  const type = escapeHtml(data.type);
  const role = escapeHtml(data.role || "Role notification");
  const message = renderMessage(data.message);

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1a4d2e;padding:20px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">Harvest WMS — Notification</h2>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Notification type</p>
    <p style="margin:0 0 20px 0;font-family:monospace;font-size:13px;color:#1a4d2e;background:#f0f7f0;padding:6px 10px;border-radius:4px">${type}</p>

    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Recipient role</p>
    <p style="margin:0 0 20px 0;font-weight:600;color:#222">${role}</p>

    <p style="margin:0 0 8px 0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Message</p>
    <div style="margin:0 0 24px 0">${message}</div>

    <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 16px 0"/>
    <p style="margin:0;color:#999;font-size:11px">This is an automated alert from Harvest WMS. Please do not reply to this email.</p>
  </div>
</div>`.trim();
}
