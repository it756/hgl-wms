import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/** GET /api/admin/products — all roles can read; write requires ADMIN/WH_MANAGER */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? "";
  const activeOnly = url.searchParams.get("active_only") !== "false";
  const sbuId = url.searchParams.get("sbu_id") ?? "";

  let query = supabaseAdmin.from("products").select("*").order("name", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);
  if (search) query = query.ilike("name", `%${search}%`);

  if (sbuId) {
    // Find all transfer requests for this SBU, then get the product IDs from their line items
    const { data: requests } = await supabaseAdmin
      .from("transfer_requests")
      .select("id")
      .eq("sbu_id", sbuId);

    const requestIds = (requests ?? []).map((r) => r.id);

    if (requestIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: lineItems } = await supabaseAdmin
      .from("transfer_line_items")
      .select("product_id")
      .in("transfer_request_id", requestIds);

    const productIds = [...new Set((lineItems ?? []).map((li) => li.product_id))];

    if (productIds.length === 0) {
      return NextResponse.json([]);
    }

    query = query.in("id", productIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/admin/products — ADMIN or WAREHOUSE_MANAGER only */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    sku,
    description,
    unit_of_measure,
    stock_quantity,
    low_stock_threshold,
    unit_cost,
    warehouse_location,
  } = body;

  if (!name || !sku) {
    return NextResponse.json({ error: "name and sku are required" }, { status: 400 });
  }

  if (!warehouse_location || !/^[A-Z][12]$/.test(warehouse_location)) {
    return NextResponse.json(
      {
        error:
          "warehouse_location is required and must be a letter A-Z followed by 1 or 2 (e.g. A1, B2)",
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      name,
      sku,
      description: description ?? null,
      unit_of_measure: unit_of_measure ?? "unit",
      stock_quantity: stock_quantity ?? 0,
      low_stock_threshold: low_stock_threshold ?? 0,
      unit_cost: unit_cost ?? null,
      warehouse_location,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
