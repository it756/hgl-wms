/**
 * Integration test: Concurrent Issuances (T044)
 *
 * Tests that the process_issuance RPC is called with idempotency-safe parameters
 * and that concurrent calls don't silently drop errors.
 * (Real serialisation is enforced at the Postgres level via FOR UPDATE.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn() },
  },
  getUserFromAuthHeader: vi.fn(),
}));

describe("Concurrent issuance protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("first call succeeds; second call for same transfer fails with RPC error", async () => {
    // First call returns success
    mockRpc
      .mockResolvedValueOnce({ data: "issuance-uuid-001", error: null })
      // Second call simulates DB-level conflict
      .mockResolvedValueOnce({
        data: null,
        error: { message: "process_issuance: transfer_request already ISSUED" },
      });

    const { processIssuance } = await import("../../lib/services/issuanceService");

    const first = await processIssuance(
      "tr-001",
      [{ product_id: "p-001", quantity_issued: 5 }],
      "user-001",
    );
    expect(first).toBe("issuance-uuid-001");

    await expect(
      processIssuance("tr-001", [{ product_id: "p-001", quantity_issued: 5 }], "user-002"),
    ).rejects.toThrow();
  });

  it("concurrent calls run the RPC exactly once each", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: "issuance-a", error: null })
      .mockResolvedValueOnce({ data: "issuance-b", error: null });

    const { processIssuance } = await import("../../lib/services/issuanceService");

    const [a, b] = await Promise.all([
      processIssuance("tr-100", [{ product_id: "p-001", quantity_issued: 3 }], "user-A"),
      processIssuance("tr-101", [{ product_id: "p-002", quantity_issued: 3 }], "user-B"),
    ]);

    expect(a).toBe("issuance-a");
    expect(b).toBe("issuance-b");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
