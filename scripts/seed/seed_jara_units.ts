/**
 * seed_jara_units.ts
 *
 * Replaces all units (branches) for the Jara Retail FMCG Store SBU with the
 * canonical 14-branch list.
 *
 * What it does:
 *   1. Looks up (or upserts) the JARA SBU
 *   2. Deactivates every existing JARA unit
 *   3. Upserts the 14 canonical branches (matched by code, name updated)
 *   4. Prints a summary
 *
 * Note: deactivation rather than deletion is used so that existing profile and
 * transfer_request foreign-key references are not broken.
 *
 * Usage:
 *   npx tsx scripts/seed/seed_jara_units.ts
 *   npm run seed:jara:units
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ─── Configuration ────────────────────────────────────────────────────────────

const JARA_CODE = "JARA";
const JARA_NAME = "Jara Retail FMCG Store";

const JARA_UNITS = [
  { name: "Lilayi", code: "JARA-LLY" },
  { name: "Kasupe", code: "JARA-KSP" },
  { name: "13 Miles", code: "JARA-13M" },
  { name: "Makeni", code: "JARA-MKN" },
  { name: "Chilanga", code: "JARA-CLG" },
  { name: "Tokyo Way", code: "JARA-TWY" },
  { name: "Woodlands", code: "JARA-WLD" },
  { name: "Buluwe", code: "JARA-BLW" },
  { name: "Main Street", code: "JARA-MST" },
  { name: "3rd Street", code: "JARA-3ST" },
  { name: "Avondale", code: "JARA-AVD" },
  { name: "Great East", code: "JARA-GER" },
  { name: "Ngwerere", code: "JARA-NGW" },
  { name: "Airport", code: "JARA-APT" },
];

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Upsert JARA SBU ──────────────────────────────────────────────────────
  console.log("[1] Upserting JARA SBU…");
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert({ name: JARA_NAME, code: JARA_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const jaraId = sbuData.id;
  console.log(`  "${JARA_NAME}" (${JARA_CODE}) — id: ${jaraId}`);

  // ── 2. Deactivate all existing JARA units ────────────────────────────────────
  console.log("\n[2] Deactivating existing JARA units…");
  const { data: deactivated, error: deactErr } = await supabase
    .from("sbu_units")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("sbu_id", jaraId)
    .select("id, code");
  if (deactErr) throw deactErr;
  console.log(`  Deactivated ${(deactivated ?? []).length} unit(s)`);

  // ── 3. Upsert canonical 14 units ─────────────────────────────────────────────
  console.log("\n[3] Upserting 14 canonical JARA units…");
  const inserts = JARA_UNITS.map((u) => ({
    name: u.name,
    code: u.code,
    sbu_id: jaraId,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const { data: upsertData, error: upsertErr } = await supabase
    .from("sbu_units")
    .upsert(inserts, { onConflict: "sbu_id,code" })
    .select("id, code, name");
  if (upsertErr) throw upsertErr;

  const units = upsertData ?? [];
  console.log(`  Upserted ${units.length} unit(s):`);
  for (const u of units) {
    console.log(`    ${u.code.padEnd(12)} ${u.name}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n✓ Done. JARA now has ${units.length} active units.`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
