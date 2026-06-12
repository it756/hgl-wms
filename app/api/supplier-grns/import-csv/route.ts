import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * POST /api/supplier-grns/import-csv
 *  Parses an uploaded packing list CSV and matches SKUs to products.
 *  Does NOT create a Supplier GRN — it returns parsed rows for the UI to render
 *  a tick-off form that the WH Manager confirms before submitting POST /api/supplier-grns.
 *
 *  Accepted formats:
 *    - multipart/form-data with a "file" field containing the CSV
 *    - text/csv body (raw CSV)
 *  Expected columns (header row, case-insensitive):
 *    sku, product_name, quantity_expected, unit_cost (optional), expiry_date (optional)
 *
 *  Returns: {
 *    matched:   [{ row, sku, product_id, product_name, quantity_expected, unit_cost?, expiry_date? }],
 *    unmatched: [{ row, sku, product_name, quantity_expected, unit_cost?, expiry_date? }]
 *  }
 *
 *  Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager only" }, { status: 403 });
  }

  // Read CSV text from either multipart "file" or raw body
  let csvText = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file field is required" }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      csvText = await req.text();
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to read CSV: ${e.message}` }, { status: 400 });
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  }

  const parsed = parseCsv(csvText);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
  }

  const headerMap = buildHeaderMap(parsed.headers);
  const skuIdx = headerMap.sku;
  const nameIdx = headerMap.product_name;
  const qtyIdx = headerMap.quantity_expected;
  const costIdx = headerMap.unit_cost;
  const expiryIdx = headerMap.expiry_date;

  if (skuIdx === undefined || qtyIdx === undefined) {
    return NextResponse.json(
      { error: "CSV must include 'sku' and 'quantity_expected' columns" },
      { status: 400 },
    );
  }

  type ParsedRow = {
    row: number;
    sku: string;
    product_name: string | null;
    quantity_expected: number;
    unit_cost: number | null;
    expiry_date: string | null;
  };

  const rows: ParsedRow[] = [];
  const skus: string[] = [];
  parsed.rows.forEach((cells, i) => {
    const sku = (cells[skuIdx] ?? "").trim();
    if (!sku) return;
    const qty = Number((cells[qtyIdx] ?? "").trim());
    if (!Number.isFinite(qty) || qty <= 0) return;
    const cost = costIdx !== undefined ? Number((cells[costIdx] ?? "").trim()) : NaN;
    const expiryRaw = expiryIdx !== undefined ? (cells[expiryIdx] ?? "").trim() : "";

    rows.push({
      row: i + 2, // +1 for header, +1 for 1-based index
      sku,
      product_name: nameIdx !== undefined ? (cells[nameIdx] ?? "").trim() || null : null,
      quantity_expected: qty,
      unit_cost: Number.isFinite(cost) ? cost : null,
      expiry_date: expiryRaw || null,
    });
    skus.push(sku);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV had no usable rows" }, { status: 400 });
  }

  // Look up products by SKU
  const { data: products, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, sku, name, unit_cost")
    .in("sku", [...new Set(skus)]);

  if (prodErr) {
    console.error(prodErr);
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }

  const bySku = new Map<string, any>();
  (products ?? []).forEach((p: any) => bySku.set(p.sku, p));

  const matched: any[] = [];
  const unmatched: any[] = [];
  for (const r of rows) {
    const prod = bySku.get(r.sku);
    if (prod) {
      matched.push({
        row: r.row,
        sku: r.sku,
        product_id: prod.id,
        product_name: prod.name,
        quantity_expected: r.quantity_expected,
        unit_cost: r.unit_cost ?? prod.unit_cost ?? null,
        expiry_date: r.expiry_date,
      });
    } else {
      unmatched.push({
        row: r.row,
        sku: r.sku,
        product_name: r.product_name,
        quantity_expected: r.quantity_expected,
        unit_cost: r.unit_cost,
        expiry_date: r.expiry_date,
      });
    }
  }

  return NextResponse.json({ matched, unmatched });
}

// ─── CSV helpers (RFC 4180-ish; tolerant of quoted cells) ────────────────────

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = splitLines(text);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines
    .slice(1)
    .filter((l) => l.trim().length > 0)
    .map(parseCsvLine);
  return { headers, rows };
}

function splitLines(text: string): string[] {
  // Split while respecting quoted newlines
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      buf += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function buildHeaderMap(headers: string[]): Record<string, number | undefined> {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idxOf = (name: string) => {
    const i = norm.indexOf(name);
    return i === -1 ? undefined : i;
  };
  return {
    sku: idxOf("sku"),
    product_name: idxOf("product_name") ?? idxOf("name"),
    quantity_expected: idxOf("quantity_expected") ?? idxOf("quantity") ?? idxOf("qty"),
    unit_cost: idxOf("unit_cost") ?? idxOf("price") ?? idxOf("cost"),
    expiry_date: idxOf("expiry_date") ?? idxOf("expiry") ?? idxOf("expires"),
  };
}
