import type { UserRole } from "./models/user";

export type LicenseAccessDenial =
  | "PROFILE_MISSING"
  | "ACCOUNT_INACTIVE"
  | "LICENSE_REQUIRED"
  | "LICENSE_EXPIRED";

export interface LicenseGateProfile {
  role: UserRole | string | null;
  is_active: boolean | null;
  licensed: boolean | null;
  license_expires_at: string | null;
}

export const LICENSE_REQUIRED_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
];

export function roleRequiresLicense(role: UserRole | string | null | undefined): boolean {
  return LICENSE_REQUIRED_ROLES.includes(role as UserRole);
}

export function evaluateLicenseAccess(
  profile: LicenseGateProfile | null | undefined,
): { allowed: true } | { allowed: false; reason: LicenseAccessDenial } {
  if (!profile) return { allowed: false, reason: "PROFILE_MISSING" };
  if (profile.is_active === false) return { allowed: false, reason: "ACCOUNT_INACTIVE" };

  if (!roleRequiresLicense(profile.role)) return { allowed: true };
  if (!profile.licensed) return { allowed: false, reason: "LICENSE_REQUIRED" };
  if (profile.license_expires_at && new Date(profile.license_expires_at) < new Date()) {
    return { allowed: false, reason: "LICENSE_EXPIRED" };
  }

  return { allowed: true };
}

export function licenseDenialMessage(reason: LicenseAccessDenial): string {
  switch (reason) {
    case "ACCOUNT_INACTIVE":
      return "This account is inactive. Contact an administrator to restore access.";
    case "LICENSE_EXPIRED":
      return "Your staff licence has expired. Contact an administrator to renew it before signing in.";
    case "LICENSE_REQUIRED":
      return "Your role requires an active staff licence before you can use Harvest WMS.";
    case "PROFILE_MISSING":
      return "No application profile was found for this account. Contact an administrator.";
  }
}