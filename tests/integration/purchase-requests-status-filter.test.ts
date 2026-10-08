import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
  getUserFromAuthHeader: mockGetUser,
}));

vi.mock("../../lib/services/purchaseRequestService", () => ({
  createPurchaseRequest: vi.fn(),
}));

function makeChain(result: unknown) {
  const chain: any = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.order = vi.fn(self);
  chain.range = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("GET /api/purchase-requests status filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetUser.mockResolvedValue({
      id: "warehouse-user-001",
      user_metadata: { role: "WAREHOUSE_MANAGER" },
    });
  });

  it("accepts a comma-separated status list for open inbound receive states", async () => {
    const purchaseRequestsChain = makeChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchase_requests") return purchaseRequestsChain;
      return makeChain({ data: null, error: null });
    });

    const { GET } = await import("../../app/api/purchase-requests/route");
    const req = new Request(
      "http://localhost/api/purchase-requests?status=EXPECTED_ORDER,PARTIALLY_RECEIVED",
      { headers: { Authorization: "Bearer tok" } },
    );

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(purchaseRequestsChain.in).toHaveBeenCalledWith("status", [
      "EXPECTED_ORDER",
      "PARTIALLY_RECEIVED",
    ]);
    expect(purchaseRequestsChain.eq).not.toHaveBeenCalledWith("status", expect.any(String));
  });
});