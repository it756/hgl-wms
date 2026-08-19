/**
 * seed_labambam_stock.ts
 *
 * Replaces Labambam (LBMB) warehouse stock with data from an Excel file.
 *
 * What it does:
 *   1. Reads the Excel file and auto-detects column layout
 *   2. Upserts the Labambam SBU (code: LBMB)
 *   3. Zeroes out and deactivates every existing LBMB-* product
 *      (is_active=false means the sbu_stock view's sku_tagged CTE ignores them)
 *   4. Deletes any supplier_grns for the LBMB SBU
 *      (removes GRN-seeded stock contributions from the sbu_stock view)
 *   5. Upserts products from the Excel file:
 *        – Matches by name (case-insensitive) to reuse existing LBMB-* SKUs
 *        – Assigns the next LBMB-XXX SKU to genuinely new items
 *
 * Why products.stock_quantity is sufficient:
 *   The sbu_stock view includes a sku_tagged CTE that contributes
 *   products.stock_quantity for every active product whose SKU starts with
 *   'LBMB-'. No GRN or transfer record is needed for BU stock screens to
 *   reflect the balance.
 *
 * Usage:
 *   npx tsx scripts/seed/seed_labambam_stock.ts [path/to/file.xlsx]
 *   npm run seed:labambam:stock
 *
 *   Default Excel path: scripts/seed/labambam_inventory.xlsx
 *   Save the attached "inventory transcription.xlsx" to that path before running.
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_EXCEL_PATH = path.resolve("scripts/seed/labambam_inventory.xlsx");
const LBMB_CODE = "LBMB";
const LBMB_NAME = "Labambam";
const DEFAULT_UOM = "unit";
const DEFAULT_LOCATION = "A1";
const DEFAULT_LOW_STOCK = 1;

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Excel helpers ────────────────────────────────────────────────────────────

/**
 * Find the column index matching any of the given patterns.
 * First tries exact match, then substring match.
 */
function detectColumn(headers: string[], patterns: string[]): number {
  const normalised = headers.map((h) =>
    String(h ?? "")
      .toLowerCase()
      .trim(),
  );
  // Exact match first
  for (const pat of patterns) {
    const idx = normalised.findIndex((h) => h === pat);
    if (idx !== -1) return idx;
  }
  // Substring / contains match
  for (const pat of patterns) {
    const idx = normalised.findIndex((h) => h.includes(pat));
    if (idx !== -1) return idx;
  }
  return -1;
}

const COL_PATTERNS = {
  name: [
    "name",
    "description",
    "item name",
    "item description",
    "item",
    "product",
    "product name",
    "desc",
  ],
  qty: [
    "stock balance",
    "stock qty",
    "stock quantity",
    "balance",
    "qty",
    "quantity",
    "stock",
    "count",
    "amount",
  ],
  uom: ["unit of measure", "unit_of_measure", "uom", "unit", "um", "measure"],
  cost: ["unit cost", "unit_cost", "cost price", "cost", "price", "unit price", "rate"],
  location: [
    "warehouse location",
    "warehouse_location",
    "location",
    "bay",
    "shelf",
    "loc",
    "area",
    "aisle",
  ],
};

/** Normalise a warehouse_location value to [A-Z][1-2]. Falls back to DEFAULT_LOCATION. */
function normaliseLocation(raw: unknown): string {
  if (!raw) return DEFAULT_LOCATION;
  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  // Direct match: already like "E1" or "G2"
  if (/^[A-Z][12]$/.test(s)) return s;
  // Lenient: grab first letter and first digit that is 1 or 2
  const letter = s.match(/[A-Z]/)?.[0];
  const digit = s.match(/[12]/)?.[0];
  if (letter && digit) return `${letter}${digit}`;
  return DEFAULT_LOCATION;
}

