import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const SUPPORT_RECIPIENT = "david.okuku@harvestgl.net";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const supportIssueRequests = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const current = supportIssueRequests.get(ip);

  if (!current || current.resetAt <= now) {
    supportIssueRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  return false;
}

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

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many support requests" }, { status: 429 });
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = asTrimmedString(body?.name);
  const issue = asTrimmedString(body?.issue);
  const role = asTrimmedString(body?.role);
  const sbu = asTrimmedString(body?.sbu);
  const path = asTrimmedString(body?.path);

  if (!name || !issue) {
    return NextResponse.json({ error: "Name and issue are required" }, { status: 400 });
  }

  if (name.length > 120 || issue.length > 4000) {
    return NextResponse.json({ error: "Support request is too long" }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const contextRows = [
    role ? `<li><strong>Role:</strong> ${escapeHtml(role)}</li>` : "",
    sbu ? `<li><strong>SBU:</strong> ${escapeHtml(sbu)}</li>` : "",
    path ? `<li><strong>Page:</strong> ${escapeHtml(path)}</li>` : "",
    `<li><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</li>`,
  ]
    .filter(Boolean)
    .join("");
  const sanitizedName = name.replace(/[\r\n]/g, " ");

  try {
    await sendEmail(
      SUPPORT_RECIPIENT,
      `Harvest WMS Support Issue: ${sanitizedName}`,
      `<h2>Harvest WMS Support Issue</h2>
       <p><strong>Name:</strong> ${escapeHtml(name)}</p>
       <p><strong>Issue:</strong></p>
       <p>${escapeHtml(issue).replace(/\n/g, "<br />")}</p>
       <h3>Context</h3>
       <ul>${contextRows}</ul>`,
    );
  } catch {
    return NextResponse.json(
      { error: "We couldn't send your support issue. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Support issue sent" });
}
