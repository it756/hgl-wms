/**
 * Unit tests: rbac helpers (T037)
 *
 * rbac.ts imports supabaseServer at the module level (for isUserInSbu),
 * so we mock it to avoid the missing-env-vars error in test.
 */
import { describe, it, expect, vi } from "vitest";

// Must be hoisted before any import that transitively loads supabaseServer
vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: { sbu_id: "sbu-1" }, error: null })),
    })),
    auth: { getUser: vi.fn() },
  },
  getUserFromAuthHeader: vi.fn(),
}));

describe("rbac helpers", () => {
  it("hasRole returns true when user has the given role", async () => {
    const { hasRole } = await import("../../lib/rbac");
    const fakeUser = { user_metadata: { role: "ADMIN" } } as any;
    expect(hasRole(fakeUser, "ADMIN")).toBe(true);
  });

  it("hasRole returns false when user lacks the role", async () => {
    const { hasRole } = await import("../../lib/rbac");
    const fakeUser = { user_metadata: { role: "UNIT_STAFF" } } as any;
    expect(hasRole(fakeUser, "ADMIN")).toBe(false);
  });

  it("hasAnyRole returns true if at least one role matches", async () => {
    const { hasAnyRole } = await import("../../lib/rbac");
    const fakeUser = { user_metadata: { role: "FINANCE_MANAGER" } } as any;
    expect(hasAnyRole(fakeUser, ["ADMIN", "FINANCE_MANAGER"])).toBe(true);
  });

  it("isFinanceManager identifies FINANCE_MANAGER", async () => {
    const { isFinanceManager } = await import("../../lib/rbac");
    const fm = { user_metadata: { role: "FINANCE_MANAGER" } } as any;
    const wm = { user_metadata: { role: "WAREHOUSE_MANAGER" } } as any;
    expect(isFinanceManager(fm)).toBe(true);
    expect(isFinanceManager(wm)).toBe(false);
  });

  it("isAdmin identifies ADMIN", async () => {
    const { isAdmin } = await import("../../lib/rbac");
    const admin = { user_metadata: { role: "ADMIN" } } as any;
    const bum = { user_metadata: { role: "BU_MANAGER" } } as any;
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(bum)).toBe(false);
  });

  it("userRole extracts role from user_metadata", async () => {
    const { userRole } = await import("../../lib/rbac");
    const u = { user_metadata: { role: "WAREHOUSE_MANAGER" } } as any;
    expect(userRole(u)).toBe("WAREHOUSE_MANAGER");
  });
});
