/**
 * Unit tests: notificationService (T037)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    auth: { getUser: vi.fn() },
  },
  getUserFromAuthHeader: vi.fn(),
}));

/** Creates a thenable Supabase-style chain mock */
function makeChain(result: unknown) {
  const c: any = {};
  const self = () => c;
  c.insert = vi.fn(self);
  c.select = vi.fn(self);
  c.update = vi.fn(self);
  c.eq = vi.fn(self);
  c.or = vi.fn(self);
  c.order = vi.fn(self);
  c.single = vi.fn(() => Promise.resolve(result));
  // Make the chain itself awaitable
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createNotification inserts a row and returns it", async () => {
    // .insert().select().single() pattern
    const c = makeChain({ data: { id: "n-001" }, error: null });
    mockFrom.mockReturnValue(c);
    const { createNotification } = await import("../../lib/services/notificationService");
    const result = await createNotification({
      user_role: "WAREHOUSE_MANAGER",
      type: "TRANSFER_CREATED",
      message: "New transfer TRF-2026-00001",
    });
    expect((result as any)?.id).toBe("n-001");
  });

  it("markNotificationRead resolves without throwing on success", async () => {
    // .update().eq().eq() is the terminal call — chain is thenable
    const c = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(c);
    const { markNotificationRead } = await import("../../lib/services/notificationService");
    await expect(markNotificationRead("n-001", "user-001")).resolves.toBeUndefined();
  });

  it("getUnreadNotifications throws when DB returns an error", async () => {
    // The service re-throws — callers should handle
    const c = makeChain({ data: null, error: { message: "table missing" } });
    mockFrom.mockReturnValue(c);
    const { getUnreadNotifications } = await import("../../lib/services/notificationService");
    await expect(getUnreadNotifications("user-001", "BU_MANAGER")).rejects.toMatchObject({
      message: "table missing",
    });
  });
});
