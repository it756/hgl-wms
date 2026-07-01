import { sendEmail } from "../../email";

/** Escape special HTML characters to prevent injection via user-supplied fields. */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function procurementReviewHtml(opts: {
  reference: string;
  sbuName: string;
  supplierName: string | null;
  notes: string | null;
  estimatedTotal: number | null;
  lines: {
    product_name: string;
    sku: string | null;
    quantity_requested: number;
    unit_of_measure: string;
    unit_cost: number | null;
  }[];
  reviewLink: string;
  expiryDays: number;
}): string {
  const currency = "KES";
  const linesHtml = opts.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(l.product_name)}${l.sku ? ` (${esc(l.sku)})` : ""}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${l.quantity_requested} ${esc(l.unit_of_measure)}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;">${l.unit_cost != null ? `${currency} ${l.unit_cost.toLocaleString()}` : "—"}</td>
      </tr>`,
    )
    .join("");

  return `
<html>
<body style="font-family:Arial,sans-serif;color:#1a202c;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="color:#2d3748;">Purchase Request Awaiting Your Review</h2>
  <p>A purchase request has been submitted and requires your approval before it can proceed.</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr><td style="padding:4px 0;font-weight:bold;width:160px;">Reference</td><td>${esc(opts.reference)}</td></tr>
    <tr><td style="padding:4px 0;font-weight:bold;">Requesting SBU</td><td>${esc(opts.sbuName)}</td></tr>
    ${opts.supplierName ? `<tr><td style="padding:4px 0;font-weight:bold;">Supplier</td><td>${esc(opts.supplierName)}</td></tr>` : ""}
    ${opts.estimatedTotal != null ? `<tr><td style="padding:4px 0;font-weight:bold;">Estimated Total</td><td>${currency} ${opts.estimatedTotal.toLocaleString()}</td></tr>` : ""}
    ${opts.notes ? `<tr><td style="padding:4px 0;font-weight:bold;">Notes</td><td>${esc(opts.notes)}</td></tr>` : ""}
  </table>

  <h3 style="color:#4a5568;margin-bottom:8px;">Requested Items</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
    <thead>
      <tr style="background:#f7fafc;">
        <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Item</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">Qty</th>
        <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;">Unit Cost</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <p style="margin-bottom:24px;">Please review this request and take action using the secure link below.
     You can <strong>Approve</strong>, <strong>Reject</strong>, <strong>Request Changes</strong>, or upload a supporting document (proforma invoice, quotation).</p>

  <a href="${opts.reviewLink}"
     style="background:#2563eb;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
    Review Purchase Request
  </a>

  <p style="margin-top:24px;font-size:13px;color:#718096;">
    This link is valid for ${opts.expiryDays} days and can only be used once for an approval or rejection action.
    If the link has expired, please contact the requesting SBU to resubmit.
  </p>
  <p style="font-size:12px;color:#a0aec0;">Harvest WMS — Automated Notification</p>
</body>
</html>`;
}

export function procurementActionConfirmationHtml(
  reference: string,
  action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): string {
  const actionLabels: Record<string, string> = {
    APPROVED: "approved",
    REJECTED: "rejected",
    CHANGES_REQUESTED: "flagged for changes",
  };
  return `
<html><body style="font-family:Arial,sans-serif;color:#1a202c;max-width:640px;margin:0 auto;padding:24px;">
  <h2>Action Recorded — ${reference}</h2>
  <p>You have <strong>${actionLabels[action] ?? action}</strong> purchase request <strong>${reference}</strong>.</p>
  <p>The requesting team has been notified. No further action is required from you at this time.</p>
  <p style="font-size:12px;color:#a0aec0;">Harvest WMS — Automated Notification</p>
</body></html>`;
}

export async function sendProcurementReviewEmail(
  to: string,
  opts: Parameters<typeof procurementReviewHtml>[0],
): Promise<void> {
  await sendEmail(
    to,
    `Purchase Request Awaiting Review: ${opts.reference}`,
    procurementReviewHtml(opts),
  );
}

export async function sendProcurementConfirmationEmail(
  to: string,
  reference: string,
  action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): Promise<void> {
  await sendEmail(
    to,
    `Purchase Request Action Recorded: ${reference}`,
    procurementActionConfirmationHtml(reference, action),
  );
}
