/**
 * seed_ejabali_stock.ts — Ejabali Fashion Stores (EJBL) stock seed
 *
 * Usage:
 *   npx tsx scripts/seed/seed_ejabali_stock.ts [path/to/file.xlsx]
 *   npm run seed:ejabali:stock
 *
 *   Default Excel path: scripts/seed/ejabali_inventory.xlsx
 *   Save "Ejabali_Lace_Stock_WMS.xlsx" to that path before running.
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EXCEL_PATH = path.resolve("scripts/seed/ejabali_inventory.xlsx");
const EJBL_CODE = "EJBL";
const EJBL_NAME = "Ejabali Fashion Stores";
const DEFAULT_UOM = "unit";
const DEFAULT_LOCATION = "N1";
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

const LACE_COLS = {
  color: ["color", "colour"],
  pattern: ["pattern", "style", "design", "lace pattern", "lace style", "type"],
  qty: [
    "bundles (as counted)",
    "bundles",
    "bundle",
    "qty",
    "quantity",
    "stock",
    "count",
    "pieces",
    "pcs",
    "units",
    "balance",
    "stock qty",
    "stock quantity",
  ],
  extra: ["extra unit", "extra units", "extra qty", "extra", "additional"],
  uom: ["unit of measure", "uom", "unit", "um"],
  cost: ["unit cost", "cost price", "cost", "price", "unit price", "rate", "buying price"],
  location: ["location", "bay", "warehouse location", "shelf", "loc"],
};

const PURSE_COLS = {
  sku: ["sku", "code", "item code", "product code", "ref", "id"],
  qty: ["qty", "quantity", "stock", "count", "pieces", "pcs", "units", "balance"],
  cost: ["unit cost", "cost price", "cost", "price", "unit price", "rate", "buying price"],
};

function normaliseLocation(raw: unknown): string {
  if (!raw) return DEFAULT_LOCATION;
  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z][12]$/.test(s)) return s;
  const letter = s.match(/[A-Z]/)?.[0];
  const digit = s.match(/[12]/)?.[0];
  if (letter && digit) return `${letter}${digit}`;
  return DEFAULT_LOCATION;
}

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

/** Returns true for rows that carry no real product data. */
function isSubtotalRow(color: string, pattern: string): boolean {
  const lower = `${color} ${pattern}`.toLowerCase();
  return (
    lower.includes("total") || lower.includes("subtotal") || pattern.includes("no items recorded")
  );
}

function parseLaceSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedRow[] {
  console.log(`\n  [Lace sheet] "${sheetName}"`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length === 0) return [];

  const headerRowIdx = findHeaderRow(rows);
  const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
  console.log(`    Headers: [${headers.map((h) => `"${h}"`).join(", ")}]`);

  const colColor = detectColumn(headers, LACE_COLS.color);
  const colPattern = detectColumn(headers, LACE_COLS.pattern);
  const colQty = detectColumn(headers, LACE_COLS.qty);
  const colExtra = detectColumn(headers, LACE_COLS.extra);
  const colUom = detectColumn(headers, LACE_COLS.uom);
  const colCost = detectColumn(headers, LACE_COLS.cost);
  const colLoc = detectColumn(headers, LACE_COLS.location);

  const hasColorPattern = colColor >= 0 && colPattern >= 0;

  console.log(
    `    Color    → col ${colColor >= 0 ? `${colColor} ("${headers[colColor]}")` : "NOT FOUND"}`,
  );
  console.log(
    `    Pattern  → col ${colPattern >= 0 ? `${colPattern} ("${headers[colPattern]}")` : "NOT FOUND"}`,
  );
  console.log(
    `    Qty      → col ${colQty >= 0 ? `${colQty} ("${headers[colQty]}")` : "NOT FOUND (col 1)"}`,
  );
  console.log(
    `    Extra    → col ${colExtra >= 0 ? `${colExtra} ("${headers[colExtra]}")` : "NOT FOUND (0)"}`,
  );
  console.log(
    `    Cost     → col ${colCost >= 0 ? `${colCost} ("${headers[colCost]}")` : "NOT FOUND"}`,
  );

  const qtyIdx = colQty >= 0 ? colQty : 1;
  const parsed: ParsedRow[] = [];
  let skipped = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    const rawColor = String(row[colColor] ?? "").trim();
    const rawPattern = colPattern >= 0 ? String(row[colPattern] ?? "").trim() : "";

    // Skip sentinel/subtotal rows; zero-qty rows are caught below
    if (isSubtotalRow(rawColor, rawPattern)) {
      skipped++;
      continue;
    }

    // Build name: "Color - Pattern" when both columns exist, else fall back to color or pattern alone
    let name: string;
    if (hasColorPattern && rawColor && rawPattern) {
      name = `${rawColor} - ${rawPattern} ${sheetName.trim()}`;
    } else if (rawColor) {
      name = rawColor;
    } else if (rawPattern) {
      name = rawPattern;
    } else {
      continue; // no usable name
    }

    const mainQty = parseQty(row[qtyIdx]) ?? 0;
    const extraQty = colExtra >= 0 ? (parseQty(row[colExtra]) ?? 0) : 0;
    const totalQty = mainQty + extraQty;

    parsed.push({
      name,
      stock_quantity: totalQty,
      unit_of_measure: colUom >= 0 ? String(row[colUom] ?? "").trim() || DEFAULT_UOM : DEFAULT_UOM,
      unit_cost: parseNumber(colCost >= 0 ? row[colCost] : null),
      warehouse_location: normaliseLocation(colLoc >= 0 ? row[colLoc] : null),
    });
  }

  console.log(`    Parsed ${parsed.length} lace row(s), skipped ${skipped} subtotal(s)`);
  for (const r of parsed.slice(0, 3)) {
    console.log(`      "${r.name}" qty=${r.stock_quantity}`);
  }
  return parsed;
}

function parsePurseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedRow[] {
  console.log(`\n  [Purse sheet] "${sheetName}"`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length === 0) return [];

  const headerRowIdx = findHeaderRow(rows);
  const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
  console.log(`    Headers: [${headers.map((h) => `"${h}"`).join(", ")}]`);

  const colSku = detectColumn(headers, PURSE_COLS.sku);
  const colQty = detectColumn(headers, PURSE_COLS.qty);
  const colCost = detectColumn(headers, PURSE_COLS.cost);

  console.log(
    `    SKU → col ${colSku >= 0 ? `${colSku} ("${headers[colSku]}")` : "NOT FOUND (col 0)"}`,
  );
  console.log(
    `    Qty → col ${colQty >= 0 ? `${colQty} ("${headers[colQty]}")` : "NOT FOUND (col 1)"}`,
  );

  const skuIdx = colSku >= 0 ? colSku : 0;
  const qtyIdx = colQty >= 0 ? colQty : 1;

  const parsed: ParsedRow[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    // Use the SKU cell as the product name
    const name = String(row[skuIdx] ?? "").trim();
    if (!name) continue;
    const qty = parseQty(row[qtyIdx]);
    parsed.push({
      name,
      stock_quantity: qty ?? 0,
      unit_of_measure: DEFAULT_UOM,
      unit_cost: parseNumber(colCost >= 0 ? row[colCost] : null),
      warehouse_location: DEFAULT_LOCATION, // same bay as lace sheet
    });
  }

  console.log(`    Parsed ${parsed.length} purse row(s)`);
  for (const r of parsed.slice(0, 3)) {
    console.log(`      "${r.name}" qty=${r.stock_quantity}`);
  }
  return parsed;
}

