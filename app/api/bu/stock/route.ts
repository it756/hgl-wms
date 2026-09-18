import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/bu/stock
 *
 * Returns the current stock for the requesting user:
 *   UNIT_STAFF    → only items issued to their specific unit (unit_stock view)
 *   BU_MANAGER    → all SBU-level stock (sbu_stock view, unchanged behaviour)
 *   WAREHOUSE_MANAGER / FINANCE_MANAGER / ADMIN → any SBU via ?sbu_id= query param
 *
 * Optional query params:
 *   ?sbu_id=<uuid>    — filter to a specific SBU (privileged roles only)
 *   ?unit_id=<uuid>   — filter to a specific unit (privileged roles only)
 *   ?search=<text>    — case-insensitive name/SKU filter
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  const privileged = ["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "ADMIN"].includes(role);
  const isUnitStaff = role === "UNIT_STAFF";
  const isBuManager = role === "BU_MANAGER";

  if (!privileged && !isUnitStaff && !isBuManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const searchParam = url.searchParams.get("search") ?? "";
  const sbuIdParam = url.searchParams.get("sbu_id") ?? "";
  const unitIdParam = url.searchParams.get("unit_id") ?? "";

  // ── UNIT_STAFF: show only stock issued to their unit ──────────────────────
  if (isUnitStaff) {
    // Resolve unit_id: JWT metadata first, then profiles table
    let effectiveUnitId: string | null = (user.user_metadata as any)?.unit_id ?? null;
    if (!effectiveUnitId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("unit_id, sbu_id")
        .eq("id", user.id)
        .single();
      effectiveUnitId = profile?.unit_id ?? null;
    }
    if (!effectiveUnitId) {
      return NextResponse.json([], { status: 200 });
    }

    let query = supabaseAdmin
      .from("unit_stock")
      .select(
        "unit_id, sbu_id, product_id, quantity, product_name, sku, unit_of_measure, unit_cost, is_active, unit_name, unit_code, sbu_name, sbu_code",
      )
      .eq("unit_id", effectiveUnitId)
      .order("product_name", { ascending: true });

    if (searchParam) {
      query = query.or(`product_name.ilike.%${searchParam}%,sku.ilike.%${searchParam}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("unit_stock query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  }

  // ── BU_MANAGER / privileged: SBU-level stock ──────────────────────────────
  let effectiveSbuId: string | null = null;

  if (isBuManager) {
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
  } else if (privileged) {
    if (sbuIdParam) {
      effectiveSbuId = sbuIdParam;
    } else {
      effectiveSbuId = (user.user_metadata as any)?.sbu_id ?? null;
      if (!effectiveSbuId) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("sbu_id")
          .eq("id", user.id)
          .single();
        if (profileError) {
          console.error("Failed to fetch profile for fallback sbu_id:", profileError);
          return NextResponse.json({ error: "Unable to determine SBU" }, { status: 500 });
        }
        effectiveSbuId = profile?.sbu_id ?? null;
      }
    }
  }

  // Privileged role with explicit unit_id filter → use unit_stock view
  if (privileged && unitIdParam) {
    let unitQuery = supabaseAdmin
      .from("unit_stock")
      .select(
        "unit_id, sbu_id, product_id, quantity, product_name, sku, unit_of_measure, unit_cost, is_active, unit_name, unit_code, sbu_name, sbu_code",
      )
      .eq("unit_id", unitIdParam)
      .order("product_name", { ascending: true });
    if (searchParam) {
      unitQuery = unitQuery.or(`product_name.ilike.%${searchParam}%,sku.ilike.%${searchParam}%`);
    }
    const { data, error } = await unitQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  // Default: SBU-level stock
  let query = supabaseAdmin
    .from("sbu_stock")
    .select(
      "sbu_id, product_id, quantity, product_name, sku, unit_of_measure, unit_cost, is_active, sbu_name, sbu_code",
    )
    .order("product_name", { ascending: true });

  if (effectiveSbuId) {
    query = query.eq("sbu_id", effectiveSbuId);
  }

  if (searchParam) {
    query = query.or(`product_name.ilike.%${searchParam}%,sku.ilike.%${searchParam}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("sbu_stock query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
