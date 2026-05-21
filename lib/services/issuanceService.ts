import { supabaseAdmin } from "../supabaseServer";

export async function processIssuance(transfer_request_id: string, items: any[], issued_by: string, issue_date?: string, logistics_notes?: string) {
  // Thin wrapper around DB RPC `process_issuance`
  const { data, error } = await supabaseAdmin.rpc('process_issuance', {
    p_transfer_request_id: transfer_request_id,
    p_issued_by: issued_by,
    p_items: JSON.stringify(items),
    p_issue_date: issue_date || new Date().toISOString(),
    p_logistics_notes: logistics_notes || null,
  });
  if (error) throw error;
  return data;
}

export default { processIssuance };
