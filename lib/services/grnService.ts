import { supabaseAdmin } from "../supabaseServer";
import type { GRN, GRNCreateInput } from "../models/grn";
import { writeAuditLog } from "./auditService";
import { createNotification } from "./notificationService";

export async function recordGRN(input: GRNCreateInput, receivedBy: string): Promise<GRN> {
  // Validate the transfer is in ISSUED state
  const { data: tr, error: trError } = await supabaseAdmin
    .from("transfer_requests")
    .select("id, status, sbu_id")
    .eq("id", input.transfer_request_id)
    .single();

  if (trError) throw trError;
  if ((tr as any)?.status !== "ISSUED") {
    throw new Error(
      `GRN can only be submitted for ISSUED transfers. Current status: ${(tr as any)?.status}`,
    );
  }

  // Determine if there's a variance
  const hasVariance = input.items.some(
    (item) => Number(item.quantity_received) !== Number(item.issued_quantity),
  );

  // Insert GRN record
  const { data: grn, error: grnError } = await supabaseAdmin
    .from("grns")
    .insert([
      {
        transfer_request_id: input.transfer_request_id,
        received_by: receivedBy,
        date_received: input.date_received ?? new Date().toISOString().split("T")[0],
        condition_notes: input.condition_notes ?? null,
        has_variance: hasVariance,
        acknowledged: true,
      },
    ])
    .select()
    .single();

  if (grnError) throw grnError;
  const grnId = (grn as any).id;

  // Insert line items
  const lineInserts = input.items.map((item) => ({
    grn_id: grnId,
    product_id: item.product_id,
    issued_quantity: item.issued_quantity,
    quantity_received: item.quantity_received,
    variance_notes: item.variance_notes ?? null,
  }));

  const { error: liError } = await supabaseAdmin.from("grn_line_items").insert(lineInserts);
  if (liError) throw liError;

  // Transition transfer status
  const newStatus = hasVariance ? "COMPLETED_WITH_VARIANCE" : "COMPLETED";
  const { error: statusError } = await supabaseAdmin
    .from("transfer_requests")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", input.transfer_request_id);
  if (statusError) throw statusError;

  // Notify Warehouse Manager if variance
  if (hasVariance) {
    await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "grn_variance",
      message: `GRN submitted with variances for transfer ${input.transfer_request_id}`,
      related_entity_id: grnId,
    });
  }

  // Notify BU Manager GRN is complete
  await createNotification({
    user_role: "BU_MANAGER",
    type: "grn_submitted",
    message: `GRN submitted — transfer is now ${newStatus}`,
    related_entity_id: grnId,
  });

  await writeAuditLog({
    entity_type: "grn",
    entity_id: grnId,
    action: "create",
    performed_by: receivedBy,
    new_value: { transfer_request_id: input.transfer_request_id, has_variance: hasVariance },
  });

  return grn as GRN;
}

export default { recordGRN };
