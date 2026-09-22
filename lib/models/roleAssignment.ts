import type { UserRole } from "./user";

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: UserRole;
  sbu_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignmentInput {
  role: UserRole;
  sbu_id?: string | null;
  unit_id?: string | null;
}

/** Roles that are global and must not carry an SBU or unit scope. */
export const GLOBAL_ROLES: UserRole[] = [
  "WAREHOUSE_MANAGER",
  "FINANCE_MANAGER",
  "ADMIN",
  "INTERNAL_CONTROL_OFFICER",
];

/**
 * Validates that an SBU/unit combination is consistent with a role's scope, mirroring
 * the rules enforced by the user_role_assignments CHECK constraint.
 */
export function validateAssignmentShape(input: RoleAssignmentInput): { error: string } | null {
  const sbuId = input.sbu_id || null;
  const unitId = input.unit_id || null;

  if (input.role === "UNIT_STAFF") {
    if (!sbuId || !unitId) {
      return { error: "Unit Staff assignments require both an SBU and a unit" };
    }
    return null;
  }

  if (input.role === "BU_MANAGER") {
    if (!sbuId) return { error: "BU Manager assignments require an SBU" };
    if (unitId) return { error: "BU Manager assignments must not have a unit" };
    return null;
  }

  if (GLOBAL_ROLES.includes(input.role)) {
    if (sbuId || unitId) {
      return { error: `${input.role} assignments must not have an SBU or unit` };
    }
    return null;
  }

  return { error: `Unknown role: ${input.role}` };
}
