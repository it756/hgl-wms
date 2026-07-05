import "dotenv/config";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "../../lib/supabaseServer";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  sbu_id?: string | null;
  whatsapp_number?: string | null;
  is_active?: boolean | null;
};

async function run() {
  console.log("Querying profiles...");

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sbu_id, whatsapp_number, is_active");

  if (error) throw error;

  const rows: Array<Record<string, string>> = [];

  for (const p of (profiles as ProfileRow[]) ?? []) {
    let email: string | null = null;
    try {
      // Use admin endpoint to fetch the auth user email for this profile id
      // supabaseAdmin.auth.admin.getUserById is used elsewhere in the codebase
      const { data } = await (supabaseAdmin.auth as any).admin.getUserById(p.id);
      email = data?.user?.email ?? null;
    } catch (e) {
      // ignore per-user failures
      email = null;
    }

    const shouldReceive = Boolean(p.role && p.is_active);

    rows.push({
      id: p.id,
      full_name: p.full_name ?? "",
      role: p.role ?? "",
      sbu_id: p.sbu_id ?? "",
      whatsapp_number: p.whatsapp_number ?? "",
      is_active: String(Boolean(p.is_active)),
      email: email ?? "",
      should_receive: String(shouldReceive),
      missing_email: String(shouldReceive && !email),
    });
  }

  const outDir = path.join(__dirname);
  const outPath = path.join(outDir, "email-recipients.csv");

  const header = [
    "id",
    "full_name",
    "role",
    "sbu_id",
    "whatsapp_number",
    "is_active",
    "email",
    "should_receive",
    "missing_email",
  ];

  const csv = [header.join(",")]
    .concat(
      rows.map((r) =>
        header
          .map((h) => {
            const v = (r as any)[h] ?? "";
            // simple CSV escaping of double-quotes
            return v.includes(",") || v.includes("\n") || v.includes('"')
              ? `"${String(v).replace(/"/g, '""')}"`
              : String(v);
          })
          .join(","),
      ),
    )
    .join("\n");

  fs.writeFileSync(outPath, csv, "utf8");
  console.log(`Wrote ${rows.length} rows to ${outPath}`);

  // Print a summary
  const totals: Record<string, { total: number; missingEmail: number }> = {};
  let totalShould = 0;
  let totalMissing = 0;
  for (const r of rows) {
    const role = r.role || "(none)";
    if (!totals[role]) totals[role] = { total: 0, missingEmail: 0 };
    if (r.should_receive === "true") {
      totals[role].total += 1;
      totalShould += 1;
      if (r.missing_email === "true") {
        totals[role].missingEmail += 1;
        totalMissing += 1;
      }
    }
  }

  console.log("\nSummary of recipients by role (only profiles that should receive emails are counted):");
  for (const role of Object.keys(totals).sort()) {
    const t = totals[role];
    console.log(` - ${role}: ${t.total} should receive, ${t.missingEmail} missing email`);
  }
  console.log(`\nTotal profiles that should receive emails: ${totalShould}`);
  console.log(`Total missing email addresses: ${totalMissing}`);

  if (totalMissing > 0) {
    console.log("See the CSV file for detailed rows and to follow up on missing contacts.");
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
