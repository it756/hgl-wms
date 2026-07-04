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
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const BU_MANAGER = {
  id: "user-bu-001",
  user_metadata: { role: "BU_MANAGER", sbu_id: "sbu-001" },
};

describe("core-task-02-transfer-lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(BU_MANAGER);
  });

  it("creates a multi-line transfer request with validation and a TRF reference", async () => {
    const notificationChain = makeChain({ data: { id: "n-001" }, error: null });
    const profileListChain = makeChain({ data: [], error: null });
    mockRpc.mockResolvedValue({
      data: {
        id: "tr-001",
        reference_number: "TRF-2026-12345",
        status: "PENDING_APPROVAL",
        requires_finance_approval: true,
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return profileListChain;
      if (table === "notifications") return notificationChain;
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/transfer-requests/route");
    const res = await POST(
      new Request("http://localhost/api/transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          requesting_unit_id: "unit-001",
          required_date: "2026-07-20",
          notes: "Core task transfer",
          estimated_value: 1500,
          lines: [
            { product_id: "prod-001", requested_quantity: 2 },
            { product_id: "prod-002", requested_quantity: 3 },
          ],
        }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.reference_number).toMatch(/^TRF-\d{4}-\d{5}$/);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_transfer_request_atomic",
      expect.objectContaining({
        p_actor_id: "user-bu-001",
        p_requesting_unit_id: "unit-001",
        p_lines: [
          { product_id: "prod-001", requested_quantity: 2 },
          { product_id: "prod-002", requested_quantity: 3 },
        ],
      }),
    );
  });

  it("rejects missing line items before creating a transfer request", async () => {
    const { POST } = await import("../../app/api/transfer-requests/route");
    const res = await POST(
      new Request("http://localhost/api/transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ requesting_unit_id: "unit-001", lines: [] }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("No line items");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects requested quantities above available stock", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'create_transfer_request_atomic: insufficient stock for "Product One": requested 5, available 1',
      },
    });

    const { POST } = await import("../../app/api/transfer-requests/route");
    const res = await POST(
      new Request("http://localhost/api/transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          requesting_unit_id: "unit-001",
          lines: [{ product_id: "prod-001", requested_quantity: 5 }],
        }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toContain("Insufficient stock");
  });

  it("allows the original requester to edit a request before issuance", async () => {
    const existingChain = makeChain({
      data: {
        id: "tr-001",
        status: "PENDING_APPROVAL",
        raised_by: "user-bu-001",
        sbu_id: "sbu-001",
        requires_finance_approval: true,
      },
      error: null,
    });
    const updateChain = makeChain({ data: null, error: null });
    const productsChain = makeChain({
      data: [{ id: "prod-001", name: "Product One", stock_quantity: 10 }],
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    let transferRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        transferRequestCalls += 1;
        return transferRequestCalls === 1 ? existingChain : updateChain;
      }
      if (table === "products") return productsChain;
      if (table === "transfer_line_items") return lineItemsChain;
      return makeChain({ data: null, error: null });
    });

    const { PUT } = await import("../../app/api/transfer-requests/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/transfer-requests/tr-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          required_date: "2026-07-25",
          notes: "Updated before issue",
          estimated_value: 250,
          lines: [{ product_id: "prod-001", requested_quantity: 4 }],
        }),
      }),
      { params: Promise.resolve({ id: "tr-001" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        required_date: "2026-07-25",
        notes: "Updated before issue",
        estimated_value: 250,
      }),
    );
    expect(lineItemsChain.delete).toHaveBeenCalled();
    expect(lineItemsChain.insert).toHaveBeenCalledWith([
      { transfer_request_id: "tr-001", product_id: "prod-001", requested_quantity: 4 },
    ]);
  });

  it("blocks request edits once issuance has started", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests")
        return makeChain({
          data: {
            id: "tr-001",
            status: "ISSUED",
            raised_by: "user-bu-001",
            sbu_id: "sbu-001",
            requires_finance_approval: true,
          },
          error: null,
        });
      return makeChain({ data: null, error: null });
    });

    const { PUT } = await import("../../app/api/transfer-requests/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/transfer-requests/tr-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ lines: [{ product_id: "prod-001", requested_quantity: 1 }] }),
      }),
      { params: Promise.resolve({ id: "tr-001" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toContain("can no longer be amended");
  });

  it("cancels a pre-issuance transfer and rejects cancellation after issuance", async () => {
    const pendingFetch = makeChain({ data: { status: "PENDING_APPROVAL" }, error: null });
    const updateChain = makeChain({ data: null, error: null });
    const auditChain = makeChain({ data: null, error: null });
    let transferRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        transferRequestCalls += 1;
        return transferRequestCalls === 1 ? pendingFetch : updateChain;
      }
      if (table === "audit_logs") return auditChain;
      return makeChain({ data: null, error: null });
    });

    const { cancelTransferRequest } = await import("../../lib/services/transferService");
    await expect(cancelTransferRequest("tr-001", "user-bu-001")).resolves.toBeUndefined();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELLED" }),
    );

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests")
        return makeChain({ data: { status: "ISSUED" }, error: null });
      return makeChain({ data: null, error: null });
    });

    await expect(cancelTransferRequest("tr-002", "user-bu-001")).rejects.toThrow(
      "Cannot cancel a transfer in status: ISSUED",
    );
  });

  it("returns request details for the user's SBU and blocks cross-SBU detail access", async () => {
    const transfer = {
      id: "tr-001",
      reference_number: "TRF-2026-12345",
      status: "PENDING_APPROVAL",
      sbu_id: "sbu-001",
      transfer_line_items: [],
    };

    mockFrom.mockReturnValue(makeChain({ data: transfer, error: null }));

    const { GET } = await import("../../app/api/transfer-requests/[id]/route");
    const allowed = await GET(
      new Request("http://localhost/api/transfer-requests/tr-001", {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "tr-001" }) },
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual(expect.objectContaining({ status: "PENDING_APPROVAL" }));

    mockGetUser.mockResolvedValue({
      id: "user-bu-002",
      user_metadata: { role: "BU_MANAGER", sbu_id: "sbu-002" },
    });

    const forbidden = await GET(
      new Request("http://localhost/api/transfer-requests/tr-001", {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "tr-001" }) },
    );
    expect(forbidden.status).toBe(403);
  });
});
