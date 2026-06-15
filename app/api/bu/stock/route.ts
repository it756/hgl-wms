import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

/**
 * GET /api/bu/stock
 *
 * Returns the current stock held by an SBU (net issued minus returned).
 *
 * Access rules:
 *   BU_MANAGER / UNIT_STAFF  → their own SBU only (from user_metadata.sbu_id)
 *   WAREHOUSE_MANAGER / FINANCE_MANAGER / ADMIN → any SBU via ?sbu_id= query param;
 *                                                  if omitted, returns all SBUs.
 *
 * Optional query params:
 *   ?sbu_id=<uuid>   — filter to a specific SBU (privileged roles only)
 *   ?search=<text>   — case-insensitive name/SKU filter
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
  const searchParam = url.searchParams.get("search") ?? "";
  const sbuIdParam = url.searchParams.get("sbu_id") ?? "";

  // Determine the effective SBU filter
  let effectiveSbuId: string | null = null;

  if (sbuScoped) {
    // Non-privileged users are always scoped to their own SBU.
    // Prefer user_metadata (fast, in JWT), fall back to profiles table (source of truth).
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
      // User has no SBU assigned — return empty stock list
      return NextResponse.json([], { status: 200 });
    }
  } else if (privileged) {
    if (sbuIdParam) {
      // Explicit filter takes precedence
      effectiveSbuId = sbuIdParam;
    } else {
      // Fall back to the admin's own SBU assignment if present
      effectiveSbuId = (user.user_metadata as any)?.sbu_id ?? null;
    }
  }
  // If privileged, no sbu_id param, and no sbu_id in metadata → return all SBUs

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
