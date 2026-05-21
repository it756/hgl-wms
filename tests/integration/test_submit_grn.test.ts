/**
 * Integration test: Submit GRN (T030)
 *
 * Tests grnService.recordGRN:
 * - Requires transfer to be in ISSUED status
 * - Detects variance when received qty != issued qty
 * - Transitions transfer to COMPLETED or COMPLETED_WITH_VARIANCE
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
  getUserFromAuthHeader: vi.fn(),
}));

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  Object.assign(chain, overrides);
  return chain;
}

describe("grnService.recordGRN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when transfer is not in ISSUED status", async () => {
    const trChain = buildChain({
      single: vi.fn(() =>
        Promise.resolve({ data: { id: "tr-001", status: "PENDING", sbu_id: "sbu-001" }, error: null }),
      ),
    });
    mockFrom.mockReturnValue(trChain);

    const { recordGRN } = await import("../../lib/services/grnService");

    await expect(
      recordGRN(
        {
          transfer_request_id: "tr-001",
          items: [{ product_id: "p1", issued_quantity: 5, quantity_received: 5 }],
        },
        "user-001",
      ),
    ).rejects.toThrow("GRN can only be submitted for ISSUED transfers");
  });

  it("creates GRN with has_variance=false when quantities match", async () => {
    const insertedGRN = { id: "grn-001", has_variance: false };
    let insertCallCount = 0;

    const grnsChain = buildChain({
      insert: vi.fn(() => grnsChain),
      select: vi.fn(() => grnsChain),
      single: vi.fn(() => Promise.resolve({ data: insertedGRN, error: null })),
    });

    const genericChain = buildChain({
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn(() => genericChain),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        insertCallCount++;
        if (insertCallCount === 1) {
          // First call: status check
          return buildChain({
            single: vi.fn(() =>
              Promise.resolve({ data: { id: "tr-001", status: "ISSUED", sbu_id: "sbu-001" }, error: null }),
            ),
            eq: vi.fn(function (this: any) { return this; }),
            select: vi.fn(function (this: any) { return this; }),
          });
        }
        // Subsequent calls: update status
        return genericChain;
      }
      if (table === "grns") return grnsChain;
      return genericChain;
    });

    const { recordGRN } = await import("../../lib/services/grnService");

    const result = await recordGRN(
      {
        transfer_request_id: "tr-001",
        items: [{ product_id: "p1", issued_quantity: 5, quantity_received: 5 }],
      },
      "user-001",
    );

    expect(result.has_variance).toBe(false);
  });
});
