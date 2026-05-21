export interface Notification {
  id: string;
  user_id: string | null;
  user_role: string | null;
  type: string;
  message: string;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  performed_by: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
