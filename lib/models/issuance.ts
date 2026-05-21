export interface Issuance {
  id: string;
  transfer_request_id: string;
  issued_by: string;
  issue_date: string;
  logistics_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssuanceLineItem {
  id: string;
  issuance_id: string;
  product_id: string;
  quantity_issued: number;
  shortfall_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssuanceLineItemInput {
  product_id: string;
  quantity_issued: number;
  shortfall_reason?: string;
}

export interface IssuanceCreateInput {
  transfer_request_id: string;
  items: IssuanceLineItemInput[];
  issue_date?: string;
  logistics_notes?: string;
}
