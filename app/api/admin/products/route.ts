import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import { createNotification } from "../../../../lib/services/notificationService";
import { writeAuditLog } from "../../../../lib/services/auditService";

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
    // Look up the SBU code so we can match SKU-prefixed products
    const { data: sbu, error: sbuError } = await supabaseAdmin
      .from("sbus")
      .select("code")
      .eq("id", sbuId)
      .single();

    if (sbuError) {
      return NextResponse.json({ error: sbuError.message }, { status: 500 });
    }
    if (!sbu) {
      return NextResponse.json({ error: "SBU not found" }, { status: 404 });
    }

    const skuPrefix = sbu?.code ? `${sbu.code}-%` : null;

    // Products explicitly in this SBU's transfer line items
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from("transfer_requests")
      .select("id")
      .eq("sbu_id", sbuId);

    if (requestsError) {
      console.error("Failed to fetch transfer_requests for sbu_id", sbuId, requestsError);
      return NextResponse.json({ error: requestsError.message }, { status: 500 });
    }

    const requestIds = (requests ?? []).map((r: any) => r.id);
    let transferProductIds: string[] = [];

    if (requestIds.length > 0) {
      const { data: lineItems, error: lineItemsError } = await supabaseAdmin
        .from("transfer_line_items")
        .select("product_id")
        .in("transfer_request_id", requestIds);

      if (lineItemsError) {
        console.error("Failed to fetch transfer_line_items", lineItemsError);
        return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
      }

      transferProductIds = [...new Set((lineItems ?? []).map((li: any) => li.product_id))];
    }

    // Products from approved supplier GRNs tagged to this SBU
    const { data: sgrns, error: sgrnsError } = await supabaseAdmin
      .from("supplier_grns")
      .select("id")
      .eq("sbu_id", sbuId)
      .eq("status", "GRN_APPROVED");

    if (sgrnsError) {
      console.error("Failed to fetch supplier_grns for sbu_id", sbuId, sgrnsError);
      return NextResponse.json({ error: sgrnsError.message }, { status: 500 });
    }

    const sgrnIds = (sgrns ?? []).map((r: any) => r.id);
    let grnProductIds: string[] = [];

    if (sgrnIds.length > 0) {
      const { data: grnLines, error: grnLinesError } = await supabaseAdmin
        .from("supplier_grn_line_items")
        .select("product_id")
        .in("supplier_grn_id", sgrnIds);

      if (grnLinesError) {
        console.error("Failed to fetch supplier_grn_line_items", grnLinesError);
        return NextResponse.json({ error: grnLinesError.message }, { status: 500 });
      }

      grnProductIds = [...new Set((grnLines ?? []).map((li: any) => li.product_id))];
    }

    const explicitIds = [...new Set([...transferProductIds, ...grnProductIds])];

    if (skuPrefix) {
      // Return SKU-tagged products OR explicitly linked products
      const { data: skuProducts, error: skuErr } = await query.or(
        explicitIds.length > 0
          ? `sku.ilike.${skuPrefix},id.in.(${explicitIds.join(",")})`
          : `sku.ilike.${skuPrefix}`,
      );
      if (skuErr) return NextResponse.json({ error: skuErr.message }, { status: 500 });
      return NextResponse.json(skuProducts ?? []);
    }

    if (explicitIds.length === 0) {
      return NextResponse.json([]);
    }

    query = query.in("id", explicitIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/admin/products — ADMIN, WAREHOUSE_MANAGER, BU_MANAGER, FINANCE_MANAGER */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER", "BU_MANAGER", "FINANCE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    sku,
    description,
    unit_of_measure,
    initial_quantity,
    stock_quantity,
    low_stock_threshold,
    unit_cost,
    warehouse_location,
    sbu_id: bodySbuId,
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

  // For SBU-scoped roles, resolve the SBU and auto-prefix the SKU
  let finalSku = sku as string;
  let resolvedSbuId: string | null = null;
  let resolvedSbuName: string | null = null;

  if (role === "BU_MANAGER" || role === "FINANCE_MANAGER") {
    if (role === "FINANCE_MANAGER") {
      if (!bodySbuId) {
        return NextResponse.json(
          { error: "sbu_id is required for Finance Manager" },
          { status: 400 },
        );
      }
      resolvedSbuId = bodySbuId;
    } else {
      // BU_MANAGER: derive SBU from user metadata then profile
      resolvedSbuId = (user.user_metadata as any)?.sbu_id ?? null;
      if (!resolvedSbuId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("sbu_id")
          .eq("id", user.id)
          .single();
        resolvedSbuId = profile?.sbu_id ?? null;
      }
      if (!resolvedSbuId) {
        return NextResponse.json(
          { error: "Could not resolve your SBU. Contact an administrator." },
          { status: 400 },
        );
      }
    }

    // Fetch SBU code + name for SKU prefix and notification
    const { data: sbu, error: sbuErr } = await supabaseAdmin
      .from("sbus")
      .select("code, name")
      .eq("id", resolvedSbuId)
      .single();

    if (sbuErr || !sbu) {
      return NextResponse.json({ error: "SBU not found" }, { status: 404 });
    }

    resolvedSbuName = sbu.name;
    const prefix = `${sbu.code}-`;
    if (!finalSku.startsWith(prefix)) {
      finalSku = `${prefix}${finalSku}`;
    }
  }

  // Resolve initial stock quantity (initial_quantity takes precedence; fall back to stock_quantity for backward compat)
  const resolvedQty = initial_quantity != null ? Number(initial_quantity) : (stock_quantity ?? 0);

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      name,
      sku: finalSku,
      description: description ?? null,
      unit_of_measure: unit_of_measure ?? "unit",
      stock_quantity: resolvedQty,
      low_stock_threshold: low_stock_threshold ?? 0,
      unit_cost: unit_cost ?? null,
      warehouse_location,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For SBU-scoped roles: audit log + notify Warehouse Manager
  if (role === "BU_MANAGER" || role === "FINANCE_MANAGER") {
    const actorName = (user.user_metadata as any)?.full_name ?? user.email ?? "Unknown user";

    if (resolvedQty > 0) {
      await writeAuditLog({
        entity_type: "product",
        entity_id: data.id,
        action: "product_created",
        performed_by: user.id,
        details: { initial_quantity: resolvedQty, sbu_id: resolvedSbuId, sku: finalSku },
      });
    }

    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "new_product_created",
      subject: "New product added to catalogue",
      message: `${actorName} added "${name}" (SKU: ${finalSku}) with an initial stock of ${resolvedQty} units for ${resolvedSbuName}.`,
      related_entity_id: data.id,
      dispatchChannels: true,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
