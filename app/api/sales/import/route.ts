import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../lib/services/auditService";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 2000;

/**
 * POST /api/sales/import
 *
 * Parses an uploaded POS export CSV recording goods sold out of a unit store
 * and inserts them into unit_sales. There is no live POS integration — this
 * is the only way "quantity sold" data enters the system.
 *
 * Accepted formats:
 *   - multipart/form-data with a "file" field containing the CSV
 *   - text/csv raw body
 * Expected columns (header row, case-insensitive): unit_code, product_sku,
 * quantity_sold, unit_price, sale_date (YYYY-MM-DD).
 *
 * Auth: BU_MANAGER (own SBU's units only) | ADMIN (any SBU)
 * Returns: 207 with { batchId, imported, failed, results: [{ row, success, error? }] }
 */
export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (role !== "BU_MANAGER" && role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let csvText = "";
    let fileName: string | null = null;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return NextResponse.json({ error: "file field is required" }, { status: 400 });
      csvText = await file.text();
      fileName = file.name;
    } else {
      csvText = await req.text();
    }
    if (!csvText.trim()) return NextResponse.json({ error: "CSV is empty" }, { status: 400 });

    const parsed = parseCsv(csvText);
    if (parsed.rows.length === 0)
      return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    if (parsed.rows.length > MAX_ROWS)
      return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });

    const headerMap = buildHeaderMap(parsed.headers);
    const unitIdx = headerMap.unit_code;
    const skuIdx = headerMap.product_sku;
    const qtyIdx = headerMap.quantity_sold;
    const priceIdx = headerMap.unit_price;
    const dateIdx = headerMap.sale_date;
    if (
      unitIdx === undefined ||
      skuIdx === undefined ||
      qtyIdx === undefined ||
      dateIdx === undefined
    )
      return NextResponse.json(
        { error: "CSV must include unit_code, product_sku, quantity_sold and sale_date columns" },
        { status: 400 },
      );

    // BU_MANAGER can only import for their own SBU; ADMIN may import for any.
    let callerSbuId: string | null = null;
    if (role === "BU_MANAGER") {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("sbu_id")
        .eq("id", user.id)
        .single();
      if (profileError || !profile?.sbu_id)
        return NextResponse.json(
          { error: "Your account has no SBU assigned. Contact an administrator." },
          { status: 422 },
        );
      callerSbuId = profile.sbu_id;
    }

    let unitsQuery = supabaseAdmin.from("sbu_units").select("id, code, sbu_id, is_active");
    if (callerSbuId) unitsQuery = unitsQuery.eq("sbu_id", callerSbuId);
    const { data: units } = await unitsQuery;
    const unitMap = new Map((units ?? []).map((u: any) => [u.code.toUpperCase(), u]));

    const { data: products } = await supabaseAdmin.from("products").select("id, sku");
    const productMap = new Map((products ?? []).map((p: any) => [p.sku.toUpperCase(), p.id]));

    const results: { row: number; success: boolean; error?: string }[] = [];
    const validInserts: {
      unit_id: string;
      sbu_id: string;
      product_id: string;
      quantity_sold: number;
      unit_price: number;
      sale_date: string;
      imported_by: string;
    }[] = [];

    parsed.rows.forEach((cells, i) => {
      const rowNum = i + 2; // +1 for header, +1 for 1-based index
      const unitCode = (cells[unitIdx] ?? "").trim();
      const sku = (cells[skuIdx] ?? "").trim();
      const qtyRaw = (cells[qtyIdx] ?? "").trim();
      const priceRaw = priceIdx !== undefined ? (cells[priceIdx] ?? "").trim() : "";
      const saleDate = (cells[dateIdx] ?? "").trim();
      if (!unitCode && !sku && !qtyRaw && !saleDate) return; // skip fully blank rows

      const unit = unitMap.get(unitCode.toUpperCase());
      if (!unit) {
        results.push({ row: rowNum, success: false, error: `Unknown unit code: ${unitCode}` });
        return;
      }
      if (!unit.is_active) {
        results.push({ row: rowNum, success: false, error: `Unit ${unitCode} is inactive` });
        return;
      }
      const productId = productMap.get(sku.toUpperCase());
      if (!productId) {
        results.push({ row: rowNum, success: false, error: `Unknown product SKU: ${sku}` });
        return;
      }
      const quantitySold = Number(qtyRaw);
      if (!Number.isFinite(quantitySold) || quantitySold <= 0) {
        results.push({
          row: rowNum,
          success: false,
          error: "quantity_sold must be greater than zero",
        });
        return;
      }
      const unitPrice = Number(priceRaw);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        results.push({ row: rowNum, success: false, error: "unit_price must be zero or greater" });
        return;
      }
      if (!DATE_PATTERN.test(saleDate)) {
        results.push({
          row: rowNum,
          success: false,
          error: "sale_date must be in YYYY-MM-DD format",
        });
        return;
      }

      validInserts.push({
        unit_id: unit.id,
        sbu_id: unit.sbu_id,
        product_id: productId,
        quantity_sold: quantitySold,
        unit_price: unitPrice,
        sale_date: saleDate,
        imported_by: user.id,
      });
      results.push({ row: rowNum, success: true });
    });

    let batchId: string | null = null;
    if (validInserts.length > 0) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from("sales_import_batches")
        .insert([
          {
            sbu_id: callerSbuId,
            file_name: fileName,
            row_count: validInserts.length,
            imported_by: user.id,
          },
        ])
        .select("id")
        .single();
      if (batchError) throw batchError;
      batchId = (batch as any).id;

      const { error: insertError } = await supabaseAdmin
        .from("unit_sales")
        .insert(validInserts.map((row) => ({ ...row, batch_id: batchId })));
      if (insertError) throw insertError;

      await writeAuditLog({
        entity_type: "unit_sales_import",
        entity_id: batchId ?? undefined,
        action: "create",
        performed_by: user.id,
        details: { row_count: validInserts.length, file_name: fileName },
      });
    }

    return NextResponse.json(
      {
        batchId,
        imported: validInserts.length,
        failed: results.length - validInserts.length,
        results,
      },
      { status: 207 },
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
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
  const map: Record<string, number | undefined> = {};
  norm.forEach((h, i) => {
    map[h] = i;
  });
  return map;
}
