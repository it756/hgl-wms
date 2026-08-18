/**
 * seed_ejabali_q2_stock.ts — Ejabali Fashion Stores Q2 2026 stock count seed
 *
 * Loads "SECOND_QUARTER_STOCK_COUNT_2026_updated.xlsx" (or any path passed as
 * an argument) into the EJBL product catalogue.
 *
 * Sheet handling:
 *   – Every sheet in the workbook is parsed and combined.
 *   – If a sheet has separate Colour + Pattern columns, names are joined as
 *     "Colour - Pattern".
 *   – If a sheet has a single name/description column, that is used directly.
 *   – Rows that look like subtotals (empty pattern while colour is set, or
 *     text containing "total") are skipped.
 *   – Rows with no usable quantity are skipped.
 *
 * Usage:
 *   npx tsx scripts/seed/seed_ejabali_q2_stock.ts [path/to/file.xlsx]
 *   npm run seed:ejabali:q2
 *
 *   Default Excel path: scripts/seed/ejabali_q2_inventory.xlsx
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EXCEL_PATH = path.resolve("scripts/seed/ejabali_q2_inventory.xlsx");
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
  color: ["color", "colour"],
  pattern: ["pattern", "style", "design", "lace pattern", "lace style", "type"],
  name: [
    "name",
    "description",
    "item name",
    "item description",
    "item",
    "product name",
    "desc",
    "product",
    "sku",
    "code",
  ],
  qty: [
    "bundles (as counted)",
    "bundles",
    "bundle",
    "stock balance",
    "stock qty",
    "stock quantity",
    "balance",
    "qty",
    "quantity",
    "stock",
    "count",
    "amount",
    "units",
    "pieces",
    "pcs",
  ],
  extra: ["extra unit", "extra units", "extra qty", "extra", "additional"],
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
  location: ["warehouse location", "warehouse_location", "location", "bay", "shelf", "loc", "area"],
};

// ─── Row helpers ──────────────────────────────────────────────────────────────

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

function isSkippableRow(cells: string[]): boolean {
  const combined = cells.join(" ").toLowerCase();
  // Only skip genuine total/summary rows
  return combined.includes("total") || combined.includes("subtotal");
}

/** Collect indices of every column whose header contains "quantity" or "qty". */
function allQtyCols(headers: string[]): number[] {
  return headers.reduce<number[]>((acc, h, i) => {
    const lower = h.toLowerCase().trim();
    if (lower.includes("quantity") || lower.includes("qty") || lower.includes("bundles"))
      acc.push(i);
    return acc;
  }, []);
}

// ─── Sheet parser ─────────────────────────────────────────────────────────────

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedRow[] {
  console.log(`\n  Sheet: "${sheetName}"`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length === 0) {
    console.log("    (empty)");
    return [];
  }

  const headerRowIdx = findHeaderRow(rows);
  const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
  console.log(`    Headers: [${headers.map((h) => `"${h}"`).join(", ")}]`);

  // Strict name columns (not SKU/code — those are secondary identifiers)
  const colNameStrict = detectColumn(headers, [
    "name",
    "product name",
    "item name",
    "description",
    "item description",
    "product",
  ]);
  // Code/SKU as fallback identifier
  const colCode = detectColumn(headers, ["code", "sku", "ref", "item code", "product code"]);
  const colColor = detectColumn(headers, COLS.color);
  const colPattern = detectColumn(headers, COLS.pattern);
  const colSize = detectColumn(headers, ["sizes", "size"]);
  const colUom = detectColumn(headers, COLS.uom);
  const colCost = detectColumn(headers, COLS.cost);
  const colLoc = detectColumn(headers, COLS.location);

  // Sum every quantity-bearing column (handles QUANTITY(Rolls), QUANTITY(Yards) etc.)
  const qtyCols = allQtyCols(headers);
  // If no quantity column found fall back to the column after the first identifier
  const fallbackQtyIdx = (colNameStrict >= 0 ? colNameStrict : colColor >= 0 ? colColor : 0) + 1;

  const hasColorPattern = colColor >= 0 && colPattern >= 0;

  console.log(`    Mode: ${hasColorPattern ? "colour+pattern" : "flexible"}`);
  console.log(
    `    Qty cols: ${qtyCols.length > 0 ? qtyCols.map((i) => `${i}("${headers[i]}")`).join(", ") : `fallback col ${fallbackQtyIdx}`}`,
  );
  if (colNameStrict >= 0)
    console.log(`    Name col: ${colNameStrict} ("${headers[colNameStrict]}")`);
  if (colCode >= 0) console.log(`    Code col: ${colCode} ("${headers[colCode]}")`);
  if (colColor >= 0) console.log(`    Color col: ${colColor} ("${headers[colColor]}")`);
  if (colSize >= 0) console.log(`    Size col: ${colSize} ("${headers[colSize]}")`);

  const parsed: ParsedRow[] = [];
  let skipped = 0;

  // Carry-forward: grouped sheets repeat colour/name only on the first row of a group
  let lastName = "";
  let lastCode = "";
  let lastColor = "";

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    const rawName = colNameStrict >= 0 ? String(row[colNameStrict] ?? "").trim() : "";
    const rawCode = colCode >= 0 ? String(row[colCode] ?? "").trim() : "";
    const rawColor = colColor >= 0 ? String(row[colColor] ?? "").trim() : "";
    const rawPattern = colPattern >= 0 ? String(row[colPattern] ?? "").trim() : "";
    const rawSize = colSize >= 0 ? String(row[colSize] ?? "").trim() : "";

    // Carry forward non-empty grouping cells
    if (rawName) lastName = rawName;
    if (rawCode) lastCode = rawCode;
    if (rawColor) lastColor = rawColor;

    const effectiveName = rawName || lastName;
    const effectiveCode = rawCode || lastCode;
    const effectiveColor = rawColor || lastColor;

    if (isSkippableRow([effectiveName, effectiveCode, effectiveColor, rawPattern, rawSize])) {
      skipped++;
      continue;
    }

    // Build product name
    let name: string;
    if (hasColorPattern && effectiveColor && rawPattern) {
      // Original lace-style: Colour - Pattern SheetName
      name = `${effectiveColor} - ${rawPattern} ${sheetName.trim()}`;
    } else if (effectiveName && effectiveColor && effectiveName !== effectiveColor) {
      name = `${effectiveName} - ${effectiveColor} ${sheetName.trim()}`;
    } else if (effectiveName) {
      name = `${effectiveName} ${sheetName.trim()}`;
    } else if (effectiveColor) {
      name = `${effectiveColor} ${sheetName.trim()}`;
    } else if (effectiveCode) {
      name = `${effectiveCode} ${sheetName.trim()}`;
    } else {
      continue; // truly no identifier on this row
    }

    if (rawSize) name += ` (${rawSize})`;

    // Sum all quantity columns; fall back to positional guess if none detected
    const totalQty =
      qtyCols.length > 0
        ? qtyCols.reduce((sum, ci) => sum + (parseQty(row[ci]) ?? 0), 0)
        : (parseQty(row[fallbackQtyIdx]) ?? 0);

    parsed.push({
      name,
      stock_quantity: totalQty,
      unit_of_measure: colUom >= 0 ? String(row[colUom] ?? "").trim() || DEFAULT_UOM : DEFAULT_UOM,
      unit_cost: parseNumber(colCost >= 0 ? row[colCost] : null),
      warehouse_location: normaliseLocation(colLoc >= 0 ? row[colLoc] : null),
    });
  }

  console.log(`    → ${parsed.length} row(s) parsed, ${skipped} skipped`);
  for (const r of parsed.slice(0, 3)) {
    console.log(`      "${r.name}" qty=${r.stock_quantity}`);
  }
  return parsed;
}

