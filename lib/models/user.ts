export type UserRole =
  | "BU_MANAGER"
  | "WAREHOUSE_MANAGER"
  | "UNIT_STAFF"
  | "FINANCE_MANAGER"
  | "ADMIN";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  sbu_id: string | null;
  unit_id: string | null;
  is_active: boolean;
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
