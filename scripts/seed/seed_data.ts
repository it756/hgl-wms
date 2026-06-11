/**
 * Seed script — scripts/seed/seed_data.ts
 * Full demo seed for HGL-WMS with 8 SBUs:
 *   Jara Retail FMCG Store, Grand Access Pharmaceuticals, Bounty Wholesale,
 *   Labambam, HGC Logistics Company, Ejabali Fashion Stores,
 *   Harvest Retail Filling Station Chain, Othneil Brooks Oil and Gas
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
    await supabase.from("profiles").upsert(
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
  await supabase.from("profiles").upsert(
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
    { name: "Jara Retail FMCG Store", code: "JARA" },
    { name: "Grand Access Pharmaceuticals", code: "GRAX" },
    { name: "Bounty Wholesale", code: "BNTY" },
    { name: "Labambam", code: "LBMB" },
    { name: "HGC Logistics Company", code: "HGCT" },
    { name: "Ejabali Fashion Stores", code: "EJBL" },
    { name: "Harvest Retail Filling Station Chain", code: "HRFS" },
    { name: "Othneil Brooks Oil and Gas", code: "OTBR" },
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
  // Branch locations shared across retail/FMCG SBUs
  const LOCS = [
    { name: "Twin Palms", code: "TP" },
    { name: "Airport Road", code: "AR" },
    { name: "Great East Road", code: "GER" },
    { name: "Avondale", code: "AV" },
    { name: "Woodlands", code: "WL" },
    { name: "Leopards Hill Road", code: "LHR" },
    { name: "Tokyo Way (Ring Road)", code: "TWR" },
    { name: "Ngwere Road", code: "NR" },
    { name: "Energy Village", code: "EV" },
  ];
  const LOCATION_SBUS = ["JARA", "LBMB", "HRFS", "EJBL"];

  const unitDefs = [
    // 9 branch locations × 4 retail/FMCG SBUs (GRAX has its own branches below)
    ...LOCATION_SBUS.flatMap((sbu) =>
      LOCS.map((loc) => ({
        name: `${loc.name} (${sbu})`,
        code: `${sbu}-${loc.code}`,
        sbu_code: sbu,
      })),
    ),
    // Grand Access Pharmaceuticals — specific branch locations
    { name: "Buluwe (GRAX)", code: "GRAX-BUL", sbu_code: "GRAX" },
    { name: "Woodlands (GRAX)", code: "GRAX-WL", sbu_code: "GRAX" },
    { name: "Tokyo Way (GRAX)", code: "GRAX-TWR", sbu_code: "GRAX" },
    { name: "3rd Street (GRAX)", code: "GRAX-3ST", sbu_code: "GRAX" },
    { name: "Kasupe (GRAX)", code: "GRAX-KSP", sbu_code: "GRAX" },
    // Bounty Wholesale — single Avondale store
    { name: "Avondale (BNTY)", code: "BNTY-AV", sbu_code: "BNTY" },
    // HGC Logistics Company — operational units
    { name: "Fleet Ops", code: "HGCT-FO", sbu_code: "HGCT" },
    { name: "Dispatch", code: "HGCT-DS", sbu_code: "HGCT" },
    { name: "Maintenance", code: "HGCT-MT", sbu_code: "HGCT" },
    // Othneil Brooks Oil and Gas — operational units
    { name: "Operations", code: "OTBR-OP", sbu_code: "OTBR" },
    { name: "Depot", code: "OTBR-DT", sbu_code: "OTBR" },
    { name: "Admin", code: "OTBR-AD", sbu_code: "OTBR" },
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
    // ── General / Office (bay A1)
    { name: "A4 Paper Ream", sku: "GEN-001", unit_of_measure: "ream", stock_quantity: 800, low_stock_threshold: 80, unit_cost: 4.5, warehouse_location: "A1" },
    { name: "Ballpoint Pen Blue (Box of 50)", sku: "GEN-002", unit_of_measure: "box", stock_quantity: 300, low_stock_threshold: 30, unit_cost: 5.0, warehouse_location: "A1" },
    { name: "Sticky Notes (Pack of 100)", sku: "GEN-003", unit_of_measure: "pack", stock_quantity: 250, low_stock_threshold: 25, unit_cost: 2.5, warehouse_location: "A1" },
    { name: "File Folders (Box of 20)", sku: "GEN-004", unit_of_measure: "box", stock_quantity: 150, low_stock_threshold: 15, unit_cost: 8.0, warehouse_location: "A1" },
    { name: "Printer Toner Cartridge (Black)", sku: "GEN-005", unit_of_measure: "unit", stock_quantity: 40, low_stock_threshold: 5, unit_cost: 85.0, warehouse_location: "A1" },
    { name: "Hand Sanitizer 500ml", sku: "GEN-006", unit_of_measure: "bottle", stock_quantity: 400, low_stock_threshold: 40, unit_cost: 3.2, warehouse_location: "A1" },

    // ── Retail — Jara Retail Chain (bay B1)
    { name: "Thermal Receipt Paper Roll 80mm", sku: "RTL-001", unit_of_measure: "roll", stock_quantity: 600, low_stock_threshold: 60, unit_cost: 1.2, warehouse_location: "B1" },
    { name: "Reusable Shopping Bag (Large)", sku: "RTL-002", unit_of_measure: "unit", stock_quantity: 2000, low_stock_threshold: 200, unit_cost: 0.8, warehouse_location: "B1" },
    { name: "Price Label Roll (1000 labels)", sku: "RTL-003", unit_of_measure: "roll", stock_quantity: 400, low_stock_threshold: 40, unit_cost: 3.5, warehouse_location: "B1" },
    { name: "EAS Security Tag (Box of 100)", sku: "RTL-004", unit_of_measure: "box", stock_quantity: 80, low_stock_threshold: 10, unit_cost: 45.0, warehouse_location: "B1" },
    { name: "Cardboard Display Box A3", sku: "RTL-005", unit_of_measure: "unit", stock_quantity: 500, low_stock_threshold: 50, unit_cost: 1.5, warehouse_location: "B1" },
    { name: "Plastic Clothes Hangers (Pack of 50)", sku: "RTL-006", unit_of_measure: "pack", stock_quantity: 120, low_stock_threshold: 15, unit_cost: 12.0, warehouse_location: "B1" },

    // ── Pharmaceutical — Grand Access (bay C1)
    { name: "Amber Medicine Bottles 60ml (Carton)", sku: "PHM-001", unit_of_measure: "carton", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 18.0, warehouse_location: "C1" },
    { name: "Blister Pack Foil Roll (500m)", sku: "PHM-002", unit_of_measure: "roll", stock_quantity: 50, low_stock_threshold: 5, unit_cost: 120.0, warehouse_location: "C1" },
    { name: "Prescription Label Roll (1500 labels)", sku: "PHM-003", unit_of_measure: "roll", stock_quantity: 300, low_stock_threshold: 30, unit_cost: 4.0, warehouse_location: "C1" },
    { name: "Nitrile Gloves Medium (Box of 100)", sku: "PHM-004", unit_of_measure: "box", stock_quantity: 500, low_stock_threshold: 50, unit_cost: 9.5, warehouse_location: "C1" },
    { name: "Medical Face Masks (Box of 50)", sku: "PHM-005", unit_of_measure: "box", stock_quantity: 400, low_stock_threshold: 40, unit_cost: 6.0, warehouse_location: "C1" },
    { name: "Reusable Cold Pack 500g", sku: "PHM-006", unit_of_measure: "unit", stock_quantity: 150, low_stock_threshold: 15, unit_cost: 4.5, warehouse_location: "C1" },
    { name: "Specimen Collection Kit", sku: "PHM-007", unit_of_measure: "unit", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 3.2, warehouse_location: "C1" },

    // ── Wholesale — Bounty (bay D1)
    { name: "Stretch Wrap Film 500m Roll", sku: "WSL-001", unit_of_measure: "roll", stock_quantity: 100, low_stock_threshold: 10, unit_cost: 22.0, warehouse_location: "D1" },
    { name: "Corrugated Carton Box (Medium)", sku: "WSL-002", unit_of_measure: "unit", stock_quantity: 2000, low_stock_threshold: 200, unit_cost: 0.9, warehouse_location: "D1" },
    { name: "Packing Tape 48mm×100m", sku: "WSL-003", unit_of_measure: "roll", stock_quantity: 500, low_stock_threshold: 50, unit_cost: 2.8, warehouse_location: "D1" },
    { name: "Polypropylene Strapping (Box)", sku: "WSL-004", unit_of_measure: "box", stock_quantity: 60, low_stock_threshold: 8, unit_cost: 35.0, warehouse_location: "D1" },
    { name: "Standard Wooden Pallet", sku: "WSL-005", unit_of_measure: "unit", stock_quantity: 80, low_stock_threshold: 10, unit_cost: 28.0, warehouse_location: "D1" },
    { name: "Industrial Cleaning Detergent 5L", sku: "WSL-006", unit_of_measure: "container", stock_quantity: 120, low_stock_threshold: 12, unit_cost: 14.0, warehouse_location: "D1" },

    // ── Restaurant & Bakery — LaBamba (bay E1)
    { name: "All-Purpose Flour 50kg Sack", sku: "FNB-001", unit_of_measure: "sack", stock_quantity: 300, low_stock_threshold: 30, unit_cost: 38.0, warehouse_location: "E1" },
    { name: "Refined Sugar 25kg Bag", sku: "FNB-002", unit_of_measure: "bag", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 22.0, warehouse_location: "E1" },
    { name: "Sunflower Cooking Oil 20L Drum", sku: "FNB-003", unit_of_measure: "drum", stock_quantity: 100, low_stock_threshold: 10, unit_cost: 56.0, warehouse_location: "E1" },
    { name: "Food-Safe Disposable Gloves (Box/100)", sku: "FNB-004", unit_of_measure: "box", stock_quantity: 400, low_stock_threshold: 40, unit_cost: 7.5, warehouse_location: "E1" },
    { name: "Disposable Food Containers (Pack/50)", sku: "FNB-005", unit_of_measure: "pack", stock_quantity: 350, low_stock_threshold: 35, unit_cost: 11.0, warehouse_location: "E1" },
    { name: "Baking Soda 5kg Bag", sku: "FNB-006", unit_of_measure: "bag", stock_quantity: 150, low_stock_threshold: 15, unit_cost: 8.0, warehouse_location: "E1" },
    { name: "Disposable Cups 250ml (Sleeve/50)", sku: "FNB-007", unit_of_measure: "sleeve", stock_quantity: 600, low_stock_threshold: 60, unit_cost: 4.2, warehouse_location: "E1" },
    { name: "Kitchen Aluminium Foil 30cm×100m", sku: "FNB-008", unit_of_measure: "roll", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 9.0, warehouse_location: "E1" },

    // ── Transport & Logistics — HGC (bay F1)
    { name: "Engine Oil 10W-40 (4L Bottle)", sku: "TRP-001", unit_of_measure: "bottle", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 18.0, warehouse_location: "F1" },
    { name: "High-Visibility Safety Vest", sku: "TRP-002", unit_of_measure: "unit", stock_quantity: 150, low_stock_threshold: 15, unit_cost: 8.5, warehouse_location: "F1" },
    { name: "Heavy-Duty Cargo Ratchet Strap", sku: "TRP-003", unit_of_measure: "unit", stock_quantity: 100, low_stock_threshold: 10, unit_cost: 12.0, warehouse_location: "F1" },
    { name: "Vehicle First Aid Kit (Standard)", sku: "TRP-004", unit_of_measure: "kit", stock_quantity: 60, low_stock_threshold: 6, unit_cost: 35.0, warehouse_location: "F1" },
    { name: "Shipping Label Roll 4×6 (500 labels)", sku: "TRP-005", unit_of_measure: "roll", stock_quantity: 300, low_stock_threshold: 30, unit_cost: 6.0, warehouse_location: "F1" },
    { name: "Safety Gloves Heavy Duty (Pair)", sku: "TRP-006", unit_of_measure: "pair", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 5.5, warehouse_location: "F1" },
    { name: "Reflective Road Cone", sku: "TRP-007", unit_of_measure: "unit", stock_quantity: 80, low_stock_threshold: 8, unit_cost: 15.0, warehouse_location: "F1" },
    { name: "Digital Tyre Pressure Gauge", sku: "TRP-008", unit_of_measure: "unit", stock_quantity: 30, low_stock_threshold: 4, unit_cost: 22.0, warehouse_location: "F1" },

    // ── Jara Inventory — Shelf Fixtures (bay G1)
    { name: "Shelf Hanger 900/400 + 900/350 X 50", sku: "JARA-SHF-001", unit_of_measure: "pc", stock_quantity: 3250, low_stock_threshold: 163, unit_cost: null, warehouse_location: "G1" },
    { name: "A11 Shelf Layers 900/400 + 900/350 X 8", sku: "JARA-SHF-002", unit_of_measure: "pc", stock_quantity: 5408, low_stock_threshold: 270, unit_cost: null, warehouse_location: "G1" },
    { name: "A11 Shelf Layers 900/200 X 8", sku: "JARA-SHF-003", unit_of_measure: "pc", stock_quantity: 336, low_stock_threshold: 17, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 Shelf Parts 900/20 X 8 +2Pcs", sku: "JARA-SHF-004", unit_of_measure: "pc", stock_quantity: 322, low_stock_threshold: 16, unit_cost: null, warehouse_location: "G1" },
    { name: "B18 Shelf Stands Heads 1550/400 X 4", sku: "JARA-SHF-005", unit_of_measure: "pc", stock_quantity: 460, low_stock_threshold: 23, unit_cost: null, warehouse_location: "G1" },
    { name: "Shelf Stand 705/18", sku: "JARA-SHF-006", unit_of_measure: "pc", stock_quantity: 828, low_stock_threshold: 41, unit_cost: null, warehouse_location: "G1" },
    { name: "B18/400 Shelf Stand Small Single Heads + 192Pcs", sku: "JARA-SHF-007", unit_of_measure: "pc", stock_quantity: 812, low_stock_threshold: 41, unit_cost: null, warehouse_location: "G1" },
    { name: "A11 Slim Shelf Hooks 1550/50 X 50", sku: "JARA-SHF-008", unit_of_measure: "pc", stock_quantity: 2550, low_stock_threshold: 128, unit_cost: null, warehouse_location: "G1" },
    { name: "Base Shelf 1000Mm 800/350 +14Pcs", sku: "JARA-SHF-009", unit_of_measure: "unit", stock_quantity: 90, low_stock_threshold: 5, unit_cost: null, warehouse_location: "G1" },
    { name: "Bracket W 400 X 20Mm", sku: "JARA-SHF-010", unit_of_measure: "pc", stock_quantity: 59, low_stock_threshold: 3, unit_cost: null, warehouse_location: "G1" },
    { name: "Plinth 1000Mm", sku: "JARA-SHF-011", unit_of_measure: "unit", stock_quantity: 17, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G1" },
    { name: "Base Leg 400Mm", sku: "JARA-SHF-012", unit_of_measure: "pc", stock_quantity: 54, low_stock_threshold: 3, unit_cost: null, warehouse_location: "G1" },
    { name: "Shelf 1000Mm", sku: "JARA-SHF-013", unit_of_measure: "unit", stock_quantity: 165, low_stock_threshold: 8, unit_cost: null, warehouse_location: "G1" },
    { name: "Back Panel 800/300/0.5Mm", sku: "JARA-SHF-014", unit_of_measure: "unit", stock_quantity: 116, low_stock_threshold: 6, unit_cost: null, warehouse_location: "G1" },
    { name: "Short Shelf Stand X 4", sku: "JARA-SHF-015", unit_of_measure: "pc", stock_quantity: 384, low_stock_threshold: 19, unit_cost: null, warehouse_location: "G1" },
    { name: "Long Shelf Stand X 4", sku: "JARA-SHF-016", unit_of_measure: "pc", stock_quantity: 122, low_stock_threshold: 6, unit_cost: null, warehouse_location: "G1" },
    { name: "Back Panel Small Size X 8", sku: "JARA-SHF-017", unit_of_measure: "unit", stock_quantity: 122, low_stock_threshold: 6, unit_cost: null, warehouse_location: "G1" },
    { name: "Back Panel Big Size X 8", sku: "JARA-SHF-018", unit_of_measure: "unit", stock_quantity: 264, low_stock_threshold: 13, unit_cost: null, warehouse_location: "G1" },
    { name: "Back Panel Medium X 8", sku: "JARA-SHF-019", unit_of_measure: "unit", stock_quantity: 251, low_stock_threshold: 13, unit_cost: null, warehouse_location: "G1" },
    { name: "Side Shelf Cover Small Size", sku: "JARA-SHF-020", unit_of_measure: "unit", stock_quantity: 89, low_stock_threshold: 5, unit_cost: null, warehouse_location: "G1" },
    { name: "Side Shelf Cover Long", sku: "JARA-SHF-021", unit_of_measure: "unit", stock_quantity: 255, low_stock_threshold: 13, unit_cost: null, warehouse_location: "G1" },
    { name: "B18/400 X 4 +29", sku: "JARA-SHF-022", unit_of_measure: "pc", stock_quantity: 737, low_stock_threshold: 37, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 Shelf Hook 350 X 80 +49Pcs", sku: "JARA-SHF-023", unit_of_measure: "pc", stock_quantity: 6032, low_stock_threshold: 302, unit_cost: null, warehouse_location: "G1" },
    { name: "Shelf Foot", sku: "JARA-SHF-024", unit_of_measure: "pc", stock_quantity: 84, low_stock_threshold: 4, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 900/40 X40", sku: "JARA-SHF-025", unit_of_measure: "pc", stock_quantity: 400, low_stock_threshold: 20, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 900/20 X 20", sku: "JARA-SHF-026", unit_of_measure: "pc", stock_quantity: 1040, low_stock_threshold: 52, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 800/18 X 18", sku: "JARA-SHF-027", unit_of_measure: "pc", stock_quantity: 108, low_stock_threshold: 5, unit_cost: null, warehouse_location: "G1" },
    { name: "B18 900/40", sku: "JARA-SHF-028", unit_of_measure: "unit", stock_quantity: 68, low_stock_threshold: 3, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 800/20", sku: "JARA-SHF-029", unit_of_measure: "pc", stock_quantity: 60, low_stock_threshold: 3, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 800/40", sku: "JARA-SHF-030", unit_of_measure: "pc", stock_quantity: 120, low_stock_threshold: 6, unit_cost: null, warehouse_location: "G1" },
    { name: "B12 350/20", sku: "JARA-SHF-031", unit_of_measure: "pc", stock_quantity: 1540, low_stock_threshold: 77, unit_cost: null, warehouse_location: "G1" },
    { name: "Side Shelf Holder Short", sku: "JARA-SHF-032", unit_of_measure: "unit", stock_quantity: 18, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G1" },

    // ── Jara Inventory — Ladder (bay G1)
    { name: "Ladder X 3", sku: "JARA-LDR-001", unit_of_measure: "unit", stock_quantity: 18, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G1" },

    // ── Jara Inventory — Freezers & Chillers (bay G2)
    { name: "Open Chiller Big Size", sku: "JARA-CHL-001", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Open Chiller Small Size", sku: "JARA-CHL-002", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Supermarket Chiller 2 Doors", sku: "JARA-CHL-003", unit_of_measure: "unit", stock_quantity: 17, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Supermarket Chiller 3 Doors", sku: "JARA-CHL-004", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Supermarket Chiller 4 Doors", sku: "JARA-CHL-005", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Supermarket Chiller 1 Door", sku: "JARA-CHL-006", unit_of_measure: "unit", stock_quantity: 26, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Jara Chiller 2 Doors", sku: "JARA-CHL-007", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Jara Chiller 3 Doors", sku: "JARA-CHL-008", unit_of_measure: "unit", stock_quantity: 29, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Jara Chiller 4 Doors", sku: "JARA-CHL-009", unit_of_measure: "unit", stock_quantity: 14, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Nameless Chiller 4 Doors Up And Down", sku: "JARA-CHL-010", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Nameless Chiller 2 Doors", sku: "JARA-CHL-011", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },
    { name: "Chiller 2500", sku: "JARA-CHL-012", unit_of_measure: "unit", stock_quantity: 30, low_stock_threshold: 2, unit_cost: null, warehouse_location: "G2" },
    { name: "Chiller 1900", sku: "JARA-CHL-013", unit_of_measure: "unit", stock_quantity: 37, low_stock_threshold: 2, unit_cost: null, warehouse_location: "G2" },
    { name: "Ugur Big Chillers", sku: "JARA-CHL-014", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "G2" },

    // ── Jara Inventory — Price Tags (bay G1)
    { name: "Price Tag Holder X 200 +90Pcs", sku: "JARA-TAG-001", unit_of_measure: "pc", stock_quantity: 2090, low_stock_threshold: 105, unit_cost: null, warehouse_location: "G1" },

    // ── Ejabali Fashion Stores (bay N1)
    { name: "Clothing Display Rack", sku: "EJBL-001", unit_of_measure: "unit", stock_quantity: 50, low_stock_threshold: 5, unit_cost: null, warehouse_location: "N1" },
    { name: "Plastic Clothes Hangers (Box/50)", sku: "EJBL-002", unit_of_measure: "box", stock_quantity: 200, low_stock_threshold: 20, unit_cost: 12.0, warehouse_location: "N1" },
    { name: "Full-Length Fitting Mirror", sku: "EJBL-003", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "N1" },
    { name: "Price Tag Holder Strip", sku: "EJBL-004", unit_of_measure: "pack", stock_quantity: 100, low_stock_threshold: 10, unit_cost: null, warehouse_location: "N1" },
    { name: "Garment Cover Bag Roll", sku: "EJBL-005", unit_of_measure: "roll", stock_quantity: 30, low_stock_threshold: 3, unit_cost: null, warehouse_location: "N1" },

    // ── Harvest Retail Filling Station Chain — Leopards Hill Road warehouse stock
    // Fuel dispensers (bay H1)
    { name: "Fuel Dispenser (C552J6361G)", sku: "HRFS-001", unit_of_measure: "unit", stock_quantity: 12, low_stock_threshold: 2, unit_cost: null, warehouse_location: "H1" },
    { name: "Fuel Dispenser Submersible Type", sku: "HRFS-002", unit_of_measure: "unit", stock_quantity: 4, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H1" },
    { name: "Fuel Dispenser 6 in 1 Pump", sku: "HRFS-003", unit_of_measure: "unit", stock_quantity: 23, low_stock_threshold: 2, unit_cost: null, warehouse_location: "H1" },
    { name: "Fuel Dispenser 2 in 1", sku: "HRFS-020", unit_of_measure: "unit", stock_quantity: 6, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H1" },
    // Chillers & cold rooms (bays J1, K1)
    { name: "Ugur Chiller (100004919487)", sku: "HRFS-004", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "K1" },
    { name: "Island Freezer UGA", sku: "HRFS-007", unit_of_measure: "unit", stock_quantity: 23, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J1" },
    { name: "UGA Freezer", sku: "HRFS-008", unit_of_measure: "unit", stock_quantity: 14, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Cold Room (TS-021050/N)", sku: "HRFS-009", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Senol Cold Room (M040-K03)", sku: "HRFS-010", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Senol Cold Room Accessories", sku: "HRFS-012", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "REFR Cooling Machine Hanging Type (BG-060GL-E5)", sku: "HRFS-019", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    // Deep freezers (bay M1)
    { name: "Deep Freezer ZX-2.5ZAJ (2500x830x858mm)", sku: "HRFS-069", unit_of_measure: "unit", stock_quantity: 30, low_stock_threshold: 3, unit_cost: null, warehouse_location: "M1" },
    { name: "Deep Freezer ZX-1.9ZAJ (1870x830x850mm)", sku: "HRFS-070", unit_of_measure: "unit", stock_quantity: 32, low_stock_threshold: 3, unit_cost: null, warehouse_location: "M1" },
    { name: "Island Freezer (2390x1150x860mm)", sku: "HRFS-071", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "M1" },
    { name: "Deep Freezer (standard)", sku: "HRFS-072", unit_of_measure: "unit", stock_quantity: 5, low_stock_threshold: 1, unit_cost: null, warehouse_location: "M1" },
    // Air conditioners (bay I1)
    { name: "Air Conditioner Outdoor Unit (AUW-48UT25H/Hisense)", sku: "HRFS-013", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    { name: "Air Conditioner Outdoor Unit (AUW-36UT25N/Hisense)", sku: "HRFS-014", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    { name: "Cassette Air Conditioner Indoor (CQ4N-XMI365)", sku: "HRFS-015", unit_of_measure: "unit", stock_quantity: 26, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I1" },
    { name: "Cassette Air Conditioner Indoor (CQ4N-XM1245)", sku: "HRFS-016", unit_of_measure: "unit", stock_quantity: 15, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    { name: "Four-Way Cassette Air Conditioner (T-MBQ4-04B)", sku: "HRFS-017", unit_of_measure: "unit", stock_quantity: 19, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I1" },
    { name: "Four-Way Cassette Air Conditioner (CQ4N-XMI365)", sku: "HRFS-018", unit_of_measure: "unit", stock_quantity: 25, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I1" },
    { name: "Industrial Pumps Standing Type", sku: "HRFS-022", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    { name: "Brown Plywood Metal Frame", sku: "HRFS-028", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    { name: "Plywood Frame", sku: "HRFS-030", unit_of_measure: "unit", stock_quantity: 31, low_stock_threshold: 3, unit_cost: null, warehouse_location: "I1" },
    { name: "Plywood Board Reddish Brown", sku: "HRFS-031", unit_of_measure: "unit", stock_quantity: 18, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I1" },
    { name: "Wooden Panel", sku: "HRFS-033", unit_of_measure: "unit", stock_quantity: 10, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I1" },
    // Pumps & industrial (bays J1, J2)
    { name: "Industrial Pumps", sku: "HRFS-005", unit_of_measure: "unit", stock_quantity: 16, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J1" },
    { name: "Industrial Rod", sku: "HRFS-023", unit_of_measure: "unit", stock_quantity: 5, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "Accessories for Industrial Pumps", sku: "HRFS-024", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    // Furniture & fittings (bay I2)
    { name: "Single Line Tray Trolley (162x68x18cm)", sku: "HRFS-025", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I2" },
    { name: "Reddish Brown Plywood (868x300x400mm)", sku: "HRFS-026", unit_of_measure: "unit", stock_quantity: 17, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I2" },
    { name: "Plywood (896x280x260mm)", sku: "HRFS-027", unit_of_measure: "unit", stock_quantity: 27, low_stock_threshold: 3, unit_cost: null, warehouse_location: "I2" },
    { name: "Wood Frame Plywood", sku: "HRFS-029", unit_of_measure: "unit", stock_quantity: 11, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Slide Series Light (45#)", sku: "HRFS-034", unit_of_measure: "unit", stock_quantity: 10, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Flat Wooden Board", sku: "HRFS-035", unit_of_measure: "unit", stock_quantity: 9, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Wooden Deck", sku: "HRFS-036", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Table Tops / Display Stand", sku: "HRFS-058", unit_of_measure: "unit", stock_quantity: 67, low_stock_threshold: 7, unit_cost: null, warehouse_location: "I2" },
    { name: "Cushion Chairs", sku: "HRFS-059", unit_of_measure: "unit", stock_quantity: 50, low_stock_threshold: 5, unit_cost: null, warehouse_location: "I2" },
    { name: "Wooden Locker", sku: "HRFS-060", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Stool Chair", sku: "HRFS-061", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Centre Table Cover", sku: "HRFS-062", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Square Frame", sku: "HRFS-063", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Chair Table Cover", sku: "HRFS-064", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Square Frame Tops", sku: "HRFS-065", unit_of_measure: "unit", stock_quantity: 43, low_stock_threshold: 4, unit_cost: null, warehouse_location: "I2" },
    { name: "Rectangle Table Tops", sku: "HRFS-066", unit_of_measure: "unit", stock_quantity: 8, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Circle Table Tops", sku: "HRFS-067", unit_of_measure: "unit", stock_quantity: 12, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Dining/Lounge Chair Green Small (62x59x82cm)", sku: "HRFS-085", unit_of_measure: "unit", stock_quantity: 68, low_stock_threshold: 7, unit_cost: null, warehouse_location: "I2" },
    { name: "Dining/Lounge Chair Orange Small (62x59x82cm)", sku: "HRFS-086", unit_of_measure: "unit", stock_quantity: 24, low_stock_threshold: 2, unit_cost: null, warehouse_location: "I2" },
    { name: "Metal Lantern Big (61x61x42cm)", sku: "HRFS-087", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Metal Lantern Small (52x52x58cm)", sku: "HRFS-088", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Dining/Lounge Chair Big (87x58x98cm)", sku: "HRFS-089", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Wooden Chair B04# (142x62x60cm)", sku: "HRFS-090", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Wooden Chair (117x71x66cm)", sku: "HRFS-091", unit_of_measure: "unit", stock_quantity: 12, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    { name: "Wooden Sofa Chair (60x70x72cm)", sku: "HRFS-092", unit_of_measure: "unit", stock_quantity: 12, low_stock_threshold: 1, unit_cost: null, warehouse_location: "I2" },
    // Lighting (bay J2)
    { name: "LED Light (59x36x29cm)", sku: "HRFS-037", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "Lifting Touch Warm Light (98x25x39cm)", sku: "HRFS-038", unit_of_measure: "unit", stock_quantity: 16, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "Circular LED Light Circuit", sku: "HRFS-039", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "Circular LED Light (58x45x59cm)", sku: "HRFS-040", unit_of_measure: "unit", stock_quantity: 4, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "R5-54 LED Light (82x68x36cm)", sku: "HRFS-041", unit_of_measure: "unit", stock_quantity: 126, low_stock_threshold: 13, unit_cost: null, warehouse_location: "J2" },
    { name: "R3-45 LED Light (82x68x36cm)", sku: "HRFS-042", unit_of_measure: "unit", stock_quantity: 54, low_stock_threshold: 5, unit_cost: null, warehouse_location: "J2" },
    { name: "R2-30 LED Light (82x68x37cm)", sku: "HRFS-043", unit_of_measure: "unit", stock_quantity: 16, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "LED Light Panels", sku: "HRFS-044", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 8053 Long+Tail (118x82x15cm)", sku: "HRFS-045", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 8013 Tmall Voice (118x82x15cm)", sku: "HRFS-046", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 9061 Tmall Voice+ (118x82x15cm)", sku: "HRFS-047", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 8026 Tmall Voice (118x82x15cm)", sku: "HRFS-048", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 8032 Tmall Voice (118x82x15cm)", sku: "HRFS-049", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "3-Colour LED Light 8113 Small Square (118x82x15cm)", sku: "HRFS-050", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "Post-Modern Pendant Lamp 2126 (66x54x41cm)", sku: "HRFS-051", unit_of_measure: "unit", stock_quantity: 18, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "LED Strip Light (868x350mm)", sku: "HRFS-052", unit_of_measure: "unit", stock_quantity: 6, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "LED Big Light (74.5x30x46.5cm)", sku: "HRFS-053", unit_of_measure: "unit", stock_quantity: 10, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "LED Light R2-30 (68x58x35cm)", sku: "HRFS-054", unit_of_measure: "unit", stock_quantity: 23, low_stock_threshold: 2, unit_cost: null, warehouse_location: "J2" },
    { name: "Wall Washer Light (53x22x52cm)", sku: "HRFS-055", unit_of_measure: "unit", stock_quantity: 12, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "Universal Floor Socket (MD-5-CO5W)", sku: "HRFS-056", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "Flood Light (MR01P-5570200W)", sku: "HRFS-057", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    { name: "PVC Electrical Tape (1000mm)", sku: "HRFS-032", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J2" },
    // Miscellaneous (bay J1)
    { name: "Artificial Trees", sku: "HRFS-006", unit_of_measure: "unit", stock_quantity: 15, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Copper Pipe", sku: "HRFS-011", unit_of_measure: "unit", stock_quantity: 1, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Ergonomic Office Chair", sku: "HRFS-094", unit_of_measure: "unit", stock_quantity: 10, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    { name: "Indoor Cycling Machine (D525XMO1)", sku: "HRFS-095", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "J1" },
    // Wall panels (bays K2, L2)
    { name: "Teak Wall Panel Indoor (219x26x2901mm)", sku: "HRFS-074", unit_of_measure: "pc", stock_quantity: 1249, low_stock_threshold: 125, unit_cost: null, warehouse_location: "K2" },
    { name: "White Wall Panel Indoor (219x26x2902mm)", sku: "HRFS-075", unit_of_measure: "pc", stock_quantity: 850, low_stock_threshold: 85, unit_cost: null, warehouse_location: "K2" },
    { name: "Grey Wall Panel Indoor (155x17x2900mm)", sku: "HRFS-076", unit_of_measure: "pc", stock_quantity: 1280, low_stock_threshold: 128, unit_cost: null, warehouse_location: "K2" },
    { name: "Black Strings Wall Paper (155x17x2900mm)", sku: "HRFS-077", unit_of_measure: "pc", stock_quantity: 1861, low_stock_threshold: 186, unit_cost: null, warehouse_location: "K2" },
    { name: "White Wall Panel Indoor (154x17x2900mm)", sku: "HRFS-078", unit_of_measure: "pc", stock_quantity: 1300, low_stock_threshold: 130, unit_cost: null, warehouse_location: "K2" },
    { name: "Red Wall Paper Indoor (154x17x2900mm)", sku: "HRFS-079", unit_of_measure: "pc", stock_quantity: 1480, low_stock_threshold: 148, unit_cost: null, warehouse_location: "K2" },
    { name: "Black Wall Panel Indoor (219x26x2900mm)", sku: "HRFS-073", unit_of_measure: "pc", stock_quantity: 307, low_stock_threshold: 31, unit_cost: null, warehouse_location: "L2" },
    { name: "Aluminum Alloy", sku: "HRFS-021", unit_of_measure: "unit", stock_quantity: 557, low_stock_threshold: 56, unit_cost: null, warehouse_location: "L2" },
    // Shelving (bay H2)
    { name: "Multi-Deck Shelf", sku: "HRFS-080", unit_of_measure: "unit", stock_quantity: 14, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H2" },
    { name: "No Deck Shelf (Small)", sku: "HRFS-081", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H2" },
    { name: "No Deck Shelf (Long)", sku: "HRFS-082", unit_of_measure: "unit", stock_quantity: 13, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H2" },
    { name: "Drawer", sku: "HRFS-083", unit_of_measure: "unit", stock_quantity: 11, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H2" },
    { name: "Corner Shelf", sku: "HRFS-084", unit_of_measure: "unit", stock_quantity: 11, low_stock_threshold: 1, unit_cost: null, warehouse_location: "H2" },
    // Wall frames (bay P2)
    { name: "Wall Frames", sku: "HRFS-068", unit_of_measure: "unit", stock_quantity: 124, low_stock_threshold: 12, unit_cost: null, warehouse_location: "P2" },
    // HP Laptops (bay A2)
    { name: "HP Laptop", sku: "HRFS-093", unit_of_measure: "unit", stock_quantity: 200, low_stock_threshold: 20, unit_cost: null, warehouse_location: "A2" },
    // Bulk / unsorted (default bay A1)
    { name: "Deep Freezers (bulk)", sku: "HRFS-096", unit_of_measure: "unit", stock_quantity: 124, low_stock_threshold: 12, unit_cost: null, warehouse_location: "A1" },
    { name: "Hisense Outdoor Air Conditioner Units", sku: "HRFS-097", unit_of_measure: "unit", stock_quantity: 7, low_stock_threshold: 1, unit_cost: null, warehouse_location: "A1" },
    { name: "Hisense TV (older models)", sku: "HRFS-098", unit_of_measure: "unit", stock_quantity: 3, low_stock_threshold: 1, unit_cost: null, warehouse_location: "A1" },
    { name: "Shelf Stand Long (Big Size)", sku: "HRFS-099", unit_of_measure: "unit", stock_quantity: 334, low_stock_threshold: 33, unit_cost: null, warehouse_location: "A1" },
    { name: "Shelf Stand Long (Small Size)", sku: "HRFS-100", unit_of_measure: "unit", stock_quantity: 106, low_stock_threshold: 11, unit_cost: null, warehouse_location: "A1" },
    { name: "Bedside Stool Furniture", sku: "HRFS-101", unit_of_measure: "unit", stock_quantity: 16, low_stock_threshold: 2, unit_cost: null, warehouse_location: "A1" },
    { name: "HGC Banner Accessories", sku: "HRFS-102", unit_of_measure: "unit", stock_quantity: 2, low_stock_threshold: 1, unit_cost: null, warehouse_location: "A1" },

    // ── Othneil Brooks Oil and Gas (bay O1)
    { name: "Hard Hat Safety Helmet", sku: "OTBR-001", unit_of_measure: "unit", stock_quantity: 100, low_stock_threshold: 10, unit_cost: 18.0, warehouse_location: "O1" },
    { name: "Oil Pressure Gauge", sku: "OTBR-002", unit_of_measure: "unit", stock_quantity: 20, low_stock_threshold: 2, unit_cost: 45.0, warehouse_location: "O1" },
    { name: "Chemical Spill Kit", sku: "OTBR-003", unit_of_measure: "unit", stock_quantity: 30, low_stock_threshold: 3, unit_cost: 120.0, warehouse_location: "O1" },
    { name: "Heavy Duty Safety Gloves (Pair)", sku: "OTBR-004", unit_of_measure: "pair", stock_quantity: 120, low_stock_threshold: 12, unit_cost: 8.5, warehouse_location: "O1" },
    { name: "Hazmat Warning Sign", sku: "OTBR-005", unit_of_measure: "unit", stock_quantity: 50, low_stock_threshold: 5, unit_cost: 22.0, warehouse_location: "O1" },
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
    unitMap["JARA-TP"],
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
    unitMap["GRAX-BUL"],
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
    unitMap["BNTY-AV"],
  );

  // LaBamba
  const lbmbMgrId = await upsertUser(
    "manager.labamba@hgl-wms.com",
    "Labambam Operations Manager",
    "BU_MANAGER",
    sbuMap["LBMB"],
  );
  const lbmbStfId = await upsertUser(
    "staff.labamba@hgl-wms.com",
    "Labambam Store Staff",
    "UNIT_STAFF",
    sbuMap["LBMB"],
    unitMap["LBMB-TP"],
  );

  // HGC
  const hgcMgrId = await upsertUser(
    "manager.hgc@hgl-wms.com",
    "HGC Logistics Manager",
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

  // Ejabali Fashion Stores
  const ejblMgrId = await upsertUser(
    "manager.ejabali@hgl-wms.com",
    "Ejabali Branch Manager",
    "BU_MANAGER",
    sbuMap["EJBL"],
  );
  const ejblStfId = await upsertUser(
    "staff.ejabali@hgl-wms.com",
    "Ejabali Store Staff",
    "UNIT_STAFF",
    sbuMap["EJBL"],
    unitMap["EJBL-TP"],
  );

  // Harvest Retail Filling Station Chain
  const hrfsMgrId = await upsertUser(
    "manager.harvest@hgl-wms.com",
    "Harvest Retail Manager",
    "BU_MANAGER",
    sbuMap["HRFS"],
  );
  const hrfsStfId = await upsertUser(
    "staff.harvest@hgl-wms.com",
    "Harvest Retail Staff",
    "UNIT_STAFF",
    sbuMap["HRFS"],
    unitMap["HRFS-TP"],
  );

  // Othneil Brooks Oil and Gas
  const otbrMgrId = await upsertUser(
    "manager.othneil@hgl-wms.com",
    "Othneil Brooks Operations Manager",
    "BU_MANAGER",
    sbuMap["OTBR"],
  );
  const otbrStfId = await upsertUser(
    "staff.othneil@hgl-wms.com",
    "Othneil Brooks Operations Staff",
    "UNIT_STAFF",
    sbuMap["OTBR"],
    unitMap["OTBR-OP"],
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

  // ── Jara (retail FMCG) ─────────────────────────────────────────────────────
  // PENDING — monthly replenishment
  await insertTransfer(
    sbuMap["JARA"],
    unitMap["JARA-TP"],
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
    unitMap["JARA-AV"],
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
    unitMap["JARA-GER"],
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
    unitMap["GRAX-BUL"],
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
    unitMap["GRAX-WL"],
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
    unitMap["GRAX-TWR"],
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
    unitMap["BNTY-AV"],
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
    unitMap["BNTY-AV"],
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
    unitMap["BNTY-AV"],
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
    unitMap["LBMB-TP"],
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
    unitMap["LBMB-AV"],
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
    unitMap["LBMB-WL"],
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

  // ── Ejabali Fashion Stores ──────────────────────────────────────────────
  // PENDING — new branch display fixtures
  await insertTransfer(
    sbuMap["EJBL"],
    unitMap["EJBL-TP"],
    ejblMgrId,
    "PENDING",
    [
      { sku: "EJBL-001", qty: 10 },
      { sku: "EJBL-002", qty: 50 },
      { sku: "EJBL-004", qty: 20 },
    ],
    {
      notes: "Twin Palms branch opening — display fixtures & price tags",
      estimated_value: 2500,
      required_date: daysAhead(7),
      created_at: daysAgo(1),
    },
  );

  // PENDING_APPROVAL — fitting room mirrors
  await insertTransfer(
    sbuMap["EJBL"],
    unitMap["EJBL-AV"],
    ejblMgrId,
    "PENDING_APPROVAL",
    [
      { sku: "EJBL-003", qty: 8 },
      { sku: "EJBL-005", qty: 10 },
    ],
    {
      notes: "Avondale branch — fitting room mirrors & garment bags",
      estimated_value: 1200,
      requires_finance_approval: true,
      required_date: daysAhead(10),
      created_at: daysAgo(2),
    },
  );

  // ── Harvest Retail Filling Station Chain ───────────────────────────
  // PENDING — safety compliance stock
  await insertTransfer(
    sbuMap["HRFS"],
    unitMap["HRFS-TP"],
    hrfsMgrId,
    "PENDING",
    [
      { sku: "HRFS-001", qty: 30 },
      { sku: "HRFS-002", qty: 15 },
      { sku: "HRFS-003", qty: 5 },
    ],
    {
      notes: "Twin Palms station — fuel dispenser stock replenishment",
      estimated_value: 750,
      required_date: daysAhead(5),
      created_at: daysAgo(1),
    },
  );

  // APPROVED_FOR_ISSUE — Airport Road station consumables
  await insertTransfer(
    sbuMap["HRFS"],
    unitMap["HRFS-AR"],
    hrfsMgrId,
    "APPROVED_FOR_ISSUE",
    [
      { sku: "HRFS-004", qty: 40 },
      { sku: "HRFS-005", qty: 20 },
    ],
    {
      notes: "Airport Road station — chiller & industrial pump supplies",
      estimated_value: 260,
      approved_by: finId,
      approved_at: daysAgo(1),
      required_date: daysAhead(3),
      created_at: daysAgo(3),
    },
  );

  // ── Othneil Brooks Oil and Gas ──────────────────────────────────────
  // PENDING — new crew safety equipment
  await insertTransfer(
    sbuMap["OTBR"],
    unitMap["OTBR-OP"],
    otbrMgrId,
    "PENDING",
    [
      { sku: "OTBR-001", qty: 20 },
      { sku: "OTBR-003", qty: 10 },
      { sku: "OTBR-004", qty: 25 },
    ],
    {
      notes: "Site safety equipment for new operations crew",
      estimated_value: 1225,
      required_date: daysAhead(4),
      created_at: daysAgo(2),
    },
  );

  // PENDING_APPROVAL — hazmat signs & gauges
  await insertTransfer(
    sbuMap["OTBR"],
    unitMap["OTBR-DT"],
    otbrMgrId,
    "PENDING_APPROVAL",
    [
      { sku: "OTBR-002", qty: 5 },
      { sku: "OTBR-005", qty: 15 },
    ],
    {
      notes: "Depot — pressure gauges & hazmat warning signs",
      estimated_value: 1555,
      requires_finance_approval: true,
      required_date: daysAhead(8),
      created_at: daysAgo(1),
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

  // ── 8. Variance Dispositions (demo resolved example) ──────────────────────
  console.log("\n[8/8] Seeding variance dispositions…");

  // The Bounty variance transfer (bntyVarId) has WSL-002 short by 2 cartons.
  // We seed a resolved disposition so the Loss Account has example data.
  // To keep the seed idempotent we only insert if no disposition exists yet for this transfer.
  try {
    const { data: existingDisp } = await supabase
      .from("variance_dispositions")
      .select("id")
      .eq("transfer_request_id", bntyVarId)
      .limit(1)
      .single();

    if (!existingDisp) {
      // Fetch the GRN and line items for the Bounty variance transfer
      const { data: grnRows } = await supabase
        .from("grns")
        .select("id, grn_line_items(id, product_id, issued_quantity, quantity_received)")
        .eq("transfer_request_id", bntyVarId)
        .limit(1)
        .single();

      if (grnRows) {
        const grnId = (grnRows as any).id as string;
        const lineItems: any[] = (grnRows as any).grn_line_items ?? [];

        // Find the WSL-002 line (2 cartons short — mark as LOSS)
        const wsl002Line = lineItems.find(
          (li: any) => li.product_id === pm["WSL-002"] && li.issued_quantity > li.quantity_received,
        );

        if (wsl002Line) {
          const variance = wsl002Line.issued_quantity - wsl002Line.quantity_received;

          // Insert disposition row
          const { data: dispRow, error: dispErr } = await supabase
            .from("variance_dispositions")
            .insert({
              transfer_request_id: bntyVarId,
              grn_id: grnId,
              grn_line_item_id: wsl002Line.id,
              product_id: wsl002Line.product_id,
              sbu_id: sbuMap["BNTY"],
              quantity_variance: variance,
              disposition: "LOSS",
              decided_by: bntyMgrId,
              decided_at: daysAgo(5),
              notes: "2 cartons crushed in transit — unrecoverable, recorded as loss",
            })
            .select()
            .single();

          if (dispErr) throw dispErr;
          const dispId = (dispRow as any).id as string;

          // Fetch unit_cost for WSL-002
          const { data: prodRow } = await supabase
            .from("products")
            .select("unit_cost")
            .eq("id", wsl002Line.product_id)
            .single();
          const unitCost: number | null = (prodRow as any)?.unit_cost ?? null;

          // Insert stock loss row
          const { error: lossErr } = await supabase.from("stock_losses").insert({
            reference_number: `LOSS-${new Date().getFullYear()}-00001`,
            variance_disposition_id: dispId,
            transfer_request_id: bntyVarId,
            grn_id: grnId,
            product_id: wsl002Line.product_id,
            sbu_id: sbuMap["BNTY"],
            quantity_lost: variance,
            unit_cost_at_loss: unitCost,
            value_lost: unitCost != null ? variance * unitCost : null,
            decided_by: bntyMgrId,
            decided_at: daysAgo(5),
            reason_notes: "2 cartons crushed in transit — unrecoverable",
          });
          if (lossErr) throw lossErr;

          // Mark the Bounty transfer as COMPLETED (disposition resolved it)
          await supabase
            .from("transfer_requests")
            .update({
              status: "COMPLETED",
              variance_resolution_notes: "Disposed by BU Manager via per-line disposition",
              updated_at: daysAgo(5),
            })
            .eq("id", bntyVarId);

          console.log("  Bounty variance disposition (LOSS) seeded");
        }
      }
    } else {
      console.log("  Bounty variance disposition already exists — skipping");
    }
  } catch (e) {
    console.warn("  Warning: variance disposition seed failed (tables may not exist yet):", e);
  }

  console.log("  Variance dispositions seeded");

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
║  manager.jara@hgl-wms.com        ║  Jara FMCG (BU_MANAGER)   ║
║  staff.jara@hgl-wms.com          ║  Jara FMCG (UNIT_STAFF)   ║
║  manager.grandaccess@hgl-wms.com ║  Grand Access (BU_MANAGER) ║
║  staff.grandaccess@hgl-wms.com   ║  Grand Access (UNIT_STAFF) ║
║  manager.bounty@hgl-wms.com      ║  Bounty (BU_MANAGER)       ║
║  staff.bounty@hgl-wms.com        ║  Bounty (UNIT_STAFF)       ║
║  manager.labamba@hgl-wms.com     ║  Labambam (BU_MANAGER)     ║
║  staff.labamba@hgl-wms.com       ║  Labambam (UNIT_STAFF)     ║
║  manager.hgc@hgl-wms.com         ║  HGC Logistics (BU_MANAGER)║
║  staff.hgc@hgl-wms.com           ║  HGC Logistics (UNIT_STAFF)║
║  manager.ejabali@hgl-wms.com     ║  Ejabali (BU_MANAGER)      ║
║  staff.ejabali@hgl-wms.com       ║  Ejabali (UNIT_STAFF)      ║
║  manager.harvest@hgl-wms.com     ║  Harvest Retail (BU_MGR)   ║
║  staff.harvest@hgl-wms.com       ║  Harvest Retail (UNIT_STF) ║
║  manager.othneil@hgl-wms.com     ║  Othneil Brooks (BU_MGR)   ║
║  staff.othneil@hgl-wms.com       ║  Othneil Brooks (UNIT_STF) ║
╚══════════════════════════════════╩════════════════════════════╝
`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
