/**
 * lib/services/packingListParser.ts
 *
 * CSV-first packing-list parser for the Supplier GRN workflow.
 *
 * Flow:
 *   1. Accept CSV text (CSV only — all other formats are rejected at the API layer).
 *   2. Parse headers; apply a saved per-supplier column-mapping rule if one exists.
 *      If no mapping is found, attempt automatic header matching against canonical names.
 *   3. Validate each row against the GRN line-item schema.
 *   4. Return parsed rows (valid) and review rows (failed validation).
 *
 * Canonical GRN fields:
 *   product_code | description | quantity | unit | batch_number | expiry_date | weight | notes
 */

import { supabaseAdmin } from "../supabaseServer";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export const CANONICAL_FIELDS = [
  "product_code",
  "description",
  "quantity",
  "unit",
  "batch_number",
  "expiry_date",
  "weight",
  "notes",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** A fully validated GRN line parsed from the packing list. */
export interface ParsedGrnLine {
  row: number;
  product_code: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  batch_number: string | null;
  expiry_date: string | null; // ISO date string YYYY-MM-DD or null
  weight: number | null;
  notes: string | null;
}

/** A row that failed validation — returned for manual review. */
export interface ReviewRow {
  row: number;
  raw: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  parsed: ParsedGrnLine[];
  review: ReviewRow[];
  headers: string[];
  mapping_used: Record<string, CanonicalField> | null;
}

// ─────────────────────────────────────────────
// Automatic header matching
// ─────────────────────────────────────────────

/** Aliases used in automatic header matching (lowercase). */
const HEADER_ALIASES: Record<string, CanonicalField> = {
  // product_code
  "product_code": "product_code",
  "product code": "product_code",
  "item code": "product_code",
  "item_code": "product_code",
  "sku": "product_code",
  "code": "product_code",
  "part number": "product_code",
  "part_number": "product_code",
  // description
  "description": "description",
  "product name": "description",
  "product_name": "description",
  "item": "description",
  "name": "description",
  "item description": "description",
  // quantity
  "quantity": "quantity",
  "qty": "quantity",
  "quantity_received": "quantity",
  "quantity received": "quantity",
  "quantity_expected": "quantity",
  "quantity expected": "quantity",
  "units": "quantity",
  // unit
  "unit": "unit",
  "uom": "unit",
  "unit of measure": "unit",
  "unit_of_measure": "unit",
  "measure": "unit",
  // batch_number
  "batch_number": "batch_number",
  "batch number": "batch_number",
  "batch": "batch_number",
  "lot number": "batch_number",
  "lot_number": "batch_number",
  "lot": "batch_number",
  // expiry_date
  "expiry_date": "expiry_date",
  "expiry date": "expiry_date",
  "expiry": "expiry_date",
  "exp date": "expiry_date",
  "exp_date": "expiry_date",
  "expiration date": "expiry_date",
  "best before": "expiry_date",
  // weight
  "weight": "weight",
  "net weight": "weight",
  "gross weight": "weight",
  // notes
  "notes": "notes",
  "comments": "notes",
  "remarks": "notes",
};

function autoMapHeaders(headers: string[]): Record<string, CanonicalField> {
  const result: Record<string, CanonicalField> = {};
  for (const header of headers) {
    const canonical = HEADER_ALIASES[header.toLowerCase().trim()];
    if (canonical) result[header] = canonical;
  }
  return result;
}

// ─────────────────────────────────────────────
// CSV parser (no external dependencies)
// ─────────────────────────────────────────────

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

// ─────────────────────────────────────────────
// Date normalisation
// ─────────────────────────────────────────────

/** Attempt to parse a variety of date formats into YYYY-MM-DD. */
function normaliseDate(raw: string): string | null {
  if (!raw.trim()) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // MM/DD/YYYY
  const mdyMatch = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const parsed = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(parsed.getTime())) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try native Date parse as last resort
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

// ─────────────────────────────────────────────
// Row validator
// ─────────────────────────────────────────────

function validateRow(
  rowIndex: number,
  raw: Record<string, string>,
  mapping: Record<string, CanonicalField>,
): { line: ParsedGrnLine | null; errors: string[] } {
  const get = (field: CanonicalField): string => {
    const csvHeader = Object.entries(mapping).find(([, v]) => v === field)?.[0];
    return csvHeader ? (raw[csvHeader] ?? "").trim() : "";
  };

  const errors: string[] = [];

  const rawQty = get("quantity");
  const quantity = parseFloat(rawQty);
  if (!rawQty || isNaN(quantity) || quantity <= 0) {
    errors.push(`Row ${rowIndex}: quantity must be a positive number (got "${rawQty}")`);
  }

  const rawExpiry = get("expiry_date");
  let expiryDate: string | null = null;
  if (rawExpiry) {
    expiryDate = normaliseDate(rawExpiry);
    if (!expiryDate) {
      errors.push(`Row ${rowIndex}: could not parse expiry_date "${rawExpiry}"`);
    }
  }

  const rawWeight = get("weight");
  let weight: number | null = null;
  if (rawWeight) {
    weight = parseFloat(rawWeight);
    if (isNaN(weight)) {
      errors.push(`Row ${rowIndex}: weight must be a number (got "${rawWeight}")`);
    }
  }

  if (errors.length > 0) return { line: null, errors };

  return {
    line: {
      row: rowIndex,
      product_code: get("product_code") || null,
      description: get("description") || null,
      quantity,
      unit: get("unit") || null,
      batch_number: get("batch_number") || null,
      expiry_date: expiryDate,
      weight,
      notes: get("notes") || null,
    },
    errors: [],
  };
}

// ─────────────────────────────────────────────
// Fetch saved supplier mapping
// ─────────────────────────────────────────────

export async function getSupplierMapping(
  supplierName: string,
): Promise<Record<string, CanonicalField> | null> {
  const { data, error } = await supabaseAdmin
    .from("packing_list_mappings")
    .select("column_map")
    .eq("supplier_name", supplierName)
    .single();

  if (error || !data) return null;
  return (data as any).column_map as Record<string, CanonicalField>;
}

export async function saveSupplierMapping(
  supplierName: string,
  columnMap: Record<string, CanonicalField>,
  performedBy: string,
): Promise<void> {
  await supabaseAdmin.from("packing_list_mappings").upsert(
    {
      supplier_name: supplierName,
      column_map: columnMap,
      updated_by: performedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_name" },
  );
}

// ─────────────────────────────────────────────
// Main parse function
// ─────────────────────────────────────────────

export async function parsePackingListCsv(
  csvText: string,
  supplierName?: string,
): Promise<ParseResult> {
  const { headers, rows } = parseCsvText(csvText);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error("CSV is empty or has no data rows");
  }

  // Resolve mapping: saved supplier rule → auto-match → error
  let mapping: Record<string, CanonicalField> | null = null;

  if (supplierName) {
    mapping = await getSupplierMapping(supplierName);
  }

  if (!mapping) {
    // Auto-match headers
    mapping = autoMapHeaders(headers);
  }

  // Must at minimum map quantity
  const mappedFields = new Set(Object.values(mapping));
  if (!mappedFields.has("quantity")) {
    throw new Error(
      "Could not determine which column contains quantity. " +
        "Please save a column-mapping rule for this supplier.",
    );
  }

  const parsed: ParsedGrnLine[] = [];
  const review: ReviewRow[] = [];

  rows.forEach((raw, idx) => {
    const { line, errors } = validateRow(idx + 2, raw, mapping!); // +2 for header row
    if (line) {
      parsed.push(line);
    } else {
      review.push({ row: idx + 2, raw, errors });
    }
  });

  return { parsed, review, headers, mapping_used: mapping };
}
