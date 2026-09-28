import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const ALLOWED_ROLES = ["BU_MANAGER", "FINANCE_MANAGER", "WAREHOUSE_MANAGER", "ADMIN"];

interface ReportRow {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  sbu_id: string;
  sbu_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_issued_period: number;
  quantity_sold_period: number;
  amount_sold_period: number;
  balance: number;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/reports/quantity-issued
 *
 * Per (unit, product): quantity received by the unit in the period ("quantity
 * issued" from the BU Manager's point of view), quantity sold in the period,
 * the sale amount for the period (quantity_sold × price captured at time of
 * sale), and the current on-hand balance (cumulative received − cumulative
 * sold, as of `to`). The frontend picks which columns to show per role.
 *
 * Query params:
 *   ?from=YYYY-MM-DD   — period start (defaults to no lower bound)
 *   ?to=YYYY-MM-DD      — period end (defaults to today)
 *   ?sbu_id=<uuid>      — privileged roles only; BU_MANAGER is forced to own SBU
 *   ?unit_id=<uuid>     — drill down to a single unit
 *   ?product_id=<uuid>  — filter to a single product
 *   ?format=csv         — return a CSV download instead of JSON
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (!ALLOWED_ROLES.includes(role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const from = url.searchParams.get("from") || null;
    const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
    const unitIdParam = url.searchParams.get("unit_id");
    const productIdParam = url.searchParams.get("product_id");
    const format = url.searchParams.get("format");
    let sbuIdParam = url.searchParams.get("sbu_id");

    // BU_MANAGER is always scoped to their own SBU, ignoring any sbu_id param.
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
      sbuIdParam = profile.sbu_id;
    }

    // Resolve which sbu_units are in scope for this request.
    let unitsQuery = supabaseAdmin.from("sbu_units").select("id, name, code, sbu_id, sbus(name)");
    if (unitIdParam) unitsQuery = unitsQuery.eq("id", unitIdParam);
    else if (sbuIdParam) unitsQuery = unitsQuery.eq("sbu_id", sbuIdParam);
    const { data: unitsInScope, error: unitsError } = await unitsQuery;
    if (unitsError) throw unitsError;

    const unitMap = new Map(
      (unitsInScope ?? []).map((u: any) => [
        u.id,
        { name: u.name, code: u.code, sbu_id: u.sbu_id, sbu_name: u.sbus?.name ?? "" },
      ]),
    );
    const scopedUnitIds = (unitsInScope ?? []).map((u: any) => u.id);

    // Nothing in scope (e.g. unit_id from another SBU on a BU_MANAGER query).
    if ((unitIdParam || sbuIdParam) && scopedUnitIds.length === 0) {
      return NextResponse.json([]);
    }

    let receivedQuery = supabaseAdmin
      .from("grn_line_items")
      .select("product_id, quantity_received, grns!inner(unit_id, date_received)")
      .lte("grns.date_received", to);
    if (productIdParam) receivedQuery = receivedQuery.eq("product_id", productIdParam);
    if (scopedUnitIds.length > 0) receivedQuery = receivedQuery.in("grns.unit_id", scopedUnitIds);

    let soldQuery = supabaseAdmin
      .from("unit_sales")
      .select("unit_id, product_id, quantity_sold, unit_price, sale_date")
      .lte("sale_date", to);
    if (productIdParam) soldQuery = soldQuery.eq("product_id", productIdParam);
    if (scopedUnitIds.length > 0) soldQuery = soldQuery.in("unit_id", scopedUnitIds);

    const [{ data: receivedRows, error: receivedError }, { data: soldRows, error: soldError }] =
      await Promise.all([receivedQuery, soldQuery]);
    if (receivedError) throw receivedError;
    if (soldError) throw soldError;

    type Agg = {
      unit_id: string;
      product_id: string;
      received_to_date: number;
      received_period: number;
      sold_to_date: number;
      sold_period: number;
      amount_period: number;
    };
    const aggMap = new Map<string, Agg>();
    const key = (unitId: string, productId: string) => `${unitId}:${productId}`;

    for (const row of receivedRows ?? []) {
      const unitId = (row as any).grns.unit_id as string;
      const dateReceived = (row as any).grns.date_received as string;
      const k = key(unitId, row.product_id);
      const entry = aggMap.get(k) ?? {
        unit_id: unitId,
        product_id: row.product_id,
        received_to_date: 0,
        received_period: 0,
        sold_to_date: 0,
        sold_period: 0,
        amount_period: 0,
      };
      entry.received_to_date += row.quantity_received;
      if (!from || dateReceived >= from) entry.received_period += row.quantity_received;
      aggMap.set(k, entry);
    }

    for (const row of soldRows ?? []) {
      const k = key(row.unit_id, row.product_id);
      const entry = aggMap.get(k) ?? {
        unit_id: row.unit_id,
        product_id: row.product_id,
        received_to_date: 0,
        received_period: 0,
        sold_to_date: 0,
        sold_period: 0,
        amount_period: 0,
      };
      entry.sold_to_date += row.quantity_sold;
      if (!from || row.sale_date >= from) {
        entry.sold_period += row.quantity_sold;
        entry.amount_period += row.quantity_sold * Number(row.unit_price);
      }
      aggMap.set(k, entry);
    }

    const productIds = Array.from(new Set(Array.from(aggMap.values()).map((a) => a.product_id)));
    const { data: productRows, error: productsError } =
      productIds.length > 0
        ? await supabaseAdmin.from("products").select("id, name, sku").in("id", productIds)
        : { data: [], error: null };
    if (productsError) throw productsError;
    const productMap = new Map((productRows ?? []).map((p: any) => [p.id, p]));

    const rows: ReportRow[] = Array.from(aggMap.values())
      .filter((a) => unitMap.has(a.unit_id))
      .map((a) => {
        const unit = unitMap.get(a.unit_id)!;
        const product = productMap.get(a.product_id);
        return {
          unit_id: a.unit_id,
          unit_name: unit.name,
          unit_code: unit.code,
          sbu_id: unit.sbu_id,
          sbu_name: unit.sbu_name,
          product_id: a.product_id,
          product_name: product?.name ?? `Product ${a.product_id}`,
          sku: product?.sku ?? "",
          quantity_issued_period: a.received_period,
          quantity_sold_period: a.sold_period,
          amount_sold_period: Math.round(a.amount_period * 100) / 100,
          balance: a.received_to_date - a.sold_to_date,
        };
      })
      .sort(
        (a, b) =>
          a.unit_name.localeCompare(b.unit_name) || a.product_name.localeCompare(b.product_name),
      );

    if (format === "csv") {
      const header = [
        "Unit",
        "Unit Code",
        "SBU",
        "Product",
        "SKU",
        "Quantity Issued (Period)",
        "Quantity Sold (Period)",
        "Amount Sold (Period)",
        "Balance",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.unit_name,
            r.unit_code,
            r.sbu_name,
            r.product_name,
            r.sku,
            r.quantity_issued_period,
            r.quantity_sold_period,
            r.amount_sold_period,
            r.balance,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="quantity-issued-report.csv"`,
        },
      });
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
