/**
 * Unit tests: auditService (T037)
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
  c.select = vi.fn(self);
  c.insert = vi.fn(self);
  c.update = vi.fn(self);
  c.eq = vi.fn(self);
  c.gte = vi.fn(self);
  c.lte = vi.fn(self);
  c.order = vi.fn(self);
  c.range = vi.fn(self);
  c.single = vi.fn(() => Promise.resolve(result));
  // Make the chain itself awaitable (covers patterns that don't end in .single())
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

describe("auditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writeAuditLog swallows DB errors without throwing", async () => {
    // writeAuditLog only console.errors, does NOT re-throw
    const c = makeChain({ data: null, error: { message: "db down" } });
    mockFrom.mockReturnValue(c);
    const { writeAuditLog } = await import("../../lib/services/auditService");
    await expect(writeAuditLog({ entity_type: "test", action: "noop" })).resolves.toBeUndefined();
  });

  it("queryAuditLogs returns rows on success", async () => {
    const rows = [
      { id: "a1", entity_type: "transfer_request", action: "created", created_at: "2026-01-01" },
    ];
    const c = makeChain({ data: rows, error: null });
    mockFrom.mockReturnValue(c);
    const { queryAuditLogs } = await import("../../lib/services/auditService");
    const result = await queryAuditLogs(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      50,
      0,
    );
    expect(result).toEqual(rows);
  });

  it("queryAuditLogs throws when DB returns an error", async () => {
    // The service re-throws Supabase errors — callers must handle them
    const dbError = { message: "query failed" };
    const c = makeChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(c);
    const { queryAuditLogs } = await import("../../lib/services/auditService");
    await expect(queryAuditLogs()).rejects.toMatchObject({ message: "query failed" });
  });
});
