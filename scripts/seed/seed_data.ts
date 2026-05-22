/**
 * Seed script — scripts/seed/seed_data.ts
 * Full demo seed for HGL-WMS with 5 SBUs:
 *   Jara (retail chain), Grand Access (pharmaceuticals), Bounty (wholesale),
 *   LaBamba (restaurant & bakery), HGC Transport & Logistics
 *
 * Run:  npx tsx scripts/seed/seed_data.ts
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * All demo accounts use password: Demo@1234!
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const DEMO_PASSWORD = "Demo@1234!";

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function daysAhead(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split("T")[0];
}
function trf(): string {
  return `TRF-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
}
function sgrn(): string {
  return `SGRN-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

async function upsertUser(
  email: string,
  fullName: string,
  role: string,
  sbuId: string | null,
  unitId: string | null = null,
): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      user_metadata: { role, full_name: fullName, sbu_id: sbuId, unit_id: unitId },
    });
    await supabase
      .from("profiles")
      .upsert(
        {
          id: existing.id,
          full_name: fullName,
          role,
          sbu_id: sbuId,
          unit_id: unitId,
          is_active: true,
        },
        { onConflict: "id" },
      );
    console.log(`    ~ updated  ${email}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName, sbu_id: sbuId, unit_id: unitId },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  await supabase
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        full_name: fullName,
        role,
        sbu_id: sbuId,
        unit_id: unitId,
        is_active: true,
      },
      { onConflict: "id" },
    );
  console.log(`    + created  ${email}`);
  return data.user.id;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. SBUs ────────────────────────────────────────────────────────────────
  console.log("\n[1/7] Seeding SBUs…");
  const sbuDefs = [
    { name: "Jara Retail Chain", code: "JARA" },
    { name: "Grand Access Pharmaceuticals", code: "GRAX" },
    { name: "Bounty Wholesale", code: "BNTY" },
    { name: "LaBamba Restaurant & Bakery", code: "LBMB" },
    { name: "HGC Transport & Logistics", code: "HGCT" },
  ];

  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert(sbuDefs, { onConflict: "code" })
    .select();
  if (sbuError) throw sbuError;

  const sbuMap: Record<string, string> = {};
  for (const s of sbuData ?? []) sbuMap[s.code] = s.id;
  console.log(`  Upserted ${sbuData?.length ?? 0} SBUs`);

  // ── 1b. SBU Units ──────────────────────────────────────────────────────────
  console.log("\n[1b] Seeding SBU units…");
  const unitDefs = [
    // Jara Retail Chain
    { name: "Store Floor", code: "JARA-SF", sbu_code: "JARA" },
    { name: "Back Office", code: "JARA-BO", sbu_code: "JARA" },
    { name: "Receiving Dock", code: "JARA-RD", sbu_code: "JARA" },
    // Grand Access Pharmaceuticals
    { name: "Dispensary", code: "GRAX-DS", sbu_code: "GRAX" },
    { name: "Cold Storage", code: "GRAX-CS", sbu_code: "GRAX" },
    { name: "Laboratory", code: "GRAX-LB", sbu_code: "GRAX" },
    // Bounty Wholesale
    { name: "Main Floor", code: "BNTY-MF", sbu_code: "BNTY" },
    { name: "Loading Bay", code: "BNTY-LB", sbu_code: "BNTY" },
    { name: "Administration", code: "BNTY-AD", sbu_code: "BNTY" },
    // LaBamba Restaurant & Bakery
    { name: "Kitchen", code: "LBMB-KT", sbu_code: "LBMB" },
    { name: "Bakery", code: "LBMB-BK", sbu_code: "LBMB" },
    { name: "Front of House", code: "LBMB-FH", sbu_code: "LBMB" },
    // HGC Transport & Logistics
    { name: "Fleet Ops", code: "HGCT-FO", sbu_code: "HGCT" },
    { name: "Dispatch", code: "HGCT-DS", sbu_code: "HGCT" },
    { name: "Maintenance", code: "HGCT-MT", sbu_code: "HGCT" },
  ];

  const unitInserts = unitDefs.map((u) => ({
    name: u.name,
    code: u.code,
    sbu_id: sbuMap[u.sbu_code],
  }));
  const { data: unitData, error: unitError } = await supabase
    .from("sbu_units")
    .upsert(unitInserts, { onConflict: "sbu_id,code" })
    .select();
  if (unitError) throw unitError;

  const unitMap: Record<string, string> = {};
  for (const u of unitData ?? []) unitMap[u.code] = u.id;
  console.log(`  Upserted ${unitData?.length ?? 0} SBU units`);

  // ── 2. Products ────────────────────────────────────────────────────────────
  console.log("\n[2/7] Seeding products…");
  const products = [
    // ── General / Office
    {
      name: "A4 Paper Ream",
      sku: "GEN-001",
      unit_of_measure: "ream",
      stock_quantity: 800,
      low_stock_threshold: 80,
      unit_cost: 4.5,
    },
    {
      name: "Ballpoint Pen Blue (Box of 50)",
      sku: "GEN-002",
      unit_of_measure: "box",
      stock_quantity: 300,
      low_stock_threshold: 30,
      unit_cost: 5.0,
    },
    {
      name: "Sticky Notes (Pack of 100)",
      sku: "GEN-003",
      unit_of_measure: "pack",
      stock_quantity: 250,
      low_stock_threshold: 25,
      unit_cost: 2.5,
    },
    {
      name: "File Folders (Box of 20)",
      sku: "GEN-004",
      unit_of_measure: "box",
      stock_quantity: 150,
      low_stock_threshold: 15,
      unit_cost: 8.0,
    },
    {
      name: "Printer Toner Cartridge (Black)",
      sku: "GEN-005",
      unit_of_measure: "unit",
      stock_quantity: 40,
      low_stock_threshold: 5,
      unit_cost: 85.0,
    },
    {
      name: "Hand Sanitizer 500ml",
      sku: "GEN-006",
      unit_of_measure: "bottle",
      stock_quantity: 400,
      low_stock_threshold: 40,
      unit_cost: 3.2,
    },

    // ── Retail — Jara Retail Chain
    {
      name: "Thermal Receipt Paper Roll 80mm",
      sku: "RTL-001",
      unit_of_measure: "roll",
      stock_quantity: 600,
      low_stock_threshold: 60,
      unit_cost: 1.2,
    },
    {
      name: "Reusable Shopping Bag (Large)",
      sku: "RTL-002",
      unit_of_measure: "unit",
      stock_quantity: 2000,
      low_stock_threshold: 200,
      unit_cost: 0.8,
    },
    {
      name: "Price Label Roll (1000 labels)",
      sku: "RTL-003",
      unit_of_measure: "roll",
      stock_quantity: 400,
      low_stock_threshold: 40,
      unit_cost: 3.5,
    },
    {
      name: "EAS Security Tag (Box of 100)",
      sku: "RTL-004",
      unit_of_measure: "box",
      stock_quantity: 80,
      low_stock_threshold: 10,
      unit_cost: 45.0,
    },
    {
      name: "Cardboard Display Box A3",
      sku: "RTL-005",
      unit_of_measure: "unit",
      stock_quantity: 500,
      low_stock_threshold: 50,
      unit_cost: 1.5,
    },
    {
      name: "Plastic Clothes Hangers (Pack of 50)",
      sku: "RTL-006",
      unit_of_measure: "pack",
      stock_quantity: 120,
      low_stock_threshold: 15,
      unit_cost: 12.0,
    },

    // ── Pharmaceutical — Grand Access
    {
      name: "Amber Medicine Bottles 60ml (Carton)",
      sku: "PHM-001",
      unit_of_measure: "carton",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 18.0,
    },
    {
      name: "Blister Pack Foil Roll (500m)",
      sku: "PHM-002",
      unit_of_measure: "roll",
      stock_quantity: 50,
      low_stock_threshold: 5,
      unit_cost: 120.0,
    },
    {
      name: "Prescription Label Roll (1500 labels)",
      sku: "PHM-003",
      unit_of_measure: "roll",
      stock_quantity: 300,
      low_stock_threshold: 30,
      unit_cost: 4.0,
    },
    {
      name: "Nitrile Gloves Medium (Box of 100)",
      sku: "PHM-004",
      unit_of_measure: "box",
      stock_quantity: 500,
      low_stock_threshold: 50,
      unit_cost: 9.5,
    },
    {
      name: "Medical Face Masks (Box of 50)",
      sku: "PHM-005",
      unit_of_measure: "box",
      stock_quantity: 400,
      low_stock_threshold: 40,
      unit_cost: 6.0,
    },
    {
      name: "Reusable Cold Pack 500g",
      sku: "PHM-006",
      unit_of_measure: "unit",
      stock_quantity: 150,
      low_stock_threshold: 15,
      unit_cost: 4.5,
    },
    {
      name: "Specimen Collection Kit",
      sku: "PHM-007",
      unit_of_measure: "unit",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 3.2,
    },

    // ── Wholesale — Bounty
    {
      name: "Stretch Wrap Film 500m Roll",
      sku: "WSL-001",
      unit_of_measure: "roll",
      stock_quantity: 100,
      low_stock_threshold: 10,
      unit_cost: 22.0,
    },
    {
      name: "Corrugated Carton Box (Medium)",
      sku: "WSL-002",
      unit_of_measure: "unit",
      stock_quantity: 2000,
      low_stock_threshold: 200,
      unit_cost: 0.9,
    },
    {
      name: "Packing Tape 48mm×100m",
      sku: "WSL-003",
      unit_of_measure: "roll",
      stock_quantity: 500,
      low_stock_threshold: 50,
      unit_cost: 2.8,
    },
    {
      name: "Polypropylene Strapping (Box)",
      sku: "WSL-004",
      unit_of_measure: "box",
      stock_quantity: 60,
      low_stock_threshold: 8,
      unit_cost: 35.0,
    },
    {
      name: "Standard Wooden Pallet",
      sku: "WSL-005",
      unit_of_measure: "unit",
      stock_quantity: 80,
      low_stock_threshold: 10,
      unit_cost: 28.0,
    },
    {
      name: "Industrial Cleaning Detergent 5L",
      sku: "WSL-006",
      unit_of_measure: "container",
      stock_quantity: 120,
      low_stock_threshold: 12,
      unit_cost: 14.0,
    },

    // ── Restaurant & Bakery — LaBamba
    {
      name: "All-Purpose Flour 50kg Sack",
      sku: "FNB-001",
      unit_of_measure: "sack",
      stock_quantity: 300,
      low_stock_threshold: 30,
      unit_cost: 38.0,
    },
    {
      name: "Refined Sugar 25kg Bag",
      sku: "FNB-002",
      unit_of_measure: "bag",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 22.0,
    },
    {
      name: "Sunflower Cooking Oil 20L Drum",
      sku: "FNB-003",
      unit_of_measure: "drum",
      stock_quantity: 100,
      low_stock_threshold: 10,
      unit_cost: 56.0,
    },
    {
      name: "Food-Safe Disposable Gloves (Box/100)",
      sku: "FNB-004",
      unit_of_measure: "box",
      stock_quantity: 400,
      low_stock_threshold: 40,
      unit_cost: 7.5,
    },
    {
      name: "Disposable Food Containers (Pack/50)",
      sku: "FNB-005",
      unit_of_measure: "pack",
      stock_quantity: 350,
      low_stock_threshold: 35,
      unit_cost: 11.0,
    },
    {
      name: "Baking Soda 5kg Bag",
      sku: "FNB-006",
      unit_of_measure: "bag",
      stock_quantity: 150,
      low_stock_threshold: 15,
      unit_cost: 8.0,
    },
    {
      name: "Disposable Cups 250ml (Sleeve/50)",
      sku: "FNB-007",
      unit_of_measure: "sleeve",
      stock_quantity: 600,
      low_stock_threshold: 60,
      unit_cost: 4.2,
    },
    {
      name: "Kitchen Aluminium Foil 30cm×100m",
      sku: "FNB-008",
      unit_of_measure: "roll",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 9.0,
    },

    // ── Transport & Logistics — HGC
    {
      name: "Engine Oil 10W-40 (4L Bottle)",
      sku: "TRP-001",
      unit_of_measure: "bottle",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 18.0,
    },
    {
      name: "High-Visibility Safety Vest",
      sku: "TRP-002",
      unit_of_measure: "unit",
      stock_quantity: 150,
      low_stock_threshold: 15,
      unit_cost: 8.5,
    },
    {
      name: "Heavy-Duty Cargo Ratchet Strap",
      sku: "TRP-003",
      unit_of_measure: "unit",
      stock_quantity: 100,
      low_stock_threshold: 10,
      unit_cost: 12.0,
    },
    {
      name: "Vehicle First Aid Kit (Standard)",
      sku: "TRP-004",
      unit_of_measure: "kit",
      stock_quantity: 60,
      low_stock_threshold: 6,
      unit_cost: 35.0,
    },
    {
      name: "Shipping Label Roll 4×6 (500 labels)",
      sku: "TRP-005",
      unit_of_measure: "roll",
      stock_quantity: 300,
      low_stock_threshold: 30,
      unit_cost: 6.0,
    },
    {
      name: "Safety Gloves Heavy Duty (Pair)",
      sku: "TRP-006",
      unit_of_measure: "pair",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 5.5,
    },
    {
      name: "Reflective Road Cone",
      sku: "TRP-007",
      unit_of_measure: "unit",
      stock_quantity: 80,
      low_stock_threshold: 8,
      unit_cost: 15.0,
    },
    {
      name: "Digital Tyre Pressure Gauge",
      sku: "TRP-008",
      unit_of_measure: "unit",
      stock_quantity: 30,
      low_stock_threshold: 4,
      unit_cost: 22.0,
    },
  ];

  const { data: prodData, error: prodError } = await supabase
    .from("products")
    .upsert(products, { onConflict: "sku" })
    .select();
  if (prodError) throw prodError;

  const pm: Record<string, string> = {};
  for (const p of prodData ?? []) pm[p.sku] = p.id;
  console.log(`  Upserted ${prodData?.length ?? 0} products`);

  // ── 3. Users ───────────────────────────────────────────────────────────────
  console.log("\n[3/7] Seeding users…");

  // Global roles
  const adminId = await upsertUser("admin@hgl-wms.com", "System Administrator", "ADMIN", null);
  const whId = await upsertUser(
    "warehouse@hgl-wms.com",
    "Warehouse Manager",
    "WAREHOUSE_MANAGER",
    null,
  );
  const finId = await upsertUser("finance@hgl-wms.com", "Finance Manager", "FINANCE_MANAGER", null);

  // Jara
  const jaraMgrId = await upsertUser(
    "manager.jara@hgl-wms.com",
    "Jara Branch Manager",
    "BU_MANAGER",
    sbuMap["JARA"],
  );
  const jaraStfId = await upsertUser(
    "staff.jara@hgl-wms.com",
    "Jara Store Staff",
    "UNIT_STAFF",
    sbuMap["JARA"],
    unitMap["JARA-SF"],
  );

  // Grand Access
  const graxMgrId = await upsertUser(
    "manager.grandaccess@hgl-wms.com",
    "Grand Access Manager",
    "BU_MANAGER",
    sbuMap["GRAX"],
  );
  const graxStfId = await upsertUser(
    "staff.grandaccess@hgl-wms.com",
    "Grand Access Staff",
    "UNIT_STAFF",
    sbuMap["GRAX"],
    unitMap["GRAX-DS"],
  );

  // Bounty
  const bntyMgrId = await upsertUser(
    "manager.bounty@hgl-wms.com",
    "Bounty Wholesale Manager",
    "BU_MANAGER",
    sbuMap["BNTY"],
  );
  const bntyStfId = await upsertUser(
    "staff.bounty@hgl-wms.com",
    "Bounty Wholesale Staff",
    "UNIT_STAFF",
    sbuMap["BNTY"],
    unitMap["BNTY-MF"],
  );

  // LaBamba
  const lbmbMgrId = await upsertUser(
    "manager.labamba@hgl-wms.com",
    "LaBamba Operations Manager",
    "BU_MANAGER",
    sbuMap["LBMB"],
  );
  const lbmbStfId = await upsertUser(
    "staff.labamba@hgl-wms.com",
    "LaBamba Kitchen Staff",
    "UNIT_STAFF",
    sbuMap["LBMB"],
    unitMap["LBMB-KT"],
  );

  // HGC
  const hgcMgrId = await upsertUser(
    "manager.hgc@hgl-wms.com",
    "HGC Fleet Manager",
    "BU_MANAGER",
    sbuMap["HGCT"],
  );
  const hgcStfId = await upsertUser(
    "staff.hgc@hgl-wms.com",
    "HGC Logistics Staff",
    "UNIT_STAFF",
    sbuMap["HGCT"],
    unitMap["HGCT-FO"],
  );

  console.log("  All users ready");

  // ── 4. Transfer requests ───────────────────────────────────────────────────
  console.log("\n[4/7] Seeding transfer requests…");

  async function insertTransfer(
    sbuId: string,
    requestingUnitId: string,
    raisedBy: string,
    status: string,
    lines: { sku: string; qty: number }[],
    opts: {
      notes?: string;
      estimated_value?: number;
      requires_finance_approval?: boolean;
      approved_by?: string;
      approved_at?: string;
      required_date?: string;
      created_at?: string;
    } = {},
  ): Promise<string> {
    const { data: tr, error: trErr } = await supabase
      .from("transfer_requests")
      .insert({
        reference_number: trf(),
        sbu_id: sbuId,
        requesting_unit_id: requestingUnitId,
        raised_by: raisedBy,
        status,
        notes: opts.notes ?? null,
        estimated_value: opts.estimated_value ?? null,
        requires_finance_approval: opts.requires_finance_approval ?? false,
        approved_by: opts.approved_by ?? null,
        approved_at: opts.approved_at ?? null,
        required_date: opts.required_date ?? null,
        created_at: opts.created_at ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (trErr) throw trErr;

    const id = (tr as any).id as string;
    const li = lines
      .filter((l) => pm[l.sku])
      .map((l) => ({
        transfer_request_id: id,
        product_id: pm[l.sku],
        requested_quantity: l.qty,
      }));
    if (li.length) {
      const { error: liErr } = await supabase.from("transfer_line_items").insert(li);
      if (liErr) throw liErr;
    }
    return id;
  }

  // ── Jara (retail) ──────────────────────────────────────────────────────────
  // PENDING — monthly replenishment
  await insertTransfer(
    sbuMap["JARA"],
    unitMap["JARA-SF"],
    jaraMgrId,
    "PENDING",
    [
      { sku: "RTL-001", qty: 100 },
      { sku: "RTL-002", qty: 500 },
      { sku: "GEN-001", qty: 20 },
    ],
    {
      notes: "Monthly stock replenishment — Receipt paper & bags",
      estimated_value: 640,
      required_date: daysAhead(5),
      created_at: daysAgo(1),
    },
  );

  // PENDING_APPROVAL — high-value display equipment
  await insertTransfer(
    sbuMap["JARA"],
    unitMap["JARA-BO"],
    jaraMgrId,
    "PENDING_APPROVAL",
    [
      { sku: "RTL-004", qty: 20 },
      { sku: "RTL-006", qty: 30 },
      { sku: "GEN-005", qty: 5 },
    ],
    {
      notes: "Quarterly display & security tag restock",
      estimated_value: 1585,
      requires_finance_approval: true,
      required_date: daysAhead(7),
      created_at: daysAgo(2),
    },
  );

  // APPROVED_FOR_ISSUE — rush order
  const jaraApprId = await insertTransfer(
    sbuMap["JARA"],
    unitMap["JARA-RD"],
    jaraMgrId,
    "APPROVED_FOR_ISSUE",
    [
      { sku: "RTL-001", qty: 50 },
      { sku: "RTL-003", qty: 10 },
      { sku: "GEN-002", qty: 10 },
    ],
    {
      notes: "Rush order — new Jara branch opening",
      estimated_value: 260,
      approved_by: finId,
      approved_at: daysAgo(1),
      required_date: daysAhead(2),
      created_at: daysAgo(3),
    },
  );

  // ── Grand Access (pharma) ──────────────────────────────────────────────────
  // COMPLETED — PPE restock (full receipt)
  const graxDoneId = await insertTransfer(
    sbuMap["GRAX"],
    unitMap["GRAX-DS"],
    graxMgrId,
    "COMPLETED",
    [
      { sku: "PHM-004", qty: 50 },
      { sku: "PHM-005", qty: 30 },
      { sku: "PHM-003", qty: 10 },
    ],
    { notes: "PPE restocking cycle — completed", estimated_value: 710, created_at: daysAgo(10) },
  );

  // PENDING — cold chain supplies
  await insertTransfer(
    sbuMap["GRAX"],
    unitMap["GRAX-CS"],
    graxMgrId,
    "PENDING",
    [
      { sku: "PHM-001", qty: 30 },
      { sku: "PHM-006", qty: 20 },
      { sku: "PHM-007", qty: 40 },
    ],
    {
      notes: "Cold chain & specimen kits for new product line",
      estimated_value: 858,
      required_date: daysAhead(4),
      created_at: daysAgo(1),
    },
  );

  // ISSUED — packaging materials in transit
  const graxIssdId = await insertTransfer(
    sbuMap["GRAX"],
    unitMap["GRAX-LB"],
    graxMgrId,
    "ISSUED",
    [
      { sku: "PHM-002", qty: 5 },
      { sku: "PHM-003", qty: 20 },
    ],
    { notes: "Blister foil & labels — dispatched", estimated_value: 680, created_at: daysAgo(4) },
  );

  // ── Bounty (wholesale) ─────────────────────────────────────────────────────
  // PENDING — peak season packaging
  await insertTransfer(
    sbuMap["BNTY"],
    unitMap["BNTY-MF"],
    bntyMgrId,
    "PENDING",
    [
      { sku: "WSL-001", qty: 20 },
      { sku: "WSL-002", qty: 500 },
      { sku: "WSL-003", qty: 50 },
    ],
    {
      notes: "Packing materials for peak season",
      estimated_value: 830,
      required_date: daysAhead(3),
      created_at: daysAgo(1),
    },
  );

  // PENDING_APPROVAL — large equipment order
  await insertTransfer(
    sbuMap["BNTY"],
    unitMap["BNTY-LB"],
    bntyMgrId,
    "PENDING_APPROVAL",
    [
      { sku: "WSL-005", qty: 20 },
      { sku: "WSL-004", qty: 10 },
      { sku: "WSL-006", qty: 15 },
    ],
    {
      notes: "Warehouse equipment & pallet order",
      estimated_value: 1120,
      requires_finance_approval: true,
      required_date: daysAhead(10),
      created_at: daysAgo(2),
    },
  );

  // COMPLETED_WITH_VARIANCE — 2 cartons damaged
  const bntyVarId = await insertTransfer(
    sbuMap["BNTY"],
    unitMap["BNTY-AD"],
    bntyMgrId,
    "COMPLETED_WITH_VARIANCE",
    [
      { sku: "WSL-002", qty: 200 },
      { sku: "WSL-003", qty: 30 },
    ],
    {
      notes: "2 cartons received with crush damage — variance reported",
      estimated_value: 264,
      created_at: daysAgo(8),
    },
  );

  // ── LaBamba (restaurant & bakery) ──────────────────────────────────────────
  // PENDING — weekly kitchen supplies
  await insertTransfer(
    sbuMap["LBMB"],
    unitMap["LBMB-KT"],
    lbmbMgrId,
    "PENDING",
    [
      { sku: "FNB-001", qty: 20 },
      { sku: "FNB-002", qty: 10 },
      { sku: "FNB-003", qty: 5 },
    ],
    {
      notes: "Weekly kitchen supplies order",
      estimated_value: 1090,
      required_date: daysAhead(2),
      created_at: daysAgo(1),
    },
  );

  // APPROVED_FOR_ISSUE — event catering disposables
  const lbmbApprId = await insertTransfer(
    sbuMap["LBMB"],
    unitMap["LBMB-BK"],
    lbmbMgrId,
    "APPROVED_FOR_ISSUE",
    [
      { sku: "FNB-004", qty: 50 },
      { sku: "FNB-005", qty: 30 },
      { sku: "FNB-007", qty: 100 },
    ],
    {
      notes: "Disposables for large catering event this weekend",
      estimated_value: 1145,
      approved_by: finId,
      approved_at: daysAgo(1),
      required_date: daysAhead(1),
      created_at: daysAgo(3),
    },
  );

  // COMPLETED — bakery consumables
  const lbmbDoneId = await insertTransfer(
    sbuMap["LBMB"],
    unitMap["LBMB-FH"],
    lbmbMgrId,
    "COMPLETED",
    [
      { sku: "FNB-006", qty: 20 },
      { sku: "FNB-008", qty: 10 },
    ],
    {
      notes: "Bakery consumables — received in full",
      estimated_value: 250,
      created_at: daysAgo(12),
    },
  );

  // ── HGC (transport & logistics) ────────────────────────────────────────────
  // PENDING — fleet maintenance
  await insertTransfer(
    sbuMap["HGCT"],
    unitMap["HGCT-FO"],
    hgcMgrId,
    "PENDING",
    [
      { sku: "TRP-001", qty: 30 },
      { sku: "TRP-002", qty: 20 },
      { sku: "TRP-006", qty: 30 },
    ],
    {
      notes: "Fleet maintenance & PPE supplies",
      estimated_value: 875,
      required_date: daysAhead(3),
      created_at: daysAgo(1),
    },
  );

  // PENDING_APPROVAL — safety equipment for 2 new vehicles
  await insertTransfer(
    sbuMap["HGCT"],
    unitMap["HGCT-DS"],
    hgcMgrId,
    "PENDING_APPROVAL",
    [
      { sku: "TRP-004", qty: 10 },
      { sku: "TRP-007", qty: 15 },
      { sku: "TRP-008", qty: 8 },
    ],
    {
      notes: "Safety equipment for 2 new vehicles joining fleet",
      estimated_value: 1001,
      requires_finance_approval: true,
      required_date: daysAhead(6),
      created_at: daysAgo(2),
    },
  );

  // ISSUED — straps & labels dispatched
  const hgcIssdId = await insertTransfer(
    sbuMap["HGCT"],
    unitMap["HGCT-MT"],
    hgcMgrId,
    "ISSUED",
    [
      { sku: "TRP-003", qty: 20 },
      { sku: "TRP-005", qty: 50 },
    ],
    {
      notes: "Cargo straps & shipping labels — dispatched",
      estimated_value: 540,
      created_at: daysAgo(5),
    },
  );

  console.log("  Transfer requests seeded");

  // ── 5. Issuances ───────────────────────────────────────────────────────────
  console.log("\n[5/7] Seeding issuances…");

  async function insertIssuance(
    transferId: string,
    lines: { sku: string; qty: number; shortfall_reason?: string }[],
    issuedAt: string,
  ): Promise<string> {
    const { data: iss, error: issErr } = await supabase
      .from("issuances")
      .insert({
        transfer_request_id: transferId,
        issued_by: whId,
        issue_date: issuedAt,
        logistics_notes: "Dispatched via HGC internal transport",
        created_at: issuedAt,
      })
      .select()
      .single();
    if (issErr) throw issErr;

    const id = (iss as any).id as string;
    const items = lines
      .filter((l) => pm[l.sku])
      .map((l) => ({
        issuance_id: id,
        product_id: pm[l.sku],
        quantity_issued: l.qty,
        shortfall_reason: l.shortfall_reason ?? null,
      }));
    if (items.length) {
      const { error: iliErr } = await supabase.from("issuance_line_items").insert(items);
      if (iliErr) throw iliErr;
    }
    return id;
  }

  // Grand Access — completed (full)
  await insertIssuance(
    graxDoneId,
    [
      { sku: "PHM-004", qty: 50 },
      { sku: "PHM-005", qty: 30 },
      { sku: "PHM-003", qty: 10 },
    ],
    daysAgo(8),
  );

  // Grand Access — issued / in transit
  await insertIssuance(
    graxIssdId,
    [
      { sku: "PHM-002", qty: 5 },
      { sku: "PHM-003", qty: 20 },
    ],
    daysAgo(3),
  );

  // Bounty — completed with variance
  await insertIssuance(
    bntyVarId,
    [
      { sku: "WSL-002", qty: 200 },
      { sku: "WSL-003", qty: 30 },
    ],
    daysAgo(7),
  );

  // LaBamba — completed (full)
  await insertIssuance(
    lbmbDoneId,
    [
      { sku: "FNB-006", qty: 20 },
      { sku: "FNB-008", qty: 10 },
    ],
    daysAgo(10),
  );

  // HGC — issued / in transit
  await insertIssuance(
    hgcIssdId,
    [
      { sku: "TRP-003", qty: 20 },
      { sku: "TRP-005", qty: 50 },
    ],
    daysAgo(4),
  );

  console.log("  Issuances seeded");

  // ── 6. GRNs ────────────────────────────────────────────────────────────────
  console.log("\n[6/7] Seeding GRNs…");

  async function insertGrn(
    transferId: string,
    receivedBy: string,
    lines: { sku: string; issued: number; received: number; variance_notes?: string }[],
    opts: { condition_notes?: string; has_variance?: boolean; created_at?: string },
  ) {
    const ts = opts.created_at ?? new Date().toISOString();
    const { data: grn, error: grnErr } = await supabase
      .from("grns")
      .insert({
        transfer_request_id: transferId,
        received_by: receivedBy,
        date_received: ts.split("T")[0],
        condition_notes: opts.condition_notes ?? null,
        has_variance: opts.has_variance ?? false,
        acknowledged: true,
        created_at: ts,
      })
      .select()
      .single();
    if (grnErr) throw grnErr;

    const id = (grn as any).id as string;
    const items = lines
      .filter((l) => pm[l.sku])
      .map((l) => ({
        grn_id: id,
        product_id: pm[l.sku],
        issued_quantity: l.issued,
        quantity_received: l.received,
        variance_notes: l.variance_notes ?? null,
      }));
    if (items.length) {
      const { error: gliErr } = await supabase.from("grn_line_items").insert(items);
      if (gliErr) throw gliErr;
    }
  }

  // Grand Access — completed, full receipt
  await insertGrn(
    graxDoneId,
    graxStfId,
    [
      { sku: "PHM-004", issued: 50, received: 50 },
      { sku: "PHM-005", issued: 30, received: 30 },
      { sku: "PHM-003", issued: 10, received: 10 },
    ],
    { condition_notes: "All items received in good condition", created_at: daysAgo(7) },
  );

  // Bounty — completed with variance
  await insertGrn(
    bntyVarId,
    bntyStfId,
    [
      {
        sku: "WSL-002",
        issued: 200,
        received: 198,
        variance_notes: "2 cartons crushed during transit",
      },
      { sku: "WSL-003", issued: 30, received: 30 },
    ],
    {
      condition_notes: "Minor damage on 2 cartons — photos attached",
      has_variance: true,
      created_at: daysAgo(6),
    },
  );

  // LaBamba — completed, full receipt
  await insertGrn(
    lbmbDoneId,
    lbmbStfId,
    [
      { sku: "FNB-006", issued: 20, received: 20 },
      { sku: "FNB-008", issued: 10, received: 10 },
    ],
    { condition_notes: "Items received in good condition", created_at: daysAgo(9) },
  );

  console.log("  GRNs seeded");

  // ── 7. Supplier GRNs ───────────────────────────────────────────────────────
  console.log("\n[7/7] Seeding supplier GRNs…");

  async function insertSupplierGrn(opts: {
    supplier: string;
    invoice_ref: string;
    invoice_amount: number;
    status: string;
    lines: { sku: string; qty: number; unit_cost: number }[];
    created_at?: string;
    approved_by?: string;
    approved_at?: string;
    approval_notes?: string;
  }) {
    const ts = opts.created_at ?? new Date().toISOString();
    const { data: sg, error: sgErr } = await supabase
      .from("supplier_grns")
      .insert({
        reference_number: sgrn(),
        supplier_name: opts.supplier,
        supplier_invoice_reference: opts.invoice_ref,
        invoice_amount: opts.invoice_amount,
        received_by: whId,
        date_received: ts.split("T")[0],
        status: opts.status,
        approved_by: opts.approved_by ?? null,
        approved_at: opts.approved_at ?? null,
        approval_notes: opts.approval_notes ?? null,
        created_at: ts,
      })
      .select()
      .single();
    if (sgErr) throw sgErr;

    const id = (sg as any).id as string;
    const items = opts.lines
      .filter((l) => pm[l.sku])
      .map((l) => ({
        supplier_grn_id: id,
        product_id: pm[l.sku],
        quantity_received: l.qty,
        unit_cost: l.unit_cost,
      }));
    if (items.length) {
      const { error: sliErr } = await supabase.from("supplier_grn_line_items").insert(items);
      if (sliErr) throw sliErr;
    }
  }

  // Awaiting finance approval
  await insertSupplierGrn({
    supplier: "Metro Packaging Supplies",
    invoice_ref: "MPS-INV-2026-0441",
    invoice_amount: 4200.0,
    status: "AWAITING_FINANCE_APPROVAL",
    lines: [
      { sku: "WSL-001", qty: 50, unit_cost: 22.0 },
      { sku: "WSL-002", qty: 1000, unit_cost: 0.9 },
      { sku: "WSL-003", qty: 200, unit_cost: 2.8 },
    ],
    created_at: daysAgo(2),
  });

  await insertSupplierGrn({
    supplier: "ProMed Distributors Ltd",
    invoice_ref: "PMD-2026-0887",
    invoice_amount: 5600.0,
    status: "AWAITING_FINANCE_APPROVAL",
    lines: [
      { sku: "PHM-004", qty: 300, unit_cost: 9.5 },
      { sku: "PHM-005", qty: 200, unit_cost: 6.0 },
      { sku: "PHM-001", qty: 80, unit_cost: 18.0 },
    ],
    created_at: daysAgo(1),
  });

  // Approved
  await insertSupplierGrn({
    supplier: "National Paper & Print Co.",
    invoice_ref: "NPP-2026-0223",
    invoice_amount: 2850.0,
    status: "GRN_APPROVED",
    lines: [
      { sku: "GEN-001", qty: 400, unit_cost: 4.5 },
      { sku: "RTL-001", qty: 300, unit_cost: 1.2 },
      { sku: "TRP-005", qty: 150, unit_cost: 6.0 },
    ],
    created_at: daysAgo(7),
    approved_by: finId,
    approved_at: daysAgo(5),
    approval_notes: "All documentation verified — approved",
  });

  await insertSupplierGrn({
    supplier: "Harvest Foods Wholesale",
    invoice_ref: "HFW-2026-1102",
    invoice_amount: 7300.0,
    status: "GRN_APPROVED",
    lines: [
      { sku: "FNB-001", qty: 100, unit_cost: 38.0 },
      { sku: "FNB-002", qty: 80, unit_cost: 22.0 },
      { sku: "FNB-003", qty: 30, unit_cost: 56.0 },
    ],
    created_at: daysAgo(14),
    approved_by: finId,
    approved_at: daysAgo(12),
    approval_notes: "Supplier invoice matches delivery note — approved",
  });

  // Rejected
  await insertSupplierGrn({
    supplier: "FastTrack Logistics Parts",
    invoice_ref: "FTP-2026-0056",
    invoice_amount: 1850.0,
    status: "GRN_REJECTED",
    lines: [
      { sku: "TRP-001", qty: 50, unit_cost: 18.0 },
      { sku: "TRP-004", qty: 20, unit_cost: 35.0 },
    ],
    created_at: daysAgo(10),
    approved_by: finId,
    approved_at: daysAgo(8),
    approval_notes: "Invoice amount does not match PO value — returned to supplier for correction",
  });

  console.log("  Supplier GRNs seeded");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               HGL-WMS Demo Seed Complete ✓                    ║
╠═══════════════════════════════════════════════════════════════╣
║  All passwords: Demo@1234!                                    ║
╠══════════════════════════════════╦════════════════════════════╣
║  GLOBAL ACCOUNTS                 ║  ROLE                      ║
╠══════════════════════════════════╬════════════════════════════╣
║  admin@hgl-wms.com               ║  ADMIN                     ║
║  warehouse@hgl-wms.com           ║  WAREHOUSE_MANAGER         ║
║  finance@hgl-wms.com             ║  FINANCE_MANAGER           ║
╠══════════════════════════════════╬════════════════════════════╣
║  SBU ACCOUNTS                    ║  SBU                       ║
╠══════════════════════════════════╬════════════════════════════╣
║  manager.jara@hgl-wms.com        ║  Jara (BU_MANAGER)         ║
║  staff.jara@hgl-wms.com          ║  Jara (UNIT_STAFF)         ║
║  manager.grandaccess@hgl-wms.com ║  Grand Access (BU_MANAGER) ║
║  staff.grandaccess@hgl-wms.com   ║  Grand Access (UNIT_STAFF) ║
║  manager.bounty@hgl-wms.com      ║  Bounty (BU_MANAGER)       ║
║  staff.bounty@hgl-wms.com        ║  Bounty (UNIT_STAFF)       ║
║  manager.labamba@hgl-wms.com     ║  LaBamba (BU_MANAGER)      ║
║  staff.labamba@hgl-wms.com       ║  LaBamba (UNIT_STAFF)      ║
║  manager.hgc@hgl-wms.com         ║  HGC (BU_MANAGER)          ║
║  staff.hgc@hgl-wms.com           ║  HGC (UNIT_STAFF)          ║
╚══════════════════════════════════╩════════════════════════════╝
`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
