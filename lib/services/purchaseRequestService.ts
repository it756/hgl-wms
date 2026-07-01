import { supabaseAdmin } from "../supabaseServer";
import type {
  PurchaseRequest,
  PurchaseRequestCreateInput,
  PurchaseRequestUpdateInput,
  EDITABLE_STATUSES,
} from "../models/purchaseRequest";
import { writeAuditLog } from "./auditService";
import { createNotification } from "./notificationService";
import { createExternalToken, revokeTokensForEntity } from "./externalTokenService";

const EDITABLE: string[] = ["DRAFT", "PROCUREMENT_CHANGES_REQUESTED"];

function generateReference(): string {
  const year = new Date().getFullYear();
  // Combine last 6 ms-timestamp digits with 3 random digits to reduce collision risk
  const ts = (Date.now() % 1000000).toString().padStart(6, "0");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `PR-${year}-${ts}${rand}`;
}

function calcEstimatedTotal(
  lines: { quantity_requested: number; unit_cost?: number }[],
): number | null {
  const total = lines.reduce((sum, l) => sum + l.quantity_requested * (l.unit_cost ?? 0), 0);
  return total > 0 ? total : null;
}

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────
export async function createPurchaseRequest(
  input: PurchaseRequestCreateInput,
  createdBy: string,
): Promise<PurchaseRequest> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("At least one line item is required");
  }

  const reference_number = generateReference();
  const estimated_total = calcEstimatedTotal(input.lines);

  const { data: pr, error: prError } = await supabaseAdmin
    .from("purchase_requests")
    .insert([
      {
        reference_number,
        sbu_id: input.sbu_id,
        created_by: createdBy,
        status: "DRAFT",
        procurement_email: input.procurement_email,
        supplier_name: input.supplier_name ?? null,
        supplier_email: input.supplier_email ?? null,
        notes: input.notes ?? null,
        estimated_total,
      },
    ])
    .select()
    .single();

  if (prError) throw prError;
  const purchaseRequest = pr as PurchaseRequest;

  const lineInserts = input.lines.map((l) => ({
    purchase_request_id: purchaseRequest.id,
    product_id: l.product_id ?? null,
    product_name: l.product_name,
    sku: l.sku ?? null,
    quantity_requested: l.quantity_requested,
    unit_cost: l.unit_cost ?? null,
    unit_of_measure: l.unit_of_measure ?? "units",
    notes: l.notes ?? null,
  }));

  const { error: lineError } = await supabaseAdmin
    .from("purchase_request_line_items")
    .insert(lineInserts);

  if (lineError) {
    // Compensate: delete the purchase request to avoid orphaned rows
    await supabaseAdmin.from("purchase_requests").delete().eq("id", purchaseRequest.id);
    throw lineError;
  }

  await writeAuditLog({
    entity_type: "purchase_request",
    entity_id: purchaseRequest.id,
    action: "CREATED",
    performed_by: createdBy,
    new_value: { reference_number, status: "DRAFT" },
  });

  return purchaseRequest;
}

