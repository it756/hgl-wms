/**
 * seed_jara_clusters.ts
 *
 * Creates three "Jara Stock Cluster" SBUs (JSC1, JSC2, JSC3), populates their
 * branch units with a geographic split of the 14 canonical JARA branches, copies
 * the full JARA warehouse stock to each cluster via approved supplier GRNs, and
 * provisions the BU Manager accounts for each cluster.
 *
 * What it does (additive — leaves the original JARA SBU untouched):
 *   1. Upsert SBUs: "Jara Stock Cluster 1/2/3" (codes JSC1, JSC2, JSC3)
 *   2. Upsert branch units for each cluster (geographic split of 14 JARA branches)
 *        Cluster 1 — Southern Corridor: Lilayi, Kasupe, 13 Miles, Chilanga, Makeni
 *        Cluster 2 — City Centre:       Main Street, 3rd Street, Woodlands, Buluwe, Avondale
 *        Cluster 3 — East & North:      Tokyo Way, Great East, Ngwerere, Airport
 *   3. Copy full JARA stock to each cluster via supplier_grns (status = GRN_APPROVED)
 *      — only active JARA products with stock_quantity > 0 are included
 *   4. Provision users:
 *        oghenetejiri.edje@harvestgl.net — BU_MANAGER, JSC1 (existing account — profile reassigned)
 *        adauwa@harvestgl.net            — BU_MANAGER, JSC2 (new account)
 *        ezinne.obidike@harvestgl.net    — BU_MANAGER, JSC3 (new account)
 *        chiedozie.alozie@harvestgl.net  — WAREHOUSE_MANAGER, global (confirm/upsert existing)
 *
 * Idempotent: re-running the script is safe. SBU and unit upserts use onConflict
 * guards; GRNs are skipped if a matching reference_number already exists.
 *
 * Default password for new accounts: Demo@1234!
 *
 * Usage:
 *   npx tsx scripts/seed/seed_jara_clusters.ts
 *   npm run seed:jara:clusters
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

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

const DEFAULT_PASSWORD = "Demo@1234!";

// ─── SBU definitions ─────────────────────────────────────────────────────────

const CLUSTER_SBUS = [
  { name: "Jara Stock Cluster 1", code: "JSC1" },
  { name: "Jara Stock Cluster 2", code: "JSC2" },
  { name: "Jara Stock Cluster 3", code: "JSC3" },
] as const;

// ─── Branch units per cluster (geographic split of the 14 canonical JARA branches) ──

const CLUSTER_UNITS: Record<string, { name: string; code: string }[]> = {
  JSC1: [
    { name: "Lilayi", code: "JSC1-LLY" },
    { name: "Kasupe", code: "JSC1-KSP" },
    { name: "13 Miles", code: "JSC1-13M" },
    { name: "Chilanga", code: "JSC1-CLG" },
    { name: "Makeni", code: "JSC1-MKN" },
  ],
  JSC2: [
    { name: "Main Street", code: "JSC2-MST" },
    { name: "3rd Street", code: "JSC2-3ST" },
    { name: "Woodlands", code: "JSC2-WLD" },
    { name: "Buluwe", code: "JSC2-BLW" },
    { name: "Avondale", code: "JSC2-AVD" },
  ],
  JSC3: [
    { name: "Tokyo Way", code: "JSC3-TWY" },
    { name: "Great East", code: "JSC3-GER" },
    { name: "Ngwerere", code: "JSC3-NGW" },
    { name: "Airport", code: "JSC3-APT" },
  ],
};

// ─── BU manager provisioning config ──────────────────────────────────────────

interface BuManagerConfig {
  email: string;
  fullName: string;
  clusterCode: string;
  /** true = already has an auth account; update profile only */
  existsInAuth: boolean;
}

const BU_MANAGERS: BuManagerConfig[] = [
  {
    email: "oghenetejiri.edje@harvestgl.net",
    fullName: "Oghenetejiri Edje",
    clusterCode: "JSC1",
    existsInAuth: true,
  },
  {
    email: "adauwa@harvestgl.net",
    fullName: "Adauwa",
    clusterCode: "JSC2",
    existsInAuth: false,
  },
  {
    email: "ezinne.obidike@harvestgl.net",
    fullName: "Ezinne Obidike",
    clusterCode: "JSC3",
    existsInAuth: false,
  },
];

const WAREHOUSE_MANAGER_EMAIL = "chiedozie.alozie@harvestgl.net";
const WAREHOUSE_MANAGER_NAME = "Chiedozie Alozie";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAhead(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split("T")[0];
}

/**
 * Looks up an auth user by email address, paging through all users if needed.
 * Returns the user's UUID or null if not found.
 */
