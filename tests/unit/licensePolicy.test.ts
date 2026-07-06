import { describe, expect, it } from "vitest";
import { evaluateLicenseAccess, roleRequiresLicense } from "../../lib/licensePolicy";

describe("licence access policy", () => {
  it("does not require admins to hold a licence", () => {
    expect(roleRequiresLicense("ADMIN")).toBe(false);
    expect(
      evaluateLicenseAccess({
        role: "ADMIN",
        is_active: true,
        licensed: false,
        license_expires_at: null,
      }),
    ).toEqual({ allowed: true });
  });

  it("requires operational roles to hold an active licence", () => {
    expect(roleRequiresLicense("WAREHOUSE_MANAGER")).toBe(true);
    expect(
      evaluateLicenseAccess({
        role: "WAREHOUSE_MANAGER",
        is_active: true,
        licensed: false,
        license_expires_at: null,
      }),
    ).toEqual({ allowed: false, reason: "LICENSE_REQUIRED" });
  });

  it("rejects expired operational licences", () => {
    expect(
      evaluateLicenseAccess({
        role: "FINANCE_MANAGER",
        is_active: true,
        licensed: true,
        license_expires_at: "2020-01-01T00:00:00.000Z",
      }),
    ).toEqual({ allowed: false, reason: "LICENSE_EXPIRED" });
  });

  it("allows active licensed operational staff", () => {
    expect(
      evaluateLicenseAccess({
        role: "UNIT_STAFF",
        is_active: true,
        licensed: true,
        license_expires_at: "2999-01-01T00:00:00.000Z",
      }),
    ).toEqual({ allowed: true });
  });

  it("rejects inactive users before checking licence status", () => {
    expect(
      evaluateLicenseAccess({
        role: "ADMIN",
        is_active: false,
        licensed: true,
        license_expires_at: null,
      }),
    ).toEqual({ allowed: false, reason: "ACCOUNT_INACTIVE" });
  });
});