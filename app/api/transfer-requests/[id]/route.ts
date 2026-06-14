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
      if (line.requested_quantity > product.stock_quantity)
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}": requested ${line.requested_quantity}, available ${product.stock_quantity}.`,
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

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
