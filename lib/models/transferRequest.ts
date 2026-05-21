export type TransferRequestStatus =
  | "PENDING"
  | "PENDING_APPROVAL"
  | "APPROVED_FOR_ISSUE"
  | "ISSUED"
  | "CANCELLED"
  | "COMPLETED"
  | "COMPLETED_WITH_VARIANCE";

export interface TransferRequest {
  id: string;
  reference_number: string;
  sbu_id: string;
  raised_by: string;
  status: TransferRequestStatus;
  required_date: string | null;
  notes: string | null;
  estimated_value: number | null;
  requires_finance_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  finance_approval_notes: string | null;
  warehouse_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferRequestCreateInput {
  sbu_id: string;
  required_date?: string;
  notes?: string;
  estimated_value?: number;
  lines: TransferLineItemInput[];
}

export interface TransferLineItemInput {
  product_id: string;
  requested_quantity: number;
}
