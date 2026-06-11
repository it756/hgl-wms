export type GRNStatus = "OPEN" | "SUBMITTED";

export interface GRN {
  id: string;
  transfer_request_id: string;
  received_by: string;
  date_received: string;
  condition_notes: string | null;
  has_variance: boolean;
  acknowledged: boolean;
  created_at: string;
  updated_at: string;
}

export interface GRNLineItem {
  id: string;
  grn_id: string;
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes: string | null;
  created_at: string;
}

export interface GRNLineItemInput {
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes?: string;
}

export interface GRNCreateInput {
  transfer_request_id: string;
  date_received?: string;
  condition_notes?: string;
  items: GRNLineItemInput[];
}

export type SupplierGRNStatus = "AWAITING_FINANCE_APPROVAL" | "GRN_APPROVED" | "GRN_REJECTED";

export interface SupplierGRN {
  id: string;
  reference_number: string;
  supplier_name: string;
  supplier_invoice_reference: string | null;
  invoice_amount: number | null;
  received_by: string;
  date_received: string;
  status: SupplierGRNStatus;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  sbu_id: string | null;
  warehouse_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierGRNLineItem {
  id: string;
  supplier_grn_id: string;
  product_id: string;
  quantity_received: number;
  unit_cost: number | null;
  created_at: string;
}

export interface SupplierGRNCreateInput {
  supplier_name: string;
  supplier_invoice_reference?: string;
  invoice_amount?: number;
  date_received?: string;
  sbu_id?: string;
  items: { product_id: string; quantity_received: number; unit_cost?: number }[];
}

// ─── Variance Disposition ────────────────────────────────────────────────────

export type DispositionType = "WRITE_BACK" | "LOSS";

export interface VarianceDisposition {
  id: string;
  transfer_request_id: string;
  grn_id: string;
  grn_line_item_id: string;
  product_id: string;
  sbu_id: string;
  quantity_variance: number;
  disposition: DispositionType;
  decided_by: string;
  decided_at: string;
  notes: string | null;
  created_at: string;
}

export interface LineDispositionInput {
  grn_line_item_id: string;
  disposition: DispositionType;
  notes?: string;
}

export interface StockLoss {
  id: string;
  reference_number: string;
  variance_disposition_id: string;
  transfer_request_id: string;
  grn_id: string;
  product_id: string;
  sbu_id: string;
  quantity_lost: number;
  unit_cost_at_loss: number | null;
  value_lost: number | null;
  decided_by: string;
  decided_at: string;
  reason_notes: string | null;
  created_at: string;
}
