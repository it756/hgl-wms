/**
 * scripts/reports/email-activity-report.ts
 *
 * Reports on WMS email activity: who emails were sent to, and when.
 *
 * Data source: audit_logs (entity_type = "email"). Every call to
 * lib/email.ts#sendEmail() now writes one row per attempt:
 *   - action = "email_sent"        → delivery succeeded
 *   - action = "email_dead_letter" → delivery permanently failed (or
 *                                     exhausted retries) — see details.lastError
 *
 * NOTE: this logging was added 2026-07-04. Emails sent before that date are
 * not represented here (except permanent failures, which were already logged
 * to audit_logs as "email_dead_letter" prior to this change).
 *
 * Usage:
 *   npx tsx scripts/reports/email-activity-report.ts
 *   npx tsx scripts/reports/email-activity-report.ts --from=2026-07-01 --to=2026-07-04
 *   npx tsx scripts/reports/email-activity-report.ts --to-email=jane@company.com
 *   npx tsx scripts/reports/email-activity-report.ts --csv=email-report.csv
 *
 * Requires the same env vars as the rest of the app (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY) — loaded via dotenv/config, same as
 * scripts/test-emails.ts.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const from = arg("from"); // YYYY-MM-DD
  const to = arg("to"); // YYYY-MM-DD
  const toEmail = arg("to-email");
  const csvPath = arg("csv");
  const limit = Number(arg("limit") ?? "500");

  let query = supabaseAdmin
    .from("audit_logs")
    .select("id, action, entity_id, details, created_at")
    .eq("entity_type", "email")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  if (toEmail) query = query.eq("entity_id", toEmail);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((row) => {
    const details = (row.details ?? {}) as Record<string, unknown>;
    return {
      when: row.created_at,
      to: (details.to as string) ?? row.entity_id ?? "",
      subject: (details.subject as string) ?? "",
      status: row.action === "email_sent" ? "SENT" : "FAILED",
      attempts: details.attempts ?? "",
      error: row.action === "email_dead_letter" ? (details.lastError ?? "") : "",
    };
  });

  if (rows.length === 0) {
    console.log("No email activity found for the given filters.");
    return;
  }

  console.table(rows);
  console.log(`\n${rows.length} email(s) — ${rows.filter((r) => r.status === "SENT").length} sent, ${
    rows.filter((r) => r.status === "FAILED").length
  } failed.`);

  if (csvPath) {
    const header = "when,to,subject,status,attempts,error";
    const csvRows = rows.map((r) =>
      [r.when, r.to, r.subject, r.status, r.attempts, r.error]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    writeFileSync(csvPath, [header, ...csvRows].join("\n"), "utf-8");
    console.log(`\nWrote CSV to ${csvPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