/** Parse numeric cell value; returns null if not a valid positive number. */
function parseNumber(val: unknown): number | null {
  const n = parseFloat(String(val ?? ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse integer quantity; returns null if not valid. */
function parseQty(val: unknown): number | null {
  const n = parseNumber(val);
  return n !== null ? Math.round(n) : null;
}

/**
 * Read all data rows from the first worksheet of an Excel file.
 * Returns parsed product rows with detected column mapping.
 */
function parseExcel(filePath: string): ParsedRow[] {
  console.log(`\n[Excel] Reading: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel file contains no sheets.");

  console.log(`  Sheet: "${sheetName}"`);
  const ws = wb.Sheets[sheetName];

  // Convert to array of arrays (raw values)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length === 0) throw new Error("Sheet is empty.");

  // Find the header row — the first row that has at least two non-empty cells
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const nonEmpty = (rows[i] ?? []).filter((c) => c !== null && c !== "");
    if (nonEmpty.length >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
  console.log(`  Headers (row ${headerRowIdx + 1}): [${headers.map((h) => `"${h}"`).join(", ")}]`);

  // Detect column indices
  const colName = detectColumn(headers, COL_PATTERNS.name);
  const colQty = detectColumn(headers, COL_PATTERNS.qty);
  const colUom = detectColumn(headers, COL_PATTERNS.uom);
  const colCost = detectColumn(headers, COL_PATTERNS.cost);
  const colLoc = detectColumn(headers, COL_PATTERNS.location);

  console.log(`\n  Column mapping:`);
  console.log(
    `    Name     → col ${colName >= 0 ? colName : "NOT FOUND"} ${colName >= 0 ? `("${headers[colName]}")` : "(will use col 0)"}`,
  );
  console.log(
    `    Quantity → col ${colQty >= 0 ? colQty : "NOT FOUND"} ${colQty >= 0 ? `("${headers[colQty]}")` : "(will use col 1)"}`,
  );
  console.log(
    `    UOM      → col ${colUom >= 0 ? colUom : "NOT FOUND"} ${colUom >= 0 ? `("${headers[colUom]}")` : `(default: "${DEFAULT_UOM}")`}`,
  );
  console.log(
    `    Cost     → col ${colCost >= 0 ? colCost : "NOT FOUND"} ${colCost >= 0 ? `("${headers[colCost]}")` : "(default: null)"}`,
  );
  console.log(
    `    Location → col ${colLoc >= 0 ? colLoc : "NOT FOUND"} ${colLoc >= 0 ? `("${headers[colLoc]}")` : `(default: "${DEFAULT_LOCATION}")`}`,
  );

  // Use detected indices, falling back to positional guesses
  const nameIdx = colName >= 0 ? colName : 0;
  const qtyIdx = colQty >= 0 ? colQty : 1;

  const parsed: ParsedRow[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawName = String(row[nameIdx] ?? "").trim();
    const rawQty = row[qtyIdx];

    // Skip empty rows and header-like repeat rows
    if (!rawName || rawName.toLowerCase() === "item" || rawName.toLowerCase() === "name") continue;

    const qty = parseQty(rawQty);
    // Skip rows with no valid quantity or with 0 stock
    if (qty === null || qty === 0) continue;

    const rawUom = colUom >= 0 ? String(row[colUom] ?? "").trim() : "";
    const rawCost = colCost >= 0 ? row[colCost] : null;
    const rawLoc = colLoc >= 0 ? row[colLoc] : null;

    parsed.push({
      name: rawName,
      stock_quantity: qty,
      unit_of_measure: rawUom || DEFAULT_UOM,
      unit_cost: parseNumber(rawCost),
      warehouse_location: normaliseLocation(rawLoc),
    });
  }

  console.log(`\n  Parsed ${parsed.length} rows with stock > 0`);
  if (parsed.length > 0) {
    console.log("  First 3 rows:");
    for (const r of parsed.slice(0, 3)) {
      console.log(
        `    "${r.name}" qty=${r.stock_quantity} uom=${r.unit_of_measure} loc=${r.warehouse_location}`,
      );
    }
  }

  return parsed;
}

// ─── SKU helpers ──────────────────────────────────────────────────────────────

/** Extract numeric suffix from "LBMB-042" → 42 */
function skuToNumber(sku: string): number {
  const m = sku.match(/^LBMB-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Format a sequential number as "LBMB-001" */
function formatSku(n: number): string {
  return `${LBMB_CODE}-${String(n).padStart(3, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error(`\n✗ Excel file not found: ${excelPath}`);
    console.error(`  Save the inventory Excel file to that path and re-run.`);
    console.error(
      `  Or pass a custom path: npx tsx scripts/seed/seed_labambam_stock.ts path/to/file.xlsx`,
    );
    process.exit(1);
  }

  // ── Parse Excel ─────────────────────────────────────────────────────────────
  const excelRows = parseExcel(excelPath);
  if (excelRows.length === 0) {
    console.error(
      "\n✗ No valid product rows found in the Excel file. Check the column mapping above.",
    );
    process.exit(1);
  }

  // ── 1. Upsert LBMB SBU ──────────────────────────────────────────────────────
  console.log(`\n[1] Upserting SBU…`);
  const { data: sbuData, error: sbuError } = await supabase
    .from("sbus")
    .upsert({ name: LBMB_NAME, code: LBMB_CODE, is_active: true }, { onConflict: "code" })
    .select("id, code")
    .single();
  if (sbuError) throw sbuError;
  const lbmbId = sbuData.id;
  console.log(`  SBU "${LBMB_NAME}" (${LBMB_CODE}) — id: ${lbmbId}`);

  // ── 2. Load existing LBMB-* products ────────────────────────────────────────
  console.log(`\n[2] Loading existing LBMB products…`);
  const { data: existingProducts, error: existErr } = await supabase
    .from("products")
    .select("id, name, sku, is_active, stock_quantity")
    .like("sku", `${LBMB_CODE}-%`);
  if (existErr) throw existErr;

  const existing = (existingProducts ?? []) as ExistingProduct[];
  console.log(`  Found ${existing.length} existing LBMB-* products`);

  // ── 3. Deactivate + zero out all existing LBMB products ─────────────────────
  if (existing.length > 0) {
    console.log(`\n[3] Deactivating existing LBMB stock…`);
    const { error: zeroErr } = await supabase
      .from("products")
      .update({ stock_quantity: 0, is_active: false, updated_at: new Date().toISOString() })
      .like("sku", `${LBMB_CODE}-%`);
    if (zeroErr) throw zeroErr;
    console.log(`  Zeroed and deactivated ${existing.length} products`);
  } else {
    console.log(`\n[3] No existing LBMB products to deactivate`);
  }

  // ── 4. Delete LBMB supplier GRNs (cascades to line items) ───────────────────
  console.log(`\n[4] Clearing LBMB supplier GRNs…`);

  // Fetch IDs first so we can clear product_price_history, which holds a
  // non-cascading FK to supplier_grns. Without this pre-deletion the DELETE
  // raises FK violation 23503.
  const { data: lbmbGrns, error: grnsLookupErr } = await supabase
    .from("supplier_grns")
    .select("id")
    .eq("sbu_id", lbmbId);
  if (grnsLookupErr) throw grnsLookupErr;

  if (lbmbGrns && lbmbGrns.length > 0) {
    const grnIds = lbmbGrns.map((g) => g.id);

    const { error: pphErr } = await supabase
      .from("product_price_history")
      .delete()
      .in("supplier_grn_id", grnIds);
    if (pphErr) throw pphErr;
    console.log(`  Cleared product_price_history rows for ${grnIds.length} GRN(s)`);
  }

  const { data: grnsDeleted, error: grnErr } = await supabase
    .from("supplier_grns")
    .delete()
    .eq("sbu_id", lbmbId)
    .select("id");
  if (grnErr) throw grnErr;
  console.log(`  Deleted ${(grnsDeleted ?? []).length} supplier GRN(s) (+ their line items)`);

  // ── 5. Build name→SKU map from existing products ─────────────────────────────
  const nameToSku = new Map<string, string>();
  for (const p of existing) {
    nameToSku.set(p.name.toLowerCase().trim(), p.sku);
  }

  // Find the highest existing LBMB SKU number
  let nextSkuNum = existing.reduce((max, p) => Math.max(max, skuToNumber(p.sku)), 0) + 1;

  // ── 6. Build upsert payload ──────────────────────────────────────────────────
  console.log(`\n[5] Building product upserts…`);
  let reused = 0;
  let created = 0;

  const upserts = excelRows.map((row) => {
    const key = row.name.toLowerCase().trim();
    let sku: string;

    if (nameToSku.has(key)) {
      // Reuse the existing SKU so no new UUID is generated
      sku = nameToSku.get(key)!;
      reused++;
    } else {
      sku = formatSku(nextSkuNum++);
      created++;
    }

    // low_stock_threshold: 10% of qty (min 1)
    const low_stock_threshold = Math.max(1, Math.round(row.stock_quantity * 0.1));

    return {
      name: row.name,
      sku,
      unit_of_measure: row.unit_of_measure,
      stock_quantity: row.stock_quantity,
      low_stock_threshold,
      unit_cost: row.unit_cost,
      warehouse_location: row.warehouse_location,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`  ${reused} matched by name (SKU preserved), ${created} new`);

  // ── 7. Upsert products ───────────────────────────────────────────────────────
  console.log(`\n[6] Upserting ${upserts.length} products…`);

  // Batch in groups of 100 to avoid request size limits
  const BATCH = 100;
  let upsertedCount = 0;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH);
    const { data: upsertData, error: upsertErr } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "sku" })
      .select("id");
    if (upsertErr) throw upsertErr;
    upsertedCount += (upsertData ?? []).length;
  }
  console.log(`  Upserted ${upsertedCount} products`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalQty = upserts.reduce((sum, p) => sum + p.stock_quantity, 0);

  console.log(`\n✓ Done. Labambam stock refreshed.`);
  console.log(`  SBU id            : ${lbmbId}`);
  console.log(`  Products upserted : ${upsertedCount}`);
  console.log(`    ↳ matched (name) : ${reused}`);
  console.log(`    ↳ new SKUs       : ${created}`);
  console.log(`  Total units       : ${totalQty.toLocaleString()}`);
  console.log(`\n  Stock is visible in the BU stock screen via the sbu_stock view`);
  console.log(`  (sku_tagged CTE picks up all active LBMB-* products automatically)`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
