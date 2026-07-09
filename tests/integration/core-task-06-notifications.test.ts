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
  chain.in = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const BU_MANAGER = {
  id: "bu-user-001",
  user_metadata: { role: "BU_MANAGER", sbu_id: "sbu-001" },
};

const WAREHOUSE_MANAGER = {
  id: "warehouse-user-001",
  user_metadata: { role: "WAREHOUSE_MANAGER", sbu_id: "sbu-001" },
};

const FINANCE_MANAGER = {
  id: "finance-user-001",
  user_metadata: { role: "FINANCE_MANAGER" },
};

describe("core-task-06-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a transfer-submitted notification for the Finance queue", async () => {
    mockGetUser.mockResolvedValue(BU_MANAGER);

    const profileChain = makeChain({ data: { sbu_id: "sbu-001" }, error: null });
    const unitChain = makeChain({ data: { sbu_id: "sbu-001", is_active: true }, error: null });
    const productsChain = makeChain({
      data: [{ id: "prod-001", name: "Product One", stock_quantity: 10, unit_cost: 600 }],
      error: null,
    });
    const transferChain = makeChain({
      data: {
        id: "tr-001",
        reference_number: "TRF-2026-10001",
      },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    const settingsChain = makeChain({ data: { value: "1000" }, error: null });
    const sbuChain = makeChain({ data: null, error: null });
    const notificationChain = makeChain({ data: { id: "n-001" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "sbu_units") return unitChain;
      if (table === "products") return productsChain;
      if (table === "transfer_requests") return transferChain;
      if (table === "transfer_line_items") return lineItemsChain;
      if (table === "app_settings") return settingsChain;
      if (table === "sbus") return sbuChain;
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
          lines: [{ product_id: "prod-001", requested_quantity: 2 }],
          estimated_value: 500,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "FINANCE_MANAGER",
        type: "transfer_request_submitted",
        related_entity_id: "tr-001",
        is_read: false,
      }),
    ]);
  });

  it("creates goods-issued notifications for BU, Unit Staff, and Finance roles", async () => {
    mockGetUser.mockResolvedValue(WAREHOUSE_MANAGER);
    mockRpc.mockResolvedValue({ data: "issuance-001", error: null });

    const transferChain = makeChain({
      data: { sbu_id: "sbu-001", reference_number: "TRF-2026-10001" },
      error: null,
    });
    const profileListChain = makeChain({ data: [], error: null });
    const notificationChain = makeChain({ data: { id: "n-002" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") return transferChain;
      if (table === "profiles") return profileListChain;
      if (table === "notifications") return notificationChain;
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/issuances/route");
    const res = await POST(
      new Request("http://localhost/api/issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          transfer_request_id: "tr-002",
          items: [{ product_id: "prod-001", quantity_issued: 2 }],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "BU_MANAGER", type: "goods_issued" }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "UNIT_STAFF", type: "goods_issued" }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "FINANCE_MANAGER", type: "goods_issued" }),
    ]);
  });

  it("creates GRN variance notifications for Warehouse Manager and BU Manager", async () => {
    const transferFetchChain = makeChain({
      data: { id: "tr-003", status: "ISSUED", sbu_id: "sbu-001" },
      error: null,
    });
    const transferUpdateChain = makeChain({ data: null, error: null });
    const transferLookupChain = makeChain({ data: { sbu_id: "sbu-001" }, error: null });
    const grnChain = makeChain({ data: { id: "grn-003", has_variance: true }, error: null });
    const lineItemsChain = makeChain({ data: null, error: null });
    const notificationChain = makeChain({ data: { id: "n-003" }, error: null });
    const profileListChain = makeChain({ data: [], error: null });
    let transferRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        transferRequestCalls += 1;
        if (transferRequestCalls === 1) return transferFetchChain;
        if (transferRequestCalls === 2) return transferUpdateChain;
        return transferLookupChain;
      }
      if (table === "grns") return grnChain;
      if (table === "grn_line_items") return lineItemsChain;
      if (table === "notifications") return notificationChain;
      if (table === "profiles") return profileListChain;
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { recordGRN } = await import("../../lib/services/grnService");
    await recordGRN(
      {
        transfer_request_id: "tr-003",
        items: [
          {
            product_id: "prod-001",
            issued_quantity: 5,
            quantity_received: 3,
            variance_notes: "Two units damaged",
          },
        ],
      },
      "unit-user-001",
    );

    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "WAREHOUSE_MANAGER",
        type: "grn_variance",
        related_entity_id: "grn-003",
      }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "BU_MANAGER",
        type: "grn_submitted",
        related_entity_id: "grn-003",
      }),
    ]);
  });

  it("creates return stock-restored notifications for BU, Unit Staff, and Warehouse roles", async () => {
    mockGetUser.mockResolvedValue(FINANCE_MANAGER);
    mockRpc.mockResolvedValue({ data: null, error: null });

    const returnRequestChain = makeChain({
      data: {
        id: "rr-001",
        reference_number: "RTN-2026-10001",
        status: "AWAITING_FINANCE_APPROVAL",
      },
      error: null,
    });
    const notificationChain = makeChain({ data: { id: "n-004" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "return_requests") return returnRequestChain;
      if (table === "notifications") return notificationChain;
      if (table === "audit_logs") return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import("../../app/api/return-requests/[id]/finance-approve/route");
    const res = await POST(
      new Request("http://localhost/api/return-requests/rr-001/finance-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ action: "approve", notes: "Stock credit approved" }),
      }),
      { params: Promise.resolve({ id: "rr-001" }) },
    );

    expect(res.status).toBe(200);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "BU_MANAGER", type: "return_stock_restored" }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "UNIT_STAFF", type: "return_stock_restored" }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_role: "WAREHOUSE_MANAGER", type: "return_stock_restored" }),
    ]);
  });

  it("lists unread direct-or-role notifications and marks them read with the same visibility filter", async () => {
    mockGetUser.mockResolvedValue(BU_MANAGER);

    const unreadNotifications = [
      { id: "n-direct", user_id: "bu-user-001", user_role: null, is_read: false },
      { id: "n-role", user_id: null, user_role: "BU_MANAGER", is_read: false },
    ];
    const unreadChain = makeChain({ data: unreadNotifications, error: null });
    mockFrom.mockReturnValue(unreadChain);

    const { GET, PATCH } = await import("../../app/api/notifications/route");
    const getRes = await GET(
      new Request("http://localhost/api/notifications", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual(unreadNotifications);
    expect(unreadChain.eq).toHaveBeenCalledWith("is_read", false);
    expect(unreadChain.or).toHaveBeenCalledWith("user_id.eq.bu-user-001,user_role.eq.BU_MANAGER");

    const markReadChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(markReadChain);

    const patchRes = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ id: "n-role" }),
      }),
    );

    expect(patchRes.status).toBe(200);
    expect(await patchRes.json()).toEqual({ success: true });
    expect(markReadChain.update).toHaveBeenCalledWith({ is_read: true });
    expect(markReadChain.eq).toHaveBeenCalledWith("id", "n-role");
    expect(markReadChain.or).toHaveBeenCalledWith("user_id.eq.bu-user-001,user_role.eq.BU_MANAGER");
  });
});
