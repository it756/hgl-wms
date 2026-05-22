import { sendEmail } from "../../email";

export function transferRequestSubmittedHtml(reference: string, raisedBy: string): string {
  return `
<html><body>
  <h2>New Transfer Request: ${reference}</h2>
  <p>A new transfer request has been raised by <strong>${raisedBy}</strong> and is awaiting your attention.</p>
  <p>Reference: <strong>${reference}</strong></p>
  <p>Please log in to Harvest WMS to review and action this request.</p>
</body></html>`;
}

export function goodsIssuedHtml(reference: string): string {
  return `
<html><body>
  <h2>Goods Issued: ${reference}</h2>
  <p>Goods for transfer request <strong>${reference}</strong> have been issued from the warehouse.</p>
  <p>Please log in to Harvest WMS to submit your Goods Received Note (GRN) upon receipt.</p>
</body></html>`;
}

export function grnSubmittedHtml(reference: string, hasVariance: boolean): string {
  const status = hasVariance ? "COMPLETED WITH VARIANCE" : "COMPLETED";
  return `
<html><body>
  <h2>GRN Submitted: ${reference}</h2>
  <p>A Goods Received Note has been submitted for transfer <strong>${reference}</strong>.</p>
  <p>Transfer status: <strong>${status}</strong></p>
  ${hasVariance ? "<p><strong>Note:</strong> Variances were recorded. Please review in Harvest WMS.</p>" : ""}
</body></html>`;
}

export function financeApprovalRequiredHtml(reference: string, estimatedValue: number): string {
  return `
<html><body>
  <h2>Finance Approval Required: ${reference}</h2>
  <p>Transfer request <strong>${reference}</strong> has an estimated value of <strong>${estimatedValue}</strong>
     and requires Finance Manager approval before goods can be issued.</p>
  <p>Please log in to Harvest WMS to review and approve or reject this request.</p>
</body></html>`;
}

export function supplierGrnApprovalRequiredHtml(reference: string, invoiceAmount?: number): string {
  return `
<html><body>
  <h2>Supplier GRN Awaiting Finance Approval: ${reference}</h2>
  <p>A Supplier GRN (<strong>${reference}</strong>) has been submitted${invoiceAmount ? ` with invoice amount <strong>${invoiceAmount}</strong>` : ""}.</p>
  <p>Please log in to Harvest WMS to approve or reject this GRN. Stock levels will only be updated after approval.</p>
</body></html>`;
}

export async function sendTransferRequestNotification(
  to: string,
  reference: string,
  raisedBy: string,
): Promise<void> {
  await sendEmail(
    to,
    `New Transfer Request: ${reference}`,
    transferRequestSubmittedHtml(reference, raisedBy),
  );
}

export async function sendGoodsIssuedNotification(to: string, reference: string): Promise<void> {
  await sendEmail(to, `Goods Issued: ${reference}`, goodsIssuedHtml(reference));
}

export async function sendGRNSubmittedNotification(
  to: string,
  reference: string,
  hasVariance: boolean,
): Promise<void> {
  await sendEmail(to, `GRN Submitted: ${reference}`, grnSubmittedHtml(reference, hasVariance));
}

export async function sendFinanceApprovalRequiredNotification(
  to: string,
  reference: string,
  estimatedValue: number,
): Promise<void> {
  await sendEmail(
    to,
    `Finance Approval Required: ${reference}`,
    financeApprovalRequiredHtml(reference, estimatedValue),
  );
}
