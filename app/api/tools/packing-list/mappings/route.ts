import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import { getSupplierMapping, saveSupplierMapping } from "../../../../../lib/services/packingListParser";
import type { CanonicalField } from "../../../../../lib/services/packingListParser";
import { CANONICAL_FIELDS } from "../../../../../lib/services/packingListParser";

interface AuthMetadata {
  role?: string;
}

/**
 * GET /api/tools/packing-list/mappings
 * Lists all saved supplier column-mapping rules.
 * Optional: ?supplier_name=<name> to fetch a single supplier's mapping.
 * Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const supplierName = searchParams.get("supplier_name");

  if (supplierName) {
    const mapping = await getSupplierMapping(supplierName);
    if (!mapping) {
      return NextResponse.json({ error: "No mapping found for this supplier" }, { status: 404 });
    }
    return NextResponse.json({ supplier_name: supplierName, column_map: mapping });
  }

  const { data, error } = await supabaseAdmin
    .from("packing_list_mappings")
    .select("id, supplier_name, column_map, created_at, updated_at")
    .order("supplier_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/tools/packing-list/mappings
 * Creates or updates a supplier column-mapping rule (upsert by supplier_name).
 *
 * Body: {
 *   supplier_name: string,
 *   column_map: { [csvHeader]: canonicalField }
 * }
 *
 * Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager or Admin only" }, { status: 403 });
  }

  let body: { supplier_name?: string; column_map?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { supplier_name, column_map } = body;
  if (!supplier_name?.trim()) {
    return NextResponse.json({ error: "supplier_name is required" }, { status: 400 });
  }
  if (!column_map || typeof column_map !== "object" || Object.keys(column_map).length === 0) {
    return NextResponse.json({ error: "column_map must be a non-empty object" }, { status: 400 });
  }

  // Validate all values are canonical fields
  const invalidFields = Object.entries(column_map).filter(
    ([, v]) => !(CANONICAL_FIELDS as readonly string[]).includes(v),
  );
  if (invalidFields.length > 0) {
    return NextResponse.json(
      {
        error: `Invalid canonical field(s): ${invalidFields.map(([k, v]) => `"${k}" → "${v}"`).join(", ")}. ` +
          `Must be one of: ${CANONICAL_FIELDS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    await saveSupplierMapping(
      supplier_name.trim(),
      column_map as Record<string, CanonicalField>,
      user.id,
    );
    return NextResponse.json({ ok: true, supplier_name: supplier_name.trim() }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