async function lookupUserByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000, page });
    if (error) throw new Error(`lookupUserByEmail: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (users.length < 1000) break;
    page++;
  }
  return null;
}

/**
 * Creates a new Supabase auth user and the corresponding profile row.
 * License type is derived from role following the existing seed_prod.ts convention.
 */
async function createUser(
  email: string,
  fullName: string,
  role: string,
  sbuId: string | null,
): Promise<string> {
  const licenseType =
    role === "WAREHOUSE_MANAGER"
      ? "WAREHOUSE_OPERATIONS"
      : role === "FINANCE_MANAGER"
        ? "FINANCE_APPROVAL"
        : "GENERAL_OPERATIONS";

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName, sbu_id: sbuId },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      full_name: fullName,
      role,
      sbu_id: sbuId,
      unit_id: null,
      is_active: true,
      licensed: true,
      license_type: licenseType,
      license_issued_at: new Date().toISOString(),
      license_expires_at: daysAhead(365),
    },
    { onConflict: "id" },
  );
  if (profileErr) throw new Error(`Profile insert for ${email}: ${profileErr.message}`);

  console.log(`    + created  ${email}  (${role})`);
  return data.user.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── STEP 1: Upsert Cluster SBUs ───────────────────────────────────────────
  console.log("\n[1] Upserting Jara Stock Cluster SBUs…");

  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert(
      CLUSTER_SBUS.map((s) => ({ ...s, is_active: true })),
      { onConflict: "code" },
    )
    .select("id, code, name");
  if (sbuError) throw sbuError;

  const sbuMap: Record<string, string> = {};
  for (const s of sbuData ?? []) {
    sbuMap[s.code] = s.id;
    console.log(`  ✓ ${s.name} (${s.code}) — id: ${s.id}`);
  }

  // ── STEP 2: Upsert branch units ───────────────────────────────────────────
  console.log("\n[2] Upserting branch units…");

  for (const [clusterCode, units] of Object.entries(CLUSTER_UNITS)) {
    const sbuId = sbuMap[clusterCode];
    if (!sbuId) throw new Error(`SBU ID not found for ${clusterCode}`);

    const inserts = units.map((u) => ({
      name: u.name,
      code: u.code,
      sbu_id: sbuId,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { data: upsertData, error: upsertErr } = await supabase
      .from("sbu_units")
      .upsert(inserts, { onConflict: "sbu_id,code" })
      .select("code, name");
    if (upsertErr) throw upsertErr;

    const names = (upsertData ?? []).map((u) => u.name).join(", ");
    console.log(`  ${clusterCode} (${(upsertData ?? []).length} units): ${names}`);
  }

  // ── STEP 3: Stock distribution via supplier_grns ──────────────────────────
  console.log("\n[3] Copying JARA stock to each cluster…");

  // 3a. Resolve the received_by user — prefer chiedozie, fall back to any WM/Admin
  let receivedById = await lookupUserByEmail(WAREHOUSE_MANAGER_EMAIL);

  if (!receivedById) {
    console.log(
      `  ⚠  ${WAREHOUSE_MANAGER_EMAIL} not found in auth yet — ` +
        `falling back to existing WAREHOUSE_MANAGER or ADMIN for received_by`,
    );
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["WAREHOUSE_MANAGER", "ADMIN"])
      .eq("is_active", true)
      .limit(1)
      .single();
    receivedById = fallback?.id ?? null;
  }

  if (!receivedById) {
    throw new Error(
      `Cannot create supplier GRNs: no suitable user found for received_by.\n` +
        `Ensure ${WAREHOUSE_MANAGER_EMAIL} or another WAREHOUSE_MANAGER/ADMIN account exists in the database.`,
    );
  }

  // 3b. Fetch active JARA products with positive stock
  const { data: jaraProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, sku, name, stock_quantity, unit_cost")
    .like("sku", "JARA-%")
    .eq("is_active", true)
    .gt("stock_quantity", 0);
  if (prodErr) throw prodErr;

  const productCount = jaraProducts?.length ?? 0;
  console.log(`  Found ${productCount} active JARA product(s) with stock > 0`);

  if (productCount === 0) {
    console.warn("  ⚠  No JARA products found with stock — GRN seeding skipped");
  } else {
    const today = new Date().toISOString().split("T")[0];
    // Use a date-based suffix so the reference is human-readable and stable per run-day
    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    for (const cluster of CLUSTER_SBUS) {
      const sbuId = sbuMap[cluster.code];
      const refNum = `SEED-${cluster.code}-${dateSuffix}`;

      // Idempotency guard — skip if GRN already exists for this cluster+date
      const { data: existing } = await supabase
        .from("supplier_grns")
        .select("id")
        .eq("reference_number", refNum)
        .maybeSingle();

      if (existing) {
        console.log(`  ${cluster.code}: GRN "${refNum}" already exists — skipping`);
        continue;
      }

      // Insert the approved GRN
      const { data: grn, error: grnErr } = await supabase
        .from("supplier_grns")
        .insert({
          reference_number: refNum,
          supplier_name: "JARA Stock Distribution",
          supplier_invoice_reference: `JARA-SEED-${cluster.code}`,
          received_by: receivedById,
          date_received: today,
          status: "GRN_APPROVED",
          approved_by: receivedById,
          approved_at: new Date().toISOString(),
          approval_notes: "Seeded via seed_jara_clusters.ts",
          sbu_id: sbuId,
        })
        .select("id")
        .single();
      if (grnErr) throw new Error(`GRN insert for ${cluster.code}: ${grnErr.message}`);

      // Bulk-insert line items in batches to stay within PostgREST limits
      const lineItems = (jaraProducts ?? []).map((p) => ({
        supplier_grn_id: grn.id,
        product_id: p.id,
        quantity_received: p.stock_quantity as number,
        unit_cost: p.unit_cost ?? null,
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < lineItems.length; i += BATCH_SIZE) {
        const { error: liErr } = await supabase
          .from("supplier_grn_line_items")
          .insert(lineItems.slice(i, i + BATCH_SIZE));
        if (liErr) throw new Error(`Line items batch for ${cluster.code}: ${liErr.message}`);
      }

      console.log(`  ✓ ${cluster.name}: GRN ${refNum} — ${lineItems.length} product(s) assigned`);
    }
  }

  // ── STEP 4: BU Manager accounts ───────────────────────────────────────────
  console.log("\n[4] Provisioning BU Managers…");

  for (const mgr of BU_MANAGERS) {
    const sbuId = sbuMap[mgr.clusterCode];
    if (!sbuId) throw new Error(`SBU ID not found for cluster ${mgr.clusterCode}`);

    if (mgr.existsInAuth) {
      // Existing auth account — reassign profile to the new cluster SBU
      const userId = await lookupUserByEmail(mgr.email);
      if (!userId) {
        console.warn(
          `  ⚠  ${mgr.email} marked as existing but not found in auth — skipping reassignment`,
        );
        continue;
      }
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ sbu_id: sbuId, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (updateErr) throw new Error(`Profile update for ${mgr.email}: ${updateErr.message}`);
      console.log(`  ↪  ${mgr.email} → reassigned to ${mgr.clusterCode}`);
    } else {
      // Brand-new auth account
      const existingId = await lookupUserByEmail(mgr.email);
      if (existingId) {
        // Already exists from a previous run — just ensure profile is up to date
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ sbu_id: sbuId, role: "BU_MANAGER", updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (updateErr) throw new Error(`Profile update for ${mgr.email}: ${updateErr.message}`);
        console.log(`  ↻  ${mgr.email} already exists — profile synced (${mgr.clusterCode})`);
      } else {
        await createUser(mgr.email, mgr.fullName, "BU_MANAGER", sbuId);
      }
    }
  }

  // ── STEP 5: Confirm Warehouse Manager ────────────────────────────────────
  console.log("\n[5] Confirming Warehouse Manager…");

  const wmUserId = await lookupUserByEmail(WAREHOUSE_MANAGER_EMAIL);

  if (!wmUserId) {
    // Not in auth at all — create the account
    console.log(`  ${WAREHOUSE_MANAGER_EMAIL} not found — creating account…`);
    await createUser(WAREHOUSE_MANAGER_EMAIL, WAREHOUSE_MANAGER_NAME, "WAREHOUSE_MANAGER", null);
  } else {
    // Exists — upsert profile to ensure correct role and license
    const { error: wmErr } = await supabase.from("profiles").upsert(
      {
        id: wmUserId,
        full_name: WAREHOUSE_MANAGER_NAME,
        role: "WAREHOUSE_MANAGER",
        sbu_id: null,
        unit_id: null,
        is_active: true,
        licensed: true,
        license_type: "WAREHOUSE_OPERATIONS",
        license_issued_at: new Date().toISOString(),
        license_expires_at: daysAhead(365),
      },
      { onConflict: "id" },
    );
    if (wmErr) throw new Error(`Profile upsert for ${WAREHOUSE_MANAGER_EMAIL}: ${wmErr.message}`);
    console.log(`  ✓  ${WAREHOUSE_MANAGER_EMAIL} confirmed as WAREHOUSE_MANAGER`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalUnits = Object.values(CLUSTER_UNITS).reduce((acc, u) => acc + u.length, 0);
  console.log("\n────────────────────────────────────────────────────────");
  console.log("✅  seed_jara_clusters complete");
  console.log(`    SBUs:   Jara Stock Cluster 1 (JSC1), 2 (JSC2), 3 (JSC3)`);
  console.log(`    Units:  5 (JSC1) + 5 (JSC2) + 4 (JSC3) = ${totalUnits} branches`);
  console.log(
    `    Stock:  ${productCount} JARA product(s) copied to each cluster via supplier GRNs`,
  );
  console.log("────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
