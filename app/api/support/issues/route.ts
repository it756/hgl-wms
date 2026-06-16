import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email";

const SUPPORT_RECIPIENT = "david.okuku@harvestgl.net";

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

  await sendEmail(
    SUPPORT_RECIPIENT,
    `Harvest WMS Support Issue: ${name}`,
    `<h2>Harvest WMS Support Issue</h2>
     <p><strong>Name:</strong> ${escapeHtml(name)}</p>
     <p><strong>Issue:</strong></p>
     <p>${escapeHtml(issue).replace(/\n/g, "<br />")}</p>
     <h3>Context</h3>
     <ul>${contextRows}</ul>`,
  );

  return NextResponse.json({ message: "Support issue sent" });
}
