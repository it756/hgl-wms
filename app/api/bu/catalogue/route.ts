import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/bu/catalogue
 *
 * Returns the product catalogue available for an SBU to request.
 * A product is in the SBU's catalogue if it has been:
 *   (a) received via an APPROVED Supplier GRN tagged to this SBU, OR
 *   (b) currently held in the SBU's stock (sbu_stock view).
 *
 * Access rules:
 *   BU_MANAGER / UNIT_STAFF  → always scoped to their own SBU (from user_metadata.sbu_id)
 *   WAREHOUSE_MANAGER / FINANCE_MANAGER / ADMIN → any SBU via ?sbu_id= query param;
 *                                                  if omitted, returns [] (sbu_id is required)
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  const privileged = ["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "ADMIN"].includes(role);
  const sbuScoped = ["BU_MANAGER", "UNIT_STAFF"].includes(role);

  if (!privileged && !sbuScoped) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const sbuIdParam = url.searchParams.get("sbu_id") ?? "";

  // Determine the effective SBU filter
  let effectiveSbuId: string | null = null;

  if (sbuScoped) {
    effectiveSbuId = (user.user_metadata as any)?.sbu_id ?? null;
    if (!effectiveSbuId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("sbu_id")
        .eq("id", user.id)
        .single();
      effectiveSbuId = profile?.sbu_id ?? null;
    }
    if (!effectiveSbuId) {
      return NextResponse.json([], { status: 200 });
    }
  } else if (privileged && sbuIdParam) {
    effectiveSbuId = sbuIdParam;
  } else {
    // Privileged user without sbu_id param — require it explicitly
    return NextResponse.json({ error: "sbu_id query param is required" }, { status: 400 });
  }

  // Query A: products from APPROVED Supplier GRNs tagged to this SBU
  const { data: supplierGrnLines } = await supabaseAdmin
    .from("supplier_grn_line_items")
    .select("product_id, supplier_grns!inner(sbu_id, status)")
    .eq("supplier_grns.sbu_id", effectiveSbuId)
    .eq("supplier_grns.status", "APPROVED");

  const supplierProductIds = new Set<string>(
    (supplierGrnLines ?? []).map((r: any) => r.product_id as string),
  );

  // Query B: products currently held in sbu_stock for this SBU
  const { data: stockItems } = await supabaseAdmin
    .from("sbu_stock")
    .select("product_id")
    .eq("sbu_id", effectiveSbuId);

  const stockProductIds = new Set<string>(
    (stockItems ?? []).map((r: any) => r.product_id as string),
  );

  // Deduplicate
  const allProductIds = [...new Set([...supplierProductIds, ...stockProductIds])];

  if (allProductIds.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // Fetch product details for the catalogue
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, unit_of_measure, unit_cost")
    .in("id", allProductIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("bu/catalogue products query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map unit_of_measure → uom to match the Product interface used on the request form
  const catalogue = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    uom: p.unit_of_measure,
    unit_cost: p.unit_cost ?? null,
  }));

  return NextResponse.json(catalogue);
}
