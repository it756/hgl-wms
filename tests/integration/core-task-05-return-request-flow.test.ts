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
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const UNIT_STAFF = {
  id: "unit-user-001",
  user_metadata: { role: "UNIT_STAFF", sbu_id: "sbu-001" },
};

const BU_MANAGER = {
  id: "bu-user-001",
  user_metadata: { role: "BU_MANAGER", sbu_id: "sbu-001" },
};

const WAREHOUSE_MANAGER = {
  id: "warehouse-user-001",
  user_metadata: { role: "WAREHOUSE_MANAGER" },
};

const FINANCE_MANAGER = {
  id: "finance-user-001",
  user_metadata: { role: "FINANCE_MANAGER" },
};

describe("core-task-05-return-request-flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a linked return request against a completed transfer", async () => {
    mockGetUser.mockResolvedValue(UNIT_STAFF);

    const notificationChain = makeChain({ data: { id: "n-001" }, error: null });
    const transferChain = makeChain({
      data: { id: "tr-001", sbu_id: "sbu-001", status: "COMPLETED" },
      error: null,
    });
    const returnChain = makeChain({
      data: { id: "rr-001", reference_number: "RTN-2026-10001" },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    const auditChain = makeChain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") return transferChain;
      if (table === "return_requests") return returnChain;
      if (table === "return_line_items") return lineItemsChain;
      if (table === "notifications") return notificationChain;
      if (table === "audit_logs") return auditChain;
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          original_transfer_request_id: "tr-001",
          reason: "Wrong item delivered",
          notes: "Return to warehouse",
          items: [{ product_id: "prod-001", quantity_to_return: 2 }],
        }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.reference_number).toMatch(/^RTN-\d{4}-\d{5}$/);
    expect(returnChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        original_transfer_request_id: "tr-001",
        sbu_id: "sbu-001",
        raised_by: "unit-user-001",
        status: "PENDING_APPROVAL",
        reason: "Wrong item delivered",
        notes: "Return to warehouse",
      }),
    ]);
    expect(lineItemsChain.insert).toHaveBeenCalledWith([
      { return_request_id: "rr-001", product_id: "prod-001", quantity_to_return: 2 },
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "BU_MANAGER",
        type: "return_request_submitted",
        related_entity_id: "rr-001",
      }),
    ]);
  });

  it("creates an unlinked return request without requiring an original transfer", async () => {
    mockGetUser.mockResolvedValue(UNIT_STAFF);

    const returnChain = makeChain({
      data: { id: "rr-002", reference_number: "RTN-2026-10002" },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests") return returnChain;
      if (table === "return_line_items") return lineItemsChain;
      if (table === "notifications") return makeChain({ data: { id: "n-002" }, error: null });
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          reason: "Expired stock at unit",
          items: [{ product_id: "prod-002", quantity_to_return: 1 }],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(returnChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        original_transfer_request_id: null,
        reason: "Expired stock at unit",
      }),
    ]);
  });

  it("lets a BU Manager approve a pending return request", async () => {
    mockGetUser.mockResolvedValue(BU_MANAGER);

    const fetchChain = makeChain({
      data: {
        id: "rr-003",
        reference_number: "RTN-2026-10003",
        status: "PENDING_APPROVAL",
        sbu_id: "sbu-001",
        raised_by: "unit-user-001",
      },
      error: null,
    });
    const updateChain = makeChain({
      data: { id: "rr-003", status: "APPROVED", approval_notes: "Return approved" },
      error: null,
    });
    let returnRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests") {
        returnRequestCalls += 1;
        return returnRequestCalls === 1 ? fetchChain : updateChain;
      }
      if (table === "notifications") return makeChain({ data: { id: "n-003" }, error: null });
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests/rr-003/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ action: "approve", approval_notes: "Return approved" }),
      }),
      { params: Promise.resolve({ id: "rr-003" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("APPROVED");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "APPROVED",
        approved_by: "bu-user-001",
        approval_notes: "Return approved",
      }),
    );
  });

  it("lets a BU Manager reject a pending return request", async () => {
    mockGetUser.mockResolvedValue(BU_MANAGER);

    const fetchChain = makeChain({
      data: {
        id: "rr-004",
        reference_number: "RTN-2026-10004",
        status: "PENDING_APPROVAL",
        sbu_id: "sbu-001",
        raised_by: "unit-user-001",
      },
      error: null,
    });
    const updateChain = makeChain({
      data: { id: "rr-004", status: "REJECTED", approval_notes: "Not eligible" },
      error: null,
    });
    let returnRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests") {
        returnRequestCalls += 1;
        return returnRequestCalls === 1 ? fetchChain : updateChain;
      }
      if (table === "notifications") return makeChain({ data: { id: "n-004" }, error: null });
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests/rr-004/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ action: "reject", approval_notes: "Not eligible" }),
      }),
      { params: Promise.resolve({ id: "rr-004" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("REJECTED");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "REJECTED",
        approved_by: "bu-user-001",
        approval_notes: "Not eligible",
      }),
    );
  });

  it("records Warehouse receipt and leaves stock credit pending Finance approval", async () => {
    mockGetUser.mockResolvedValue(WAREHOUSE_MANAGER);
    mockRpc.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests")
        return makeChain({
          data: {
            id: "rr-005",
            reference_number: "RTN-2026-10005",
            status: "APPROVED",
            sbu_id: "sbu-001",
          },
          error: null,
        });
      if (table === "notifications") return makeChain({ data: { id: "n-005" }, error: null });
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/[id]/receive/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests/rr-005/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "rr-005" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("AWAITING_FINANCE_APPROVAL");
    expect(mockRpc).toHaveBeenCalledWith("process_return_physical_receipt", {
      p_return_request_id: "rr-005",
      p_received_by: "warehouse-user-001",
    });
  });

  it("lets Finance approve the received return and restore stock through the stock-credit RPC", async () => {
    mockGetUser.mockResolvedValue(FINANCE_MANAGER);
    mockRpc.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests")
        return makeChain({
          data: {
            id: "rr-006",
            reference_number: "RTN-2026-10006",
            status: "AWAITING_FINANCE_APPROVAL",
          },
          error: null,
        });
      if (table === "notifications") return makeChain({ data: { id: "n-006" }, error: null });
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/[id]/finance-approve/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests/rr-006/finance-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ action: "approve", notes: "Stock credit approved" }),
      }),
      { params: Promise.resolve({ id: "rr-006" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("STOCK_RESTORED");
    expect(mockRpc).toHaveBeenCalledWith("process_return_stock_credit", {
      p_return_request_id: "rr-006",
      p_approved_by: "finance-user-001",
      p_notes: "Stock credit approved",
    });
  });
});
