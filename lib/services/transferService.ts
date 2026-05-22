import { supabaseAdmin } from "../supabaseServer";
import type { TransferRequest, TransferRequestCreateInput } from "../models/transferRequest";
import { writeAuditLog } from "./auditService";
import { createNotification } from "./notificationService";

const FINANCE_THRESHOLD_KEY = "finance_approval_threshold";

async function getFinanceThreshold(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", FINANCE_THRESHOLD_KEY)
    .single();
  return data ? Number(data.value) : 1000;
}

function generateReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `TRF-${year}-${seq}`;
}

export async function createTransferRequest(
  input: TransferRequestCreateInput,
  raisedBy: string,
): Promise<TransferRequest> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("At least one line item is required");
  }

  // Validate that each requested quantity does not exceed available stock
  const productIds = input.lines.map((l) => l.product_id);
  const { data: products, error: stockError } = await supabaseAdmin
    .from("products")
    .select("id, name, stock_quantity")
    .in("id", productIds);
  if (stockError) throw stockError;

  const stockMap = new Map<string, { name: string; stock_quantity: number }>(
    (products ?? []).map((p: any) => [p.id, { name: p.name, stock_quantity: p.stock_quantity }]),
  );

  for (const line of input.lines) {
    const product = stockMap.get(line.product_id);
    if (!product) {
      throw new Error(`Product ${line.product_id} not found.`);
    }
    if (line.requested_quantity <= 0) {
      throw new Error(`Requested quantity for "${product.name}" must be greater than zero.`);
    }
    if (line.requested_quantity > product.stock_quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}": requested ${line.requested_quantity}, available ${product.stock_quantity}.`,
      );
    }
  }

  const threshold = await getFinanceThreshold();
  const estimatedValue = input.estimated_value ?? 0;
  const requiresFinanceApproval = estimatedValue >= threshold;
  const initialStatus = requiresFinanceApproval ? "PENDING_APPROVAL" : "PENDING";

  const reference_number = generateReference();

  const { data: tr, error: trError } = await supabaseAdmin
    .from("transfer_requests")
    .insert([
      {
        reference_number,
        sbu_id: input.sbu_id,
        raised_by: raisedBy,
        status: initialStatus,
        required_date: input.required_date ?? null,
        notes: input.notes ?? null,
        estimated_value: estimatedValue || null,
        requires_finance_approval: requiresFinanceApproval,
      },
    ])
    .select()
    .single();

  if (trError) throw trError;
  const transferId = (tr as any).id;

  const lineInserts = input.lines.map((l) => ({
    transfer_request_id: transferId,
    product_id: l.product_id,
    requested_quantity: l.requested_quantity,
  }));

  const { error: liError } = await supabaseAdmin.from("transfer_line_items").insert(lineInserts);
  if (liError) throw liError;

  // Notify appropriate queue
  const notifyRole = requiresFinanceApproval ? "FINANCE_MANAGER" : "WAREHOUSE_MANAGER";
  await createNotification({
    user_role: notifyRole,
    type: "transfer_request_submitted",
    message: `New transfer request ${reference_number} requires your attention`,
    related_entity_id: transferId,
  });

  await writeAuditLog({
    entity_type: "transfer_request",
    entity_id: transferId,
    action: "create",
    performed_by: raisedBy,
    new_value: { reference_number, status: initialStatus },
  });

  return tr as TransferRequest;
}

export async function cancelTransferRequest(
  transferRequestId: string,
  cancelledBy: string,
): Promise<void> {
  const { data: tr, error: fetchError } = await supabaseAdmin
    .from("transfer_requests")
    .select("status")
    .eq("id", transferRequestId)
    .single();

  if (fetchError) throw fetchError;
  const currentStatus = (tr as any)?.status;

  if (!["PENDING", "PENDING_APPROVAL"].includes(currentStatus)) {
    throw new Error(`Cannot cancel a transfer in status: ${currentStatus}`);
  }

  const { error } = await supabaseAdmin
    .from("transfer_requests")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", transferRequestId);

  if (error) throw error;

  await writeAuditLog({
    entity_type: "transfer_request",
    entity_id: transferRequestId,
    action: "cancel",
    performed_by: cancelledBy,
    previous_value: { status: currentStatus },
    new_value: { status: "CANCELLED" },
  });
}

export async function listTransferRequestsForSbu(
  sbuId: string,
  status?: string,
): Promise<TransferRequest[]> {
  let query = supabaseAdmin
    .from("transfer_requests")
    .select("*, transfer_line_items(*)")
    .eq("sbu_id", sbuId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return (data as TransferRequest[]) ?? [];
}

export default { createTransferRequest, cancelTransferRequest, listTransferRequestsForSbu };
