/**
 * scripts/test-emails.ts
 * Run: npx tsx scripts/test-emails.ts
 *
 * Sends one test email per WMS notification type to the target address.
 */
import "dotenv/config";
import nodemailer from "nodemailer";
import { buildNotificationEmail } from "../lib/notifications/emailTemplate";

const TO = "david.okuku@harvestgl.net";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || process.env.SMTP_USER || "wms@harvestgl.com";

interface TestCase {
  subject: string;
  type: string;
  message: string;
  role: string;
}

const testCases: TestCase[] = [
  // ── Transfer requests ─────────────────────────────────────────────────────
  {
    type: "transfer_request_pending_bu_approval",
    subject: "[TEST] Transfer Request Pending BU Approval",
    role: "BU_MANAGER",
    message: "Transfer TRF-TEST-001 requires your approval.",
  },
  {
    type: "transfer_request_submitted",
    subject: "[TEST] New Transfer Request Submitted",
    role: "FINANCE_MANAGER",
    message: "New transfer TRF-TEST-001 has been submitted and requires Finance review.",
  },
  {
    type: "transfer_request_pending_finance_approval",
    subject: "[TEST] Transfer Pending Finance Approval",
    role: "FINANCE_MANAGER",
    message: "Transfer TRF-TEST-001 approved by BU Manager — awaiting Finance review.",
  },
  {
    type: "transfer_request_rejected_by_bu",
    subject: "[TEST] Transfer Request Rejected by BU Manager",
    role: "UNIT_STAFF",
    message: "Transfer TRF-TEST-001 was rejected by BU Manager.",
  },
  {
    type: "transfer_approved_for_issue",
    subject: "[TEST] Transfer Approved for Issuance",
    role: "WAREHOUSE_MANAGER",
    message: "Transfer TRF-TEST-001 has been approved for issuance by Finance.",
  },
  {
    type: "transfer_rejected",
    subject: "[TEST] Transfer Rejected by Finance",
    role: "WAREHOUSE_MANAGER",
    message: "Transfer TRF-TEST-001 was rejected by Finance.",
  },
  // ── Goods issued ──────────────────────────────────────────────────────────
  {
    type: "goods_issued",
    subject: "[TEST] Goods Issued from Warehouse",
    role: "BU_MANAGER",
    message: "Goods for transfer TRF-TEST-001 have been issued from the warehouse.",
  },
  // ── GRN / variance ────────────────────────────────────────────────────────
  {
    type: "grn_variance",
    subject: "[TEST] GRN Variance Detected",
    role: "WAREHOUSE_MANAGER",
    message: "GRN reported a variance on transfer TRF-TEST-001. Please review.",
  },
  {
    type: "variance_proposal_submitted",
    subject: "[TEST] Variance Proposal Submitted",
    role: "FINANCE_MANAGER",
    message:
      "Variance resolution proposal submitted for transfer TRF-TEST-001 — pending Finance review.",
  },
  {
    type: "variance_proposal_approved",
    subject: "[TEST] Variance Proposal Approved",
    role: "WAREHOUSE_MANAGER",
    message: "Variance resolution proposal for transfer TRF-TEST-001 was approved by Finance.",
  },
  {
    type: "variance_proposal_rejected",
    subject: "[TEST] Variance Proposal Rejected",
    role: "WAREHOUSE_MANAGER",
    message:
      "Variance resolution proposal for transfer TRF-TEST-001 was rejected by Finance. Please revise.",
  },
  {
    type: "variance_disposed",
    subject: "[TEST] Variance Disposed by BU Manager",
    role: "WAREHOUSE_MANAGER",
    message: "Variance disposition submitted for transfer TRF-TEST-001 — check Loss Account.",
  },
  // ── Return requests ───────────────────────────────────────────────────────
  {
    type: "return_request_submitted",
    subject: "[TEST] Return Request Submitted",
    role: "BU_MANAGER",
    message: "Return request RET-TEST-001 requires your approval.",
  },
  {
    type: "return_approved",
    subject: "[TEST] Return Request Approved",
    role: "WAREHOUSE_MANAGER",
    message:
      "Return request RET-TEST-001 has been approved and is awaiting receipt at the warehouse.",
  },
  {
    type: "return_rejected",
    subject: "[TEST] Return Request Rejected",
    role: "UNIT_STAFF",
    message: "Return request RET-TEST-001 was rejected by your BU Manager.",
  },
  {
    type: "return_received",
    subject: "[TEST] Return Received at Warehouse",
    role: "BU_MANAGER",
    message:
      "Return request RET-TEST-001 has been received at the warehouse and stock has been restored.",
  },
  {
    type: "return_stock_restored",
    subject: "[TEST] Return Stock Restored (Finance Approved)",
    role: "BU_MANAGER",
    message: "Return RET-TEST-001 approved by Finance — stock restored.",
  },
  {
    type: "return_rejected_by_finance",
    subject: "[TEST] Return Rejected by Finance",
    role: "BU_MANAGER",
    message: "Return RET-TEST-001 was rejected by Finance.",
  },
  // ── Supplier GRN ──────────────────────────────────────────────────────────
  {
    type: "supplier_grn_awaiting_approval",
    subject: "[TEST] Supplier GRN Awaiting Finance Approval",
    role: "FINANCE_MANAGER",
    message: "Supplier GRN SGRN-TEST-001 requires Finance approval before stock can be updated.",
  },
  {
    type: "supplier_grn_approved",
    subject: "[TEST] Supplier GRN Approved",
    role: "WAREHOUSE_MANAGER",
    message: "Supplier GRN SGRN-TEST-001 approved — stock updated.",
  },
  {
    type: "supplier_grn_rejected",
    subject: "[TEST] Supplier GRN Rejected",
    role: "WAREHOUSE_MANAGER",
    message: "Supplier GRN SGRN-TEST-001 rejected by Finance.",
  },
  {
    type: "supplier_grn_packing_variance",
    subject: "[TEST] Supplier GRN Packing Variance",
    role: "ADMIN",
    message: "Packing variance detected on Supplier GRN SGRN-TEST-001.",
  },
  // ── Damage write-off ──────────────────────────────────────────────────────
  {
    type: "damage_writeoff",
    subject: "[TEST] Damage Write-off Recorded",
    role: "FINANCE_MANAGER",
    message: "Damage write-off recorded: 10 units of Test Product (SKU-001) — expired goods.",
  },
  // ── Damage recall ─────────────────────────────────────────────────────────
  {
    type: "damage_recall",
    subject: "[TEST] Damage Ledger Entry Recalled",
    role: "ADMIN",
    message: "Damage ledger entry has been recalled by Admin — stock reinstated.",
  },
];

async function run() {
  console.log(`Sending ${testCases.length} test emails to ${TO}\n`);

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const html = buildNotificationEmail({ type: tc.type, role: tc.role, message: tc.message });
      await transporter.sendMail({ from: FROM, to: TO, subject: tc.subject, html });
      console.log(`  ✓  ${tc.type}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗  ${tc.type} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${passed} sent, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run();
