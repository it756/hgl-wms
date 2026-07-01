import { NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "../../../../../lib/supabaseServer";
import { submitToProcurement } from "../../../../../lib/services/purchaseRequestService";
import { sendProcurementReviewEmail } from "../../../../../lib/email/templates/purchaseRequestTemplates";

interface AuthMetadata {
  role?: string;
}

interface PurchaseRequestRow {
  id: string;
  reference_number: string;
  sbu_id: string;
  created_by: string;
  status: string;
  supplier_name: string | null;
  notes: string | null;
  estimated_total: number | null;
  procurement_email: string;
  sbus: { name: string } | null;
  purchase_request_line_items: {
    product_name: string;
    sku: string | null;
    quantity_requested: number;
    unit_of_measure: string;
    unit_cost: number | null;
  }[];
}

/**
 * POST /api/purchase-requests/[id]/submit
 * SBU_MANAGER submits a DRAFT or PROCUREMENT_CHANGES_REQUESTED purchase request to procurement.
 * Generates a secure external token link and emails procurement.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (role !== "BU_MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: BU Manager only" }, { status: 403 });
  }

  // Verify ownership for BU_MANAGER
  if (role === "BU_MANAGER") {
    const { data: existing } = await supabaseAdmin
      .from("purchase_requests")
      .select("created_by")
      .eq("id", id)
      .single();
    if (!existing)
      return NextResponse.json({ error: "Purchase request not found" }, { status: 404 });
    if ((existing as { created_by: string }).created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden: not the owner" }, { status: 403 });
    }
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { purchaseRequest, procurementLink } = await submitToProcurement(id, user.id, appBaseUrl);

    // Fetch enriched data for the email — best-effort, don't fail the submission
    try {
      const { data: enriched } = await supabaseAdmin
        .from("purchase_requests")
        .select(
          `reference_number, supplier_name, notes, estimated_total, procurement_email,
         sbus(name),
         purchase_request_line_items(product_name, sku, quantity_requested, unit_of_measure, unit_cost)`,
        )
        .eq("id", id)
        .single();

      if (enriched) {
        const row = enriched as unknown as PurchaseRequestRow;
        await sendProcurementReviewEmail(row.procurement_email, {
          reference: row.reference_number,
          sbuName: row.sbus?.name ?? "Unknown SBU",
          supplierName: row.supplier_name,
          notes: row.notes,
          estimatedTotal: row.estimated_total,
          lines: row.purchase_request_line_items ?? [],
          reviewLink: procurementLink,
          expiryDays: 7,
        });
      }
    } catch (emailErr) {
      console.error("[submit] procurement review email failed", emailErr);
    }

    return NextResponse.json({
      id: purchaseRequest.id,
      reference_number: purchaseRequest.reference_number,
      status: purchaseRequest.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Cannot submit")
      ? 409
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
