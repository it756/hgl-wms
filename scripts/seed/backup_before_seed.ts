/**
 * backup_before_seed.ts
 *
 * Dumps the current state of all seed-affected tables to a timestamped JSON
 * folder under scripts/seed/backups/ before any seed script runs.
 *
 * Usage (standalone):
 *   npx tsx scripts/seed/backup_before_seed.ts
 *   npm run seed:backup
 *
 * It is automatically chained before every seed:* npm script.
 *
 * Output:
 *   scripts/seed/backups/YYYY-MM-DDTHH-MM-SS/
 *     sbus.json
 *     sbu_units.json
 *     products.json
 *     profiles.json
 *     transfer_requests.json
 *     transfer_line_items.json
 *     issuances.json
 *     issuance_line_items.json
 *     grns.json
 *     grn_line_items.json
 *     supplier_grns.json
 *     supplier_grn_line_items.json
 *     variance_dispositions.json
 *     stock_losses.json
 *     manifest.json   ← row counts + timestamp
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKUP_ROOT = path.resolve("scripts/seed/backups");

/** Tables to snapshot, in dependency order (parents before children). */
const TABLES = [
  "sbus",
  "sbu_units",
  "products",
  "profiles",
  "transfer_requests",
  "transfer_line_items",
  "issuances",
  "issuance_line_items",
  "grns",
  "grn_line_items",
  "supplier_grns",
  "supplier_grn_line_items",
  "variance_dispositions",
  "stock_losses",
] as const;

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format current time as a folder-safe string: 2026-07-20T14-35-02 */
function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "") // drop milliseconds + Z
    .replace(/:/g, "-"); // colons → dashes (safe on Windows)
}

/**
 * Fetch all rows from a table using cursor pagination so tables > 1 000 rows
 * are captured in full (Supabase default page size is 1 000).
 */
async function fetchAll(table: string): Promise<unknown[]> {
  const PAGE = 1000;
  const rows: unknown[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1)
      .order("created_at" as never, { ascending: true, nullsFirst: true });

    if (error) {
      // Some tables may not have created_at — fall back to unordered single fetch
      const { data: fallback, error: fbErr } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (fbErr) throw new Error(`[${table}] ${fbErr.message}`);
      rows.push(...(fallback ?? []));
      if ((fallback ?? []).length < PAGE) break;
    } else {
      rows.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }

    from += PAGE;
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const ts = timestamp();
  const backupDir = path.join(BACKUP_ROOT, ts);

  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`\n[Backup] Saving snapshot → ${backupDir}`);

  const manifest: Record<string, number> = {};

  for (const table of TABLES) {
    process.stdout.write(`  ${table.padEnd(28)} … `);
    try {
      const rows = await fetchAll(table);
      fs.writeFileSync(
        path.join(backupDir, `${table}.json`),
        JSON.stringify(rows, null, 2),
        "utf8",
      );
      manifest[table] = rows.length;
      console.log(`${rows.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Non-fatal: table may not exist in this environment (e.g. older schema)
      console.log(`SKIPPED (${msg})`);
      manifest[table] = -1;
    }
  }

  // Write manifest with metadata
  fs.writeFileSync(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        supabase_url: supabaseUrl.replace(/^(https?:\/\/[^.]{4})[^@]+/, "$1***"),
        tables: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  const total = Object.values(manifest)
    .filter((n) => n >= 0)
    .reduce((a, b) => a + b, 0);
  console.log(`\n✓ Backup complete — ${total.toLocaleString()} total rows in ${backupDir}`);
  console.log(`  Restore: copy the JSON files back manually or write a restore script.\n`);
}

main().catch((err) => {
  console.error("\n✗ Backup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
