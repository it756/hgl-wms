import { supabaseAdmin } from "../supabaseServer";
import type { AuditLog } from "../models/shared";

export interface AuditLogEntry {
  entity_type: string;
  entity_id?: string;
  action: string;
  performed_by?: string;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ip_address?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert([
    {
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      action: entry.action,
      performed_by: entry.performed_by ?? null,
      previous_value: entry.previous_value ?? null,
      new_value: entry.new_value ?? null,
      details: entry.details ?? null,
      ip_address: entry.ip_address ?? null,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    // Audit failures are logged but not thrown — application flow should not be blocked
    console.error("[auditService] Failed to write audit log:", error.message);
  }
}

export async function queryAuditLogs(
  entityType?: string,
  entityId?: string,
  performedBy?: string,
  from?: string,
  to?: string,
  limit = 100,
  offset = 0,
): Promise<AuditLog[]> {
  let query = supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (performedBy) query = query.eq("performed_by", performedBy);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw error;
  return (data as AuditLog[]) ?? [];
}

export default { writeAuditLog, queryAuditLogs };