// ─────────────────────────────────────────────
// Update (only in editable statuses)
// ─────────────────────────────────────────────
export async function updatePurchaseRequest(
  id: string,
  input: PurchaseRequestUpdateInput,
  updatedBy: string,
): Promise<PurchaseRequest> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Purchase request not found");

  const pr = existing as PurchaseRequest;
  if (!EDITABLE.includes(pr.status)) {
    throw new Error(`Purchase request cannot be edited in status: ${pr.status}`);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.procurement_email !== undefined) updates.procurement_email = input.procurement_email;
  if (input.supplier_name !== undefined) updates.supplier_name = input.supplier_name;
  if (input.supplier_email !== undefined) updates.supplier_email = input.supplier_email;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (input.lines) {
    if (input.lines.length === 0) throw new Error("At least one line item is required");

    const estimated_total = calcEstimatedTotal(input.lines);
    updates.estimated_total = estimated_total;

    // Fetch existing lines for compensating rollback on insert failure
    const { data: existingLines } = await supabaseAdmin
      .from("purchase_request_line_items")
      .select("*")
      .eq("purchase_request_id", id);

    // Replace all line items
    await supabaseAdmin.from("purchase_request_line_items").delete().eq("purchase_request_id", id);

    const lineInserts = input.lines.map((l) => ({
      purchase_request_id: id,
      product_id: l.product_id ?? null,
      product_name: l.product_name,
      sku: l.sku ?? null,
      quantity_requested: l.quantity_requested,
      unit_cost: l.unit_cost ?? null,
      unit_of_measure: l.unit_of_measure ?? "units",
      notes: l.notes ?? null,
    }));

    const { error: lineError } = await supabaseAdmin
      .from("purchase_request_line_items")
      .insert(lineInserts);
    if (lineError) {
      // Compensate: restore the previous line items
      if (existingLines?.length) {
        await supabaseAdmin.from("purchase_request_line_items").insert(existingLines);
      }
      throw lineError;
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("purchase_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) throw updateError;

  await writeAuditLog({
    entity_type: "purchase_request",
    entity_id: id,
    action: "UPDATED",
    performed_by: updatedBy,
    previous_value: { status: pr.status },
    new_value: updates as Record<string, unknown>,
  });

  return updated as PurchaseRequest;
}

// ─────────────────────────────────────────────
// Submit to Procurement
// ─────────────────────────────────────────────
export async function submitToProcurement(
  id: string,
  submittedBy: string,
  appBaseUrl: string,
): Promise<{ purchaseRequest: PurchaseRequest; procurementLink: string }> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Purchase request not found");

  const pr = existing as PurchaseRequest;
  if (!EDITABLE.includes(pr.status)) {
    throw new Error(`Cannot submit a purchase request in status: ${pr.status}`);
  }

  // Generate token first — if this fails the purchase request stays editable
  const rawToken = await createExternalToken({
    entityType: "purchase_request",
    entityId: id,
    actorEmail: pr.procurement_email,
    actorType: "PROCUREMENT",
    allowedActions: ["APPROVE", "REJECT", "CHANGES_REQUESTED", "UPLOAD"],
    createdBy: submittedBy,
  });

  // Transition status only after token is ready
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("purchase_requests")
    .update({
      status: "PENDING_PROCUREMENT_APPROVAL",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    // Revoke the dangling token since the status update failed
    await revokeTokensForEntity(id, "purchase_request");
    throw updateError;
  }

  const procurementLink = `${appBaseUrl}/external/procurement/${rawToken}`;

  await writeAuditLog({
    entity_type: "purchase_request",
    entity_id: id,
    action: "SUBMITTED_TO_PROCUREMENT",
    performed_by: submittedBy,
    previous_value: { status: pr.status },
    new_value: { status: "PENDING_PROCUREMENT_APPROVAL" },
  });

  // In-app notification to ADMIN (internal control heads-up that it will arrive)
  await createNotification({
    user_role: "ADMIN",
    type: "purchase_request_submitted",
    message: `Purchase request ${pr.reference_number} has been submitted to procurement for approval.`,
    related_entity_id: id,
  });

  return { purchaseRequest: updated as PurchaseRequest, procurementLink };
}

// ─────────────────────────────────────────────
// Procurement External Action (approve / reject / changes_requested)
// ─────────────────────────────────────────────
export async function applyProcurementAction(
  id: string,
  action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  opts: { notes?: string; documentUrl?: string; actorEmail: string },
): Promise<PurchaseRequest> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Purchase request not found");

  const pr = existing as PurchaseRequest;
  if (pr.status !== "PENDING_PROCUREMENT_APPROVAL") {
    throw new Error(`Purchase request is not awaiting procurement approval. Status: ${pr.status}`);
  }

  let newStatus: string;
  if (action === "APPROVED") newStatus = "PENDING_INTERNAL_CONTROL_APPROVAL";
  else if (action === "REJECTED") newStatus = "REJECTED";
  else newStatus = "PROCUREMENT_CHANGES_REQUESTED";

  // Compare-and-set: update only if the status is still PENDING_PROCUREMENT_APPROVAL
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("purchase_requests")
    .update({
      status: newStatus,
      procurement_actioned_at: new Date().toISOString(),
      procurement_action: action,
      procurement_notes: opts.notes ?? null,
      procurement_document_url: opts.documentUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDING_PROCUREMENT_APPROVAL")
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(
      "Purchase request is not awaiting procurement approval (concurrent modification detected).",
    );
  }

  // Notify internal staff
  if (action === "APPROVED") {
    await createNotification({
      user_role: "ADMIN",
      type: "purchase_request_pending_internal_control",
      message: `Purchase request ${pr.reference_number} was approved by procurement and is awaiting internal control review.`,
      related_entity_id: id,
    });
  } else if (action === "CHANGES_REQUESTED") {
    await createNotification({
      user_id: pr.created_by,
      type: "purchase_request_changes_requested",
      message: `Procurement has requested changes to purchase request ${pr.reference_number}. Please review and resubmit.`,
      related_entity_id: id,
    });
  } else {
    await createNotification({
      user_id: pr.created_by,
      type: "purchase_request_rejected_procurement",
      message: `Purchase request ${pr.reference_number} was rejected by procurement.`,
      related_entity_id: id,
    });
  }

  return updated as PurchaseRequest;
}

// ─────────────────────────────────────────────
// Internal Control Action (Admin)
// ─────────────────────────────────────────────
export async function applyInternalControlAction(
  id: string,
  action: "APPROVED" | "REJECTED",
  opts: { notes?: string; adminId: string },
): Promise<PurchaseRequest> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Purchase request not found");

  const pr = existing as PurchaseRequest;
  if (pr.status !== "PENDING_INTERNAL_CONTROL_APPROVAL") {
    throw new Error(`Purchase request is not awaiting internal control. Status: ${pr.status}`);
  }

  const newStatus = action === "APPROVED" ? "EXPECTED_ORDER" : "INTERNAL_CONTROL_REJECTED";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("purchase_requests")
    .update({
      status: newStatus,
      internal_control_actioned_by: opts.adminId,
      internal_control_actioned_at: new Date().toISOString(),
      internal_control_action: action,
      internal_control_notes: opts.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) throw updateError;

  await writeAuditLog({
    entity_type: "purchase_request",
    entity_id: id,
    action: `INTERNAL_CONTROL_${action}`,
    performed_by: opts.adminId,
    previous_value: { status: pr.status },
    new_value: { status: newStatus },
  });

  if (action === "APPROVED") {
    // Notify warehouse to expect incoming goods
    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "purchase_request_expected_order",
      message: `Purchase request ${pr.reference_number} has been approved. Goods are expected to arrive.`,
      related_entity_id: id,
    });
    // Notify creator
    await createNotification({
      user_id: pr.created_by,
      type: "purchase_request_approved",
      message: `Your purchase request ${pr.reference_number} has been fully approved and is now an expected warehouse order.`,
      related_entity_id: id,
    });
  } else {
    await createNotification({
      user_id: pr.created_by,
      type: "purchase_request_rejected_internal_control",
      message: `Purchase request ${pr.reference_number} was rejected by internal control.`,
      related_entity_id: id,
    });
  }

  return updated as PurchaseRequest;
}
