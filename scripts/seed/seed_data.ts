/**
 * Seed script — scripts/seed/seed_data.ts
 * Populates the DB with initial SBUs, products, and an admin user for testing.
 *
 * Run: npx tsx scripts/seed/seed_data.ts
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Seeding SBUs…");
  const sbus = [
    { name: "Head Office", code: "HO" },
    { name: "Operations", code: "OPS" },
    { name: "Marketing", code: "MKT" },
    { name: "Finance", code: "FIN" },
  ];
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert(sbus, { onConflict: "code" })
    .select();
  if (sbuError) throw sbuError;
  console.log(`  Upserted ${sbuData?.length ?? 0} SBUs`);

  console.log("Seeding products…");
  const products = [
    {
      name: "A4 Paper Ream",
      sku: "STN-001",
      unit_of_measure: "ream",
      stock_quantity: 500,
      low_stock_threshold: 50,
      unit_cost: 4.5,
    },
    {
      name: "Ballpoint Pen (Blue)",
      sku: "STN-002",
      unit_of_measure: "box",
      stock_quantity: 200,
      low_stock_threshold: 20,
      unit_cost: 3.0,
    },
    {
      name: "Printer Toner (Black)",
      sku: "STN-003",
      unit_of_measure: "unit",
      stock_quantity: 30,
      low_stock_threshold: 5,
      unit_cost: 75.0,
    },
    {
      name: "Laptop Bag",
      sku: "IT-001",
      unit_of_measure: "unit",
      stock_quantity: 15,
      low_stock_threshold: 3,
      unit_cost: 25.0,
    },
    {
      name: "USB Cable (Type-C)",
      sku: "IT-002",
      unit_of_measure: "unit",
      stock_quantity: 80,
      low_stock_threshold: 10,
      unit_cost: 6.0,
    },
    {
      name: "Sanitizer 500ml",
      sku: "HYG-001",
      unit_of_measure: "bottle",
      stock_quantity: 100,
      low_stock_threshold: 15,
      unit_cost: 2.5,
    },
  ];
  const { data: prodData, error: prodError } = await supabase
    .from("products")
    .upsert(products, { onConflict: "sku" })
    .select();
  if (prodError) throw prodError;
  console.log(`  Upserted ${prodData?.length ?? 0} products`);

  console.log("Creating admin user…");
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@harvest-wms.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@1234!";
  const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: "ADMIN", full_name: "System Admin" },
  });
  if (adminError && !adminError.message.includes("already been registered")) {
    throw adminError;
  }
  if (adminUser?.user) {
    await supabase.from("profiles").upsert({
      id: adminUser.user.id,
      full_name: "System Admin",
      role: "ADMIN",
      sbu_id: null,
      is_active: true,
    });
    console.log(`  Admin user: ${adminEmail}`);
  } else {
    console.log("  Admin user already exists, skipping.");
  }

  console.log("\nSeed complete ✓");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
