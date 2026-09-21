import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const EDITABLE_STATUSES = ["PENDING", "PENDING_APPROVAL", "PENDING_BU_APPROVAL"];

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    if (role !== "BU_MANAGER" && role !== "UNIT_STAFF")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch existing request
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, status, raised_by, sbu_id, requires_finance_approval")
      .eq("id", id)
      .single();

    if (fetchError || !existing)
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });

    // Only the original requester can edit
    if ((existing as any).raised_by !== user.id)
      return NextResponse.json(
        { error: "Forbidden: you did not raise this request" },
        { status: 403 },
      );

    // Block edits once approved or beyond
    if (!EDITABLE_STATUSES.includes((existing as any).status)) {
      return NextResponse.json(
        { error: "This request can no longer be amended once it has been approved." },
        { status: 422 },
      );
    }

    const body = await req.json();
    const { required_date, notes, lines, estimated_value } = body;

    if (!Array.isArray(lines) || lines.length === 0)
      return NextResponse.json({ error: "No line items" }, { status: 400 });

    if (lines.some((l: any) => !l.destination_unit_id))
      return NextResponse.json(
        { error: "Every line item must have a destination unit selected." },
        { status: 422 },
      );

    const destinationUnitIds = Array.from(
      new Set<string>(lines.map((l: any) => l.destination_unit_id)),
    );
    const { data: unitRows, error: unitCheckError } = await supabaseAdmin
      .from("sbu_units")
      .select("id, sbu_id, is_active")
      .in("id", destinationUnitIds);
    if (unitCheckError) throw unitCheckError;

    const unitMap = new Map((unitRows ?? []).map((u: any) => [u.id, u]));
    for (const unitId of destinationUnitIds) {
      const unit = unitMap.get(unitId);
      if (!unit)
        return NextResponse.json({ error: "Destination unit not found." }, { status: 422 });
      if (unit.sbu_id !== (existing as any).sbu_id)
        return NextResponse.json(
          { error: "Destination unit does not belong to this request's SBU." },
          { status: 422 },
        );
      if (!unit.is_active)
        return NextResponse.json({ error: "Destination unit is inactive." }, { status: 422 });
    }

    // Validate stock for each line
    const productIds: string[] = lines.map((l: any) => l.product_id);
    const { data: products, error: stockError } = await supabaseAdmin
      .from("products")
      .select("id, name, stock_quantity")
      .in("id", productIds);
    if (stockError) throw stockError;

    const stockMap = new Map<string, { name: string; stock_quantity: number }>(
      (products ?? []).map((p: any) => [p.id, { name: p.name, stock_quantity: p.stock_quantity }]),
    );

    for (const line of lines) {
      const product = stockMap.get(line.product_id);
      if (!product)
        return NextResponse.json(
          { error: `Product ${line.product_id} not found.` },
          { status: 422 },
        );
      if (line.requested_quantity <= 0)
        return NextResponse.json(
          { error: `Requested quantity for "${product.name}" must be greater than zero.` },
          { status: 422 },
        );
    }

    // The same product can target several destinations, so check the sum
    // requested across all lines against available stock, not each line alone.
    const requestedTotalsByProduct = new Map<string, number>();
    for (const line of lines) {
      requestedTotalsByProduct.set(
        line.product_id,
        (requestedTotalsByProduct.get(line.product_id) ?? 0) + line.requested_quantity,
      );
    }
    for (const [productId, totalRequested] of requestedTotalsByProduct) {
      const product = stockMap.get(productId)!;
      if (totalRequested > product.stock_quantity)
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}": requested ${totalRequested} across destinations, available ${product.stock_quantity}.`,
          },
          { status: 422 },
        );
    }

    // Update the request header
    const { error: updateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        required_date: required_date || null,
        notes: notes || null,
        estimated_value: estimated_value ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) throw updateError;

    // Replace line items: delete existing, insert new
    const { error: deleteError } = await supabaseAdmin
      .from("transfer_line_items")
      .delete()
      .eq("transfer_request_id", id);
    if (deleteError) throw deleteError;

    const lineInserts = lines.map((l: any) => ({
      transfer_request_id: id,
      product_id: l.product_id,
      requested_quantity: l.requested_quantity,
      destination_unit_id: l.destination_unit_id,
    }));
    const { error: insertError } = await supabaseAdmin
      .from("transfer_line_items")
      .insert(lineInserts);
    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (user.user_metadata as any)?.role || "";
    const sbuId = (user.user_metadata as any)?.sbu_id || null;

    const { data, error } = await supabaseAdmin
      .from("transfer_requests")
      .select(
        "*, sbus(id, name), transfer_line_items(*, products(id, name, sku, stock_quantity, unit_of_measure, unit_cost))",
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // BU_MANAGER and UNIT_STAFF can only view requests from their own SBU
    if (
      (role === "BU_MANAGER" || role === "UNIT_STAFF") &&
      sbuId &&
      (data as any).sbu_id !== sbuId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Stitch requesting + per-line destination unit info manually — PostgREST
    // schema cache can lag on newly added FKs so we avoid the embed hint.
    const unitIds = new Set<string>();
    if ((data as any).requesting_unit_id) unitIds.add((data as any).requesting_unit_id);
    for (const line of (data as any).transfer_line_items ?? []) {
      if (line.destination_unit_id) unitIds.add(line.destination_unit_id);
    }

    let unitMap: Record<string, { id: string; name: string; code: string }> = {};
    if (unitIds.size > 0) {
      const { data: units, error: unitsError } = await supabaseAdmin
        .from("sbu_units")
        .select("id, name, code")
        .in("id", Array.from(unitIds));
      if (unitsError) throw unitsError;
      unitMap = Object.fromEntries((units ?? []).map((u: any) => [u.id, u]));
    }

    (data as any).sbu_units = unitMap[(data as any).requesting_unit_id] ?? null;
    (data as any).transfer_line_items = ((data as any).transfer_line_items ?? []).map(
      (line: any) => ({
        ...line,
        destination_unit: line.destination_unit_id
          ? (unitMap[line.destination_unit_id] ?? null)
          : null,
      }),
    );

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
