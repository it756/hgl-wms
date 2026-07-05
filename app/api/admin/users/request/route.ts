import { NextResponse } from "next/server";
import { sendEmail } from "../../../../../lib/email";
import { getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import type { UserRole } from "../../../../../lib/models/user";

const REQUEST_RECIPIENT = "david.okuku@harvestgl.net";

const VALID_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
];

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * POST /api/admin/users/request
 * Admin-only: submit a request to create and license a proposed new user.
 * Does NOT create the account — sends an email to the operations team for
 * manual creation/licensing instead.
 */
export async function POST(req: Request) {
  const caller = await getUserFromAuthHeader(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callerMetadata = caller.user_metadata as { role?: string; full_name?: string } | null;
  const callerRole = callerMetadata?.role ?? "";
  if (callerRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fullName = asTrimmedString(body?.full_name);
  const email = asTrimmedString(body?.email);
  const role = asTrimmedString(body?.role) as UserRole;
  const sbuLabel = asTrimmedString(body?.sbu_label);

  if (!email || !role) {
    return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const requestedByLabel = callerMetadata?.full_name || caller.email || caller.id;

  try {
    await sendEmail(
      REQUEST_RECIPIENT,
      `Harvest WMS: New User Request — ${email}`,
      `<h2>New User Creation Request</h2>
       <p>An administrator has requested the creation and licensing of a new Harvest WMS account.</p>
       <table style="border-collapse:collapse;">
         <tr><td style="padding:4px 8px;font-weight:bold;">Full Name</td><td style="padding:4px 8px;">${escapeHtml(fullName) || "—"}</td></tr>
         <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td style="padding:4px 8px;">${escapeHtml(email)}</td></tr>
         <tr><td style="padding:4px 8px;font-weight:bold;">Proposed Role</td><td style="padding:4px 8px;">${escapeHtml(role)}</td></tr>
         <tr><td style="padding:4px 8px;font-weight:bold;">SBU</td><td style="padding:4px 8px;">${escapeHtml(sbuLabel) || "Independent / Cross-cutting"}</td></tr>
         <tr><td style="padding:4px 8px;font-weight:bold;">Requested By</td><td style="padding:4px 8px;">${escapeHtml(requestedByLabel)}</td></tr>
         <tr><td style="padding:4px 8px;font-weight:bold;">Submitted</td><td style="padding:4px 8px;">${escapeHtml(submittedAt)}</td></tr>
       </table>
       <p style="margin-top:16px;">Please create and license this account, then notify the requesting administrator.</p>`,
    );
  } catch {
    return NextResponse.json(
      { error: "We couldn't send the user request. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Request sent" });
}
