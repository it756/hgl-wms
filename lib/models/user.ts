export type UserRole =
  | "BU_MANAGER"
  | "WAREHOUSE_MANAGER"
  | "UNIT_STAFF"
  | "FINANCE_MANAGER"
  | "ADMIN"
  | "INTERNAL_CONTROL_OFFICER";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  sbu_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  licensed: boolean;
  license_type: string | null;
  license_issued_at: string | null;
  license_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreateInput {
  email: string;
  password: string;
  full_name?: string;
  role: UserRole;
  sbu_id?: string;
}

/** Dashboard landing route for a role, used after login and after switching active context. */
export function routeForRole(role: UserRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "BU_MANAGER" || role === "UNIT_STAFF") return "/requests";
  if (role === "WAREHOUSE_MANAGER") return "/warehouse/queue";
  if (role === "FINANCE_MANAGER") return "/finance/queue";
  if (role === "INTERNAL_CONTROL_OFFICER") return "/internal-control";
  return "/requests";
}
