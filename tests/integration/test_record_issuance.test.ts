/**
 * Integration test: Record Issuance (T025)
 *
 * Tests issuanceService.processIssuance and the process_issuance RPC wrapper:
 * - Delegates to DB-side RPC
 * - Throws when transfer is not in an issuable state
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

describe("issuanceService.processIssuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls process_issuance RPC with correct params and returns issuance id", async () => {
    mockRpc.mockResolvedValue({ data: "issuance-uuid-001", error: null });

    const { processIssuance } = await import("../../lib/services/issuanceService");

    const result = await processIssuance(
      "transfer-uuid-001",
      [{ product_id: "prod-001", quantity_issued: 5 }],
      "user-001",
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "process_issuance",
      expect.objectContaining({
        p_transfer_request_id: "transfer-uuid-001",
        p_issued_by: "user-001",
      }),
    );
    expect(result).toBe("issuance-uuid-001");
  });

  it("throws when RPC returns an error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "process_issuance: transfer_request not in issuable state" },
    });

    const { processIssuance } = await import("../../lib/services/issuanceService");

    await expect(processIssuance("transfer-uuid-bad", [], "user-001")).rejects.toThrow();
  });
});
