/**
 * seed_harvest_stock.ts — Harvest Retail Filling Station Chain (HRFS) stock seed
 *
 * Loads "Harvest Stocktake Report.1.xlsx" (or any path passed as an argument).
 * Combines product code + name as the product name.
 * Uses the "counted" / "physical count" column as the authoritative quantity.
 * Warehouse location default: H1
 *
 * Usage:
 *   npx tsx scripts/seed/seed_harvest_stock.ts [path/to/file.xlsx]
 *   npm run seed:harvest:stock
 *
 *   Default Excel path: scripts/seed/harvest_inventory.xlsx
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EXCEL_PATH = path.resolve("scripts/seed/harvest_inventory.xlsx");
const HRFS_CODE = "HRFS";
const HRFS_NAME = "Harvest Retail Filling Station Chain";
const DEFAULT_UOM = "unit";
const DEFAULT_LOCATION = "H1";
const DEFAULT_LOW_STOCK = 1;

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

interface ParsedRow {
  name: string;
  stock_quantity: number;
  unit_of_measure: string;
  unit_cost: number | null;
  warehouse_location: string;
}

interface ExistingProduct {
  id: string;
  name: string;
  sku: string;
  is_active: boolean;
  stock_quantity: number;
}

// ─── Column detection ─────────────────────────────────────────────────────────

function detectColumn(headers: string[], patterns: string[]): number {
  const norm = headers.map((h) =>
    String(h ?? "")
      .toLowerCase()
      .trim(),
  );
  for (const pat of patterns) {
    const idx = norm.findIndex((h) => h === pat);
    if (idx !== -1) return idx;
  }
  for (const pat of patterns) {
    const idx = norm.findIndex((h) => h.includes(pat));
    if (idx !== -1) return idx;
  }
  return -1;
}

const COLS = {
  // The "code" column is the retail SBU/store code — ignored for product naming
  itemId: ["item no", "item number", "no", "id", "seq", "s/n", "sn", "#", "item id", "line"],
  model: [
    "model number",
    "model no",
    "model",
    "reference",
    "ref no",
    "ref",
    "part ref",
    "part no",
    "part number",
  ],
  name: [
    "item description",
    "product name",
    "item name",
    "description",
    "name",
    "product",
    "item",
    "desc",
  ],
  // Prioritise physical/counted columns; never pick "system qty" or "book qty" first
  qty: [
    "counted qty",
    "counted quantity",
    "counted stock",
    "counted",
    "physical count",
    "physical qty",
    "physical quantity",
    "physical",
    "actual count",
    "actual qty",
    "actual quantity",
    "actual",
    "stocktake qty",
    "stocktake quantity",
    "stocktake",
    "stock count",
    "stock balance",
    "balance",
    "qty",
    "quantity",
    "stock",
  ],
  uom: ["unit of measure", "unit_of_measure", "uom", "unit", "um", "measure"],
  cost: [
    "unit cost",
    "unit_cost",
    "cost price",
    "cost",
    "price",
    "unit price",
    "rate",
    "buying price",
  ],
  loc: ["location", "bay", "warehouse location", "shelf", "loc", "area"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(val: unknown): number | null {
  const n = parseFloat(String(val ?? ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseQty(val: unknown): number | null {
  const n = parseNumber(val);
  return n !== null ? Math.round(n) : null;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if ((rows[i] ?? []).filter((c) => c !== null && c !== "").length >= 2) return i;
  }
  return 0;
}

function isSkippableRow(cells: string[]): boolean {
  const combined = cells.join(" ").toLowerCase();
  return (
    combined.includes("total") || combined.includes("subtotal") || combined.includes("grand total")
  );
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

function parseExcel(filePath: string): ParsedRow[] {
  console.log(`\n[Excel] Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  if (wb.SheetNames.length === 0) throw new Error("Excel file contains no sheets.");
  console.log(`  Sheets: ${wb.SheetNames.map((s) => `"${s}"`).join(", ")}`);

  const all: ParsedRow[] = [];

  for (const sheetName of wb.SheetNames) {
    console.log(`\n  Sheet: "${sheetName}"`);
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (rows.length === 0) {
      console.log("    (empty)");
      continue;
    }

    const headerRowIdx = findHeaderRow(rows);
    const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
    console.log(`    Headers: [${headers.map((h) => `"${h}"`).join(", ")}]`);

    const colItemId = detectColumn(headers, COLS.itemId);
    const colModel = detectColumn(headers, COLS.model);
    const colName = detectColumn(headers, COLS.name);
    const colQty = detectColumn(headers, COLS.qty);
    const colUom = detectColumn(headers, COLS.uom);
    const colCost = detectColumn(headers, COLS.cost);
    const colLoc = detectColumn(headers, COLS.loc);

    console.log(
      `    Item ID → col ${colItemId >= 0 ? `${colItemId} ("${headers[colItemId]}")` : "NOT FOUND"}`,
    );
    console.log(
      `    Model   → col ${colModel >= 0 ? `${colModel} ("${headers[colModel]}")` : "NOT FOUND"}`,
    );
    console.log(
      `    Name    → col ${colName >= 0 ? `${colName} ("${headers[colName]}")` : "NOT FOUND"}`,
    );
    console.log(
      `    Qty     → col ${colQty >= 0 ? `${colQty} ("${headers[colQty]}")` : "NOT FOUND"}`,
    );

    if (colModel < 0 && colName < 0) {
      console.log("    SKIP: no identifier column found");
      continue;
    }

    // Carry forward grouped identifiers (for sheets where code/name only appears on first row)
    let lastName = "";
    let parsed = 0;
    let skipped = 0;
    const sheetStart = all.length;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];

      const rawItemId = colItemId >= 0 ? String(row[colItemId] ?? "").trim() : "";
      const rawModel = colModel >= 0 ? String(row[colModel] ?? "").trim() : "";
      const rawName = colName >= 0 ? String(row[colName] ?? "").trim() : "";

      if (rawName) lastName = rawName;

      const effectiveName = rawName || lastName;

      if (!rawModel && !effectiveName) continue;
      if (isSkippableRow([rawItemId, rawModel, effectiveName])) {
        skipped++;
        continue;
      }

      // Name: Model/Ref - Description
      const nameParts = [rawModel, effectiveName].filter(Boolean);
      const name = nameParts.join(" - ");

      const qtyIdx =
        colQty >= 0 ? colQty : colName >= 0 ? colName + 1 : colModel >= 0 ? colModel + 1 : 1;
      const qty = parseQty(row[qtyIdx]) ?? 0;

      const rawLoc = colLoc >= 0 ? String(row[colLoc] ?? "").trim() : "";
      const loc = rawLoc || DEFAULT_LOCATION;

      all.push({
        name,
        stock_quantity: qty,
        unit_of_measure:
          colUom >= 0 ? String(row[colUom] ?? "").trim() || DEFAULT_UOM : DEFAULT_UOM,
        unit_cost: parseNumber(colCost >= 0 ? row[colCost] : null),
        warehouse_location: loc,
      });
      parsed++;
    }

    console.log(`    → ${parsed} row(s) parsed, ${skipped} skipped`);
    for (const r of all.slice(sheetStart, sheetStart + 3)) {
      console.log(`      "${r.name}" qty=${r.stock_quantity} loc=${r.warehouse_location}`);
    }
  }

  console.log(`\n  Total: ${all.length} row(s) across ${wb.SheetNames.length} sheet(s)`);
  return all;
}

// ─── SKU helpers ──────────────────────────────────────────────────────────────

function skuToNumber(sku: string): number {
  const m = sku.match(/^HRFS-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function formatSku(n: number): string {
  return `${HRFS_CODE}-${String(n).padStart(3, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error(`\n✗ Excel file not found: ${excelPath}`);
    console.error(
      `  Save "Harvest Stocktake Report.1.xlsx" as scripts/seed/harvest_inventory.xlsx`,
    );
    console.error(
      `  Or pass the path: npx tsx scripts/seed/seed_harvest_stock.ts "path/to/file.xlsx"`,
    );
    process.exit(1);
  }

  const excelRows = parseExcel(excelPath);
  if (excelRows.length === 0) {
    console.error("\n✗ No valid product rows found. Check column mapping output above.");
    process.exit(1);
  }

  console.log(`\n[1] Upserting SBU…`);
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert({ name: HRFS_NAME, code: HRFS_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const hrfsId = sbuData.id;
  console.log(`  "${HRFS_NAME}" (${HRFS_CODE}) — id: ${hrfsId}`);

  console.log(`\n[2] Loading existing HRFS products…`);
  const { data: existingProducts, error: existErr } = await supabase
    .from("products")
    .select("id, name, sku, is_active, stock_quantity")
    .like("sku", `${HRFS_CODE}-%`);
  if (existErr) throw existErr;
  const existing = (existingProducts ?? []) as ExistingProduct[];
  console.log(`  Found ${existing.length} existing HRFS-* products`);

  if (existing.length > 0) {
    console.log(`\n[3] Deleting existing HRFS products…`);
    // Delete in chunks to stay within URL length limits
    const ids = existing.map((p) => p.id);
    const CHUNK = 50;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error: delErr } = await supabase
        .from("products")
        .delete()
        .in("id", ids.slice(i, i + CHUNK));
      if (delErr) throw delErr;
      deleted += Math.min(CHUNK, ids.length - i);
    }
    console.log(`  Deleted ${deleted} products`);
  } else {
    console.log(`\n[3] No existing HRFS products to delete`);
  }

  console.log(`\n[4] Clearing HRFS supplier GRNs…`);
  const { data: grnsDeleted, error: grnErr } = await supabase
    .from("supplier_grns")
    .delete()
    .eq("sbu_id", hrfsId)
    .select("id");
  if (grnErr) throw grnErr;
  console.log(`  Deleted ${(grnsDeleted ?? []).length} supplier GRN(s)`);

  console.log(`\n[5] Building product upserts…`);
  // existing is empty after deletion; nextSkuNum starts from 1
  let nextSkuNum = 1;
  let created = 0;

  // Deduplicate by SKU — sum quantities for duplicate names
  const skuMap = new Map<string, ReturnType<typeof buildProduct>>();

  function buildProduct(row: ParsedRow, sku: string) {
    return {
      name: row.name,
      sku,
      unit_of_measure: row.unit_of_measure,
      stock_quantity: row.stock_quantity,
      low_stock_threshold: Math.max(DEFAULT_LOW_STOCK, Math.round(row.stock_quantity * 0.1)),
      unit_cost: row.unit_cost,
      warehouse_location: row.warehouse_location,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
  }

  for (const row of excelRows) {
    const key = row.name.toLowerCase().trim();
    let sku: string;
    if (skuMap.has(key)) {
      sku = skuMap.get(key)!.sku;
    } else {
      sku = formatSku(nextSkuNum++);
      created++;
    }
    if (skuMap.has(sku)) {
      skuMap.get(sku)!.stock_quantity += row.stock_quantity;
    } else {
      skuMap.set(sku, buildProduct(row, sku));
    }
  }

  const upserts = [...skuMap.values()];
  console.log(`  ${created} new SKUs, ${excelRows.length - upserts.length} duplicate(s) merged`);

  console.log(`\n[6] Upserting ${upserts.length} products…`);
  const BATCH = 100;
  let upsertedCount = 0;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const { data: d, error: e } = await supabase
      .from("products")
      .upsert(upserts.slice(i, i + BATCH), { onConflict: "sku" })
      .select("id");
    if (e) throw e;
    upsertedCount += (d ?? []).length;
  }

  const totalQty = upserts.reduce((sum, p) => sum + p.stock_quantity, 0);
  console.log(`\n✓ Done. Harvest Retail stock loaded.`);
  console.log(`  SBU id            : ${hrfsId}`);
  console.log(`  Products upserted : ${upsertedCount}`);
  console.log(`    ↳ new SKUs       : ${created}`);
  console.log(`  Total units       : ${totalQty.toLocaleString()}`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
