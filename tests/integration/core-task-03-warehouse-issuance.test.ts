import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
  },
  getUserFromAuthHeader: mockGetUser,
}));

function makeChain(result: unknown) {
  const chain: any = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const WAREHOUSE_MANAGER = {
  id: "warehouse-user-001",
  user_metadata: { role: "WAREHOUSE_MANAGER" },
};

describe("core-task-03-warehouse-issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(WAREHOUSE_MANAGER);
  });

  it("lets Warehouse Manager see approved requests in the issuance queue", async () => {
    const transferList = [
      {
        id: "tr-approved-001",
        reference_number: "TRF-2026-10001",
        status: "APPROVED_FOR_ISSUE",
        transfer_line_items: [],
      },
    ];
    const transferChain = makeChain({ data: transferList, error: null });
    mockFrom.mockReturnValue(transferChain);

    const { GET } = await import("../../app/api/transfer-requests/route");
    const res = await GET(
      new Request("http://localhost/api/transfer-requests?status=APPROVED_FOR_ISSUE", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(transferList);
    expect(transferChain.eq).toHaveBeenCalledWith("status", "APPROVED_FOR_ISSUE");
    expect(transferChain.eq).not.toHaveBeenCalledWith("sbu_id", expect.any(String));
  });

  it("records full issuance through the process_issuance RPC", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests")
        return makeChain({
          data: { sbu_id: "sbu-001", reference_number: "TRF-2026-10001" },
          error: null,
        });
      if (table === "notifications") return makeChain({ data: { id: "n-001" }, error: null });
      if (table === "profiles") return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({ data: "issuance-full-001", error: null });

    const { POST } = await import("../../app/api/issuances/route");
    const res = await POST(
      new Request("http://localhost/api/issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          transfer_request_id: "tr-approved-001",
          issue_date: "2026-07-20T10:00:00.000Z",
          logistics_notes: "Full dispatch",
          items: [
            { product_id: "prod-001", quantity_issued: 5 },
            { product_id: "prod-002", quantity_issued: 3 },
          ],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ issuanceId: "issuance-full-001" });
    expect(mockRpc).toHaveBeenCalledWith(
      "process_issuance",
      expect.objectContaining({
        p_transfer_request_id: "tr-approved-001",
        p_issued_by: "warehouse-user-001",
        p_items: [
          { product_id: "prod-001", quantity_issued: 5 },
          { product_id: "prod-002", quantity_issued: 3 },
        ],
      }),
    );
  });

  it("records partial issuance with a shortfall reason in the RPC payload", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests")
        return makeChain({
          data: { sbu_id: "sbu-001", reference_number: "TRF-2026-10002" },
          error: null,
        });
      if (table === "notifications") return makeChain({ data: { id: "n-001" }, error: null });
      if (table === "profiles") return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({ data: "issuance-partial-001", error: null });

    const { POST } = await import("../../app/api/issuances/route");
    const res = await POST(
      new Request("http://localhost/api/issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          transfer_request_id: "tr-approved-002",
          items: [
            {
              product_id: "prod-001",
              quantity_issued: 2,
              shortfall_reason: "Insufficient stock - replenishment pending",
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      "process_issuance",
      expect.objectContaining({
        p_items: [
          {
            product_id: "prod-001",
            quantity_issued: 2,
            shortfall_reason: "Insufficient stock - replenishment pending",
          },
        ],
      }),
    );
  });

  it("returns an error when the stock decrement RPC rejects insufficient stock", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests")
        return makeChain({ data: { sbu_id: "sbu-001" }, error: null });
      return makeChain({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "process_issuance: insufficient_stock for product prod-001" },
    });

    try {
      const { POST } = await import("../../app/api/issuances/route");
      const res = await POST(
        new Request("http://localhost/api/issuances", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
          body: JSON.stringify({
            transfer_request_id: "tr-approved-003",
            items: [{ product_id: "prod-001", quantity_issued: 999 }],
          }),
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toContain("insufficient_stock");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
