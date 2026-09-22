/**
 * seed_hgc_stock.ts — HGC Logistics Company (HGCT) stock seed
 *
 * Combines Part Number + Name as the product name.
 * Uses the "counted stock" column as the authoritative quantity.
 * Warehouse location: O1
 *
 * Usage:
 *   npx tsx scripts/seed/seed_hgc_stock.ts [path/to/file.xlsx]
 *   npm run seed:hgc:stock
 *
 *   Default Excel path: scripts/seed/hgc_inventory.xlsx
 *   Save "HGC LEOPARDS HILL STOCK.xlsx" to that path before running.
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EXCEL_PATH = path.resolve("scripts/seed/hgc_inventory.xlsx");
const HGCT_CODE = "HGCT";
const HGCT_NAME = "HGC Logistics Company";
const DEFAULT_UOM = "unit";
const WAREHOUSE_LOCATION = "O1";
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
  partNo: [
    "part no",
    "part number",
    "part#",
    "part no.",
    "partno",
    "item no",
    "item number",
    "number",
    "no",
  ],
  name: [
    "name",
    "description",
    "item name",
    "item description",
    "item",
    "product name",
    "desc",
    "product",
  ],
  // "counted stock" is the authoritative count; fall back to other qty names
  qty: [
    "counted stock",
    "counted",
    "count stock",
    "physical count",
    "actual count",
    "stock count",
    "stock balance",
    "stock qty",
    "stock quantity",
    "balance",
    "qty",
    "quantity",
    "stock",
    "amount",
    "units",
    "pieces",
    "pcs",
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
  return combined.includes("total") || combined.includes("subtotal");
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

    const colPartNo = detectColumn(headers, COLS.partNo);
    const colName = detectColumn(headers, COLS.name);
    const colQty = detectColumn(headers, COLS.qty);
    const colUom = detectColumn(headers, COLS.uom);
    const colCost = detectColumn(headers, COLS.cost);

    console.log(
      `    Part No → col ${colPartNo >= 0 ? `${colPartNo} ("${headers[colPartNo]}")` : "NOT FOUND"}`,
    );
    console.log(
      `    Name    → col ${colName >= 0 ? `${colName} ("${headers[colName]}")` : "NOT FOUND"}`,
    );
    console.log(
      `    Qty     → col ${colQty >= 0 ? `${colQty} ("${headers[colQty]}")` : "NOT FOUND"}`,
    );

    if (colName < 0 && colPartNo < 0) {
      console.log("    SKIP: no name or part-number column found");
      continue;
    }

    const qtyIdx = colQty >= 0 ? colQty : colName >= 0 ? colName + 1 : 1;
    let parsed = 0;
    let skipped = 0;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];

      const rawPartNo = colPartNo >= 0 ? String(row[colPartNo] ?? "").trim() : "";
      const rawName = colName >= 0 ? String(row[colName] ?? "").trim() : "";

      if (!rawPartNo && !rawName) continue;
      if (isSkippableRow([rawPartNo, rawName])) {
        skipped++;
        continue;
      }

      // Combine part number + name; use whichever is available
      let name: string;
      if (rawPartNo && rawName) {
        name = `${rawPartNo} - ${rawName}`;
      } else {
        name = rawPartNo || rawName;
      }

      const qty = parseQty(row[qtyIdx]) ?? 0;
      const uom = colUom >= 0 ? String(row[colUom] ?? "").trim() || DEFAULT_UOM : DEFAULT_UOM;

      all.push({
        name,
        stock_quantity: qty,
        unit_of_measure: uom,
        unit_cost: parseNumber(colCost >= 0 ? row[colCost] : null),
        warehouse_location: WAREHOUSE_LOCATION,
      });
      parsed++;
    }

    console.log(`    → ${parsed} row(s) parsed, ${skipped} skipped`);
    for (const r of all.slice(-Math.min(parsed, 3))) {
      console.log(`      "${r.name}" qty=${r.stock_quantity}`);
    }
  }

  console.log(`\n  Total: ${all.length} row(s) across ${wb.SheetNames.length} sheet(s)`);
  return all;
}

// ─── SKU helpers ──────────────────────────────────────────────────────────────

function skuToNumber(sku: string): number {
  const m = sku.match(/^HGCT-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function formatSku(n: number): string {
  return `${HGCT_CODE}-${String(n).padStart(3, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error(`\n✗ Excel file not found: ${excelPath}`);
    console.error(`  Save "HGC LEOPARDS HILL STOCK.xlsx" as scripts/seed/hgc_inventory.xlsx`);
    console.error(`  Or pass the path: npx tsx scripts/seed/seed_hgc_stock.ts "path/to/file.xlsx"`);
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
    .upsert({ name: HGCT_NAME, code: HGCT_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const hgctId = sbuData.id;
  console.log(`  "${HGCT_NAME}" (${HGCT_CODE}) — id: ${hgctId}`);

  console.log(`\n[2] Loading existing HGCT products…`);
  const { data: existingProducts, error: existErr } = await supabase
    .from("products")
    .select("id, name, sku, is_active, stock_quantity")
    .like("sku", `${HGCT_CODE}-%`);
  if (existErr) throw existErr;
  const existing = (existingProducts ?? []) as ExistingProduct[];
  console.log(`  Found ${existing.length} existing HGCT-* products`);

  if (existing.length > 0) {
    console.log(`\n[3] Deactivating existing HGCT stock…`);
    const { error: zeroErr } = await supabase
      .from("products")
      .update({ stock_quantity: 0, is_active: false, updated_at: new Date().toISOString() })
      .like("sku", `${HGCT_CODE}-%`);
    if (zeroErr) throw zeroErr;
    console.log(`  Zeroed and deactivated ${existing.length} products`);
  } else {
    console.log(`\n[3] No existing HGCT products to deactivate`);
  }

  console.log(`\n[4] Clearing HGCT supplier GRNs…`);
  const { data: grnsDeleted, error: grnErr } = await supabase
    .from("supplier_grns")
    .delete()
    .eq("sbu_id", hgctId)
    .select("id");
  if (grnErr) throw grnErr;
  console.log(`  Deleted ${(grnsDeleted ?? []).length} supplier GRN(s)`);

  console.log(`\n[5] Building product upserts…`);
  const nameToSku = new Map<string, string>();
  for (const p of existing) nameToSku.set(p.name.toLowerCase().trim(), p.sku);
  let nextSkuNum = existing.reduce((max, p) => Math.max(max, skuToNumber(p.sku)), 0) + 1;
  let reused = 0;
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
    if (nameToSku.has(key)) {
      sku = nameToSku.get(key)!;
      reused++;
    } else if (skuMap.has(key)) {
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
  console.log(
    `  ${reused} matched by name (SKU preserved), ${created} new, ${excelRows.length - upserts.length} duplicate(s) merged`,
  );

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
  console.log(`\n✓ Done. HGC stock loaded.`);
  console.log(`  SBU id            : ${hgctId}`);
  console.log(`  Products upserted : ${upsertedCount}`);
  console.log(`    ↳ matched (name) : ${reused}`);
  console.log(`    ↳ new SKUs       : ${created}`);
  console.log(`  Total units       : ${totalQty.toLocaleString()}`);
  console.log(`  Warehouse bay     : ${WAREHOUSE_LOCATION}`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
