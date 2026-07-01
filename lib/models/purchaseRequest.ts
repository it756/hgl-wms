export type PurchaseRequestStatus =
  | "DRAFT"
  | "PENDING_PROCUREMENT_APPROVAL"
  | "PROCUREMENT_CHANGES_REQUESTED"
  | "PENDING_INTERNAL_CONTROL_APPROVAL"
  | "INTERNAL_CONTROL_REJECTED"
  | "APPROVED_FOR_PURCHASE"
  | "EXPECTED_ORDER"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"
  | "REJECTED";

export const EDITABLE_STATUSES: PurchaseRequestStatus[] = [
  "DRAFT",
  "PROCUREMENT_CHANGES_REQUESTED",
];

export interface PurchaseRequest {
  id: string;
  reference_number: string;
  sbu_id: string;
  created_by: string;
  status: PurchaseRequestStatus;
  supplier_name: string | null;
  supplier_email: string | null;
  procurement_email: string;
  notes: string | null;
  estimated_total: number | null;

  procurement_actioned_at: string | null;
  procurement_action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | null;
  procurement_notes: string | null;
  procurement_document_url: string | null;

  internal_control_actioned_by: string | null;
  internal_control_actioned_at: string | null;
  internal_control_action: "APPROVED" | "REJECTED" | null;
  internal_control_notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestLineItem {
  id: string;
  purchase_request_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity_requested: number;
  unit_cost: number | null;
  unit_of_measure: string;
  notes: string | null;
  created_at: string;
}

export interface PurchaseRequestLineItemInput {
  product_id?: string;
  product_name: string;
  sku?: string;
  quantity_requested: number;
  unit_cost?: number;
  unit_of_measure?: string;
  notes?: string;
}

export interface PurchaseRequestCreateInput {
  sbu_id: string;
  procurement_email: string;
  supplier_name?: string;
  supplier_email?: string;
  notes?: string;
  lines: PurchaseRequestLineItemInput[];
}

export interface PurchaseRequestUpdateInput {
  procurement_email?: string;
  supplier_name?: string;
  supplier_email?: string;
  notes?: string;
  lines?: PurchaseRequestLineItemInput[];
}

export interface ExternalActionToken {
  id: string;
  token_hash: string;
  entity_type: string;
  entity_id: string;
  actor_email: string;
  actor_type: string;
  allowed_actions: string[];
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  last_viewed_at: string | null;
  last_actor_ip: string | null;
  last_user_agent: string | null;
}