// ─── Workbook parser ──────────────────────────────────────────────────────────

function parseExcel(filePath: string): ParsedRow[] {
  console.log(`\n[Excel] Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  if (wb.SheetNames.length === 0) throw new Error("Excel file contains no sheets.");
  console.log(`  Sheets: ${wb.SheetNames.map((s) => `"${s}"`).join(", ")}`);

  const all: ParsedRow[] = [];
  for (const name of wb.SheetNames) {
    all.push(...parseSheet(wb.Sheets[name], name));
  }

  console.log(`\n  Total: ${all.length} row(s) across ${wb.SheetNames.length} sheet(s)`);
  return all;
}

// ─── SKU helpers ──────────────────────────────────────────────────────────────

function skuToNumber(sku: string): number {
  const m = sku.match(/^EJBL-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function formatSku(n: number): string {
  return `${EJBL_CODE}-${String(n).padStart(3, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error(`\n✗ Excel file not found: ${excelPath}`);
    console.error(`  Save "SECOND_QUARTER_STOCK_COUNT_2026_updated.xlsx" as:`);
    console.error(`    scripts/seed/ejabali_q2_inventory.xlsx`);
    console.error(`  Or pass the path directly:`);
    console.error(`    npx tsx scripts/seed/seed_ejabali_q2_stock.ts "path/to/file.xlsx"`);
    process.exit(1);
  }

  const excelRows = parseExcel(excelPath);
  if (excelRows.length === 0) {
    console.error("\n✗ No valid product rows found. Check column mapping output above.");
    process.exit(1);
  }

  // ── 1. Upsert SBU ───────────────────────────────────────────────────────────
  console.log(`\n[1] Upserting SBU…`);
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert({ name: EJBL_NAME, code: EJBL_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const ejblId = sbuData.id;
  console.log(`  "${EJBL_NAME}" (${EJBL_CODE}) — id: ${ejblId}`);

  // ── 2. Load existing EJBL-* products ────────────────────────────────────────
  console.log(`\n[2] Loading existing EJBL products…`);
  const { data: existingProducts, error: existErr } = await supabase
    .from("products")
    .select("id, name, sku, is_active, stock_quantity")
    .like("sku", `${EJBL_CODE}-%`);
  if (existErr) throw existErr;
  const existing = (existingProducts ?? []) as ExistingProduct[];
  console.log(`  Found ${existing.length} existing EJBL-* products`);

  // ── 3. Deactivate existing stock ────────────────────────────────────────────
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

  // ── 4. Clear supplier GRNs ───────────────────────────────────────────────────
  console.log(`\n[4] Clearing EJBL supplier GRNs…`);
  const { data: grnsDeleted, error: grnErr } = await supabase
    .from("supplier_grns")
    .delete()
    .eq("sbu_id", ejblId)
    .select("id");
  if (grnErr) throw grnErr;
  console.log(`  Deleted ${(grnsDeleted ?? []).length} supplier GRN(s)`);

  // ── 5. Build upserts ─────────────────────────────────────────────────────────
  console.log(`\n[5] Building product upserts…`);
  const nameToSku = new Map<string, string>();
  for (const p of existing) nameToSku.set(p.name.toLowerCase().trim(), p.sku);
  let nextSkuNum = existing.reduce((max, p) => Math.max(max, skuToNumber(p.sku)), 0) + 1;

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

  // ── 6. Upsert in batches ─────────────────────────────────────────────────────
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
  console.log(`\n✓ Done. Ejabali Q2 stock loaded.`);
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
