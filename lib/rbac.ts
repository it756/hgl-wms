import { supabaseAdmin } from "./supabaseServer";
import type { UserRole } from "./models/user";

export function hasRole(user: any, role: UserRole): boolean {
  return ((user?.user_metadata as any)?.role || "") === role;
}

export function hasAnyRole(user: any, roles: UserRole[]): boolean {
  const userRole = (user?.user_metadata as any)?.role || "";
  return roles.includes(userRole as UserRole);
}

export function userSbuId(user: any): string | null {
  return (user?.user_metadata as any)?.sbu_id || null;
}

export function userRole(user: any): UserRole | null {
  return ((user?.user_metadata as any)?.role as UserRole) || null;
}

export async function isUserInSbu(userId: string, sbuId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("sbu_id")
      .eq("id", userId)
      .single();
    if (error) return false;
    return (data as any)?.sbu_id === sbuId;
  } catch (e) {
    return false;
  }
}

/** Returns true if the user has the Finance Manager role */
export function isFinanceManager(user: any): boolean {
  return hasRole(user, "FINANCE_MANAGER");
}

/** Returns true if the user is an Admin */
export function isAdmin(user: any): boolean {
  return hasRole(user, "ADMIN");
}

export default { hasRole, hasAnyRole, userSbuId, userRole, isUserInSbu, isFinanceManager, isAdmin };