function parseExcel(filePath: string): ParsedRow[] {
  console.log(`\n[Excel] Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  if (wb.SheetNames.length === 0) throw new Error("Excel file contains no sheets.");
  console.log(`  Sheets: ${wb.SheetNames.map((s) => `"${s}"`).join(", ")}`);

  // Sheet 1 → lace (color + pattern columns)
  const laceRows = parseLaceSheet(wb.Sheets[wb.SheetNames[0]], wb.SheetNames[0]);

  // Sheet 2 → purses (if present)
  const purseRows =
    wb.SheetNames.length > 1 ? parsePurseSheet(wb.Sheets[wb.SheetNames[1]], wb.SheetNames[1]) : [];

  const all = [...laceRows, ...purseRows];
  console.log(
    `\n  Total parsed: ${laceRows.length} lace + ${purseRows.length} purse = ${all.length} row(s)`,
  );
  return all;
}

function skuToNumber(sku: string): number {
  const m = sku.match(/^EJBL-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function formatSku(n: number): string {
  return `${EJBL_CODE}-${String(n).padStart(3, "0")}`;
}

async function main() {
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error(`\n✗ Excel file not found: ${excelPath}`);
    console.error(`  Save "Ejabali_Lace_Stock_WMS.xlsx" as scripts/seed/ejabali_inventory.xlsx`);
    console.error(
      `  Or pass the path: npx tsx scripts/seed/seed_ejabali_stock.ts "path/to/file.xlsx"`,
    );
    process.exit(1);
  }

  const excelRows = parseExcel(excelPath);
  if (excelRows.length === 0) {
    console.error("\n✗ No valid product rows found. Check the column mapping above.");
    process.exit(1);
  }

  console.log(`\n[1] Upserting SBU…`);
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert({ name: EJBL_NAME, code: EJBL_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const ejblId = sbuData.id;
  console.log(`  SBU "${EJBL_NAME}" (${EJBL_CODE}) — id: ${ejblId}`);

  console.log(`\n[2] Loading existing EJBL products…`);
  const { data: existingProducts, error: existErr } = await supabase
    .from("products")
    .select("id, name, sku, is_active, stock_quantity")
    .like("sku", `${EJBL_CODE}-%`);
  if (existErr) throw existErr;
  const existing = (existingProducts ?? []) as ExistingProduct[];
  console.log(`  Found ${existing.length} existing EJBL-* products`);

  if (existing.length > 0) {
    console.log(`\n[3] Deactivating existing EJBL stock…`);
    const { error: zeroErr } = await supabase
      .from("products")
      .update({ stock_quantity: 0, is_active: false, updated_at: new Date().toISOString() })
      .like("sku", `${EJBL_CODE}-%`);
    if (zeroErr) throw zeroErr;
    console.log(`  Zeroed and deactivated ${existing.length} products`);
  } else {
    console.log(`\n[3] No existing EJBL products to deactivate`);
  }

  console.log(`\n[4] Clearing EJBL supplier GRNs…`);
  const { data: grnsDeleted, error: grnErr } = await supabase
    .from("supplier_grns")
    .delete()
    .eq("sbu_id", ejblId)
    .select("id");
  if (grnErr) throw grnErr;
  console.log(`  Deleted ${(grnsDeleted ?? []).length} supplier GRN(s)`);

  const nameToSku = new Map<string, string>();
  for (const p of existing) nameToSku.set(p.name.toLowerCase().trim(), p.sku);
  let nextSkuNum = existing.reduce((max, p) => Math.max(max, skuToNumber(p.sku)), 0) + 1;

  console.log(`\n[5] Building product upserts…`);
  let reused = 0;
  let created = 0;

  // Build per-SKU map first, then flatten — prevents duplicate-SKU upsert errors
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
      // name already seen in this file — reuse the SKU assigned earlier
      sku = skuMap.get(key)!.sku;
    } else {
      sku = formatSku(nextSkuNum++);
      created++;
    }
    if (skuMap.has(sku)) {
      // merge duplicate: sum quantities
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
  console.log(`\n✓ Done. Ejabali stock refreshed.`);
  console.log(`  SBU id            : ${ejblId}`);
  console.log(`  Products upserted : ${upsertedCount}`);
  console.log(`    ↳ matched (name) : ${reused}`);
  console.log(`    ↳ new SKUs       : ${created}`);
  console.log(`  Total units       : ${totalQty.toLocaleString()}`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
