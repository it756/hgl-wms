import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: vi.fn(),
    auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
  },
  getUserFromAuthHeader: vi.fn(),
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

describe("core-task-04-grn-submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits an exact GRN for an issued transfer and completes the transfer", async () => {
    const transferFetchChain = makeChain({
      data: { id: "tr-001", status: "ISSUED", sbu_id: "sbu-001" },
      error: null,
    });
    const transferUpdateChain = makeChain({ data: null, error: null });
    const grnChain = makeChain({
      data: {
        id: "grn-001",
        transfer_request_id: "tr-001",
        has_variance: false,
        acknowledged: true,
      },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    const notificationChain = makeChain({ data: { id: "n-001" }, error: null });
    const auditChain = makeChain({ data: null, error: null });
    const lookupChain = makeChain({ data: null, error: null });
    const profilesChain = makeChain({ data: [], error: null });
    let transferRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        transferRequestCalls += 1;
        if (transferRequestCalls === 1) return transferFetchChain;
        if (transferRequestCalls === 2) return transferUpdateChain;
        return lookupChain;
      }
      if (table === "grns") return grnChain;
      if (table === "grn_line_items") return lineItemsChain;
      if (table === "notifications") return notificationChain;
      if (table === "audit_logs") return auditChain;
      if (table === "profiles") return profilesChain;
      return lookupChain;
    });

    const { recordGRN } = await import("../../lib/services/grnService");
    const result = await recordGRN(
      {
        transfer_request_id: "tr-001",
        date_received: "2026-07-20",
        condition_notes: "All items received in good condition",
        items: [{ product_id: "prod-001", issued_quantity: 5, quantity_received: 5 }],
      },
      "unit-user-001",
    );

    expect(result.has_variance).toBe(false);
    expect(grnChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        transfer_request_id: "tr-001",
        received_by: "unit-user-001",
        date_received: "2026-07-20",
        condition_notes: "All items received in good condition",
        has_variance: false,
        acknowledged: true,
      }),
    ]);
    expect(lineItemsChain.insert).toHaveBeenCalledWith([
      {
        grn_id: "grn-001",
        product_id: "prod-001",
        issued_quantity: 5,
        quantity_received: 5,
        variance_notes: null,
      },
    ]);
    expect(transferUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("submits a variance GRN, captures variance notes, and marks transfer completed with variance", async () => {
    const transferFetchChain = makeChain({
      data: { id: "tr-002", status: "ISSUED", sbu_id: "sbu-001" },
      error: null,
    });
    const transferUpdateChain = makeChain({ data: null, error: null });
    const grnChain = makeChain({
      data: {
        id: "grn-002",
        transfer_request_id: "tr-002",
        has_variance: true,
        acknowledged: true,
      },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    const notificationChain = makeChain({ data: { id: "n-002" }, error: null });
    const auditChain = makeChain({ data: null, error: null });
    const lookupChain = makeChain({ data: null, error: null });
    const profilesChain = makeChain({ data: [], error: null });
    let transferRequestCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        transferRequestCalls += 1;
        if (transferRequestCalls === 1) return transferFetchChain;
        if (transferRequestCalls === 2) return transferUpdateChain;
        return lookupChain;
      }
      if (table === "grns") return grnChain;
      if (table === "grn_line_items") return lineItemsChain;
      if (table === "notifications") return notificationChain;
      if (table === "audit_logs") return auditChain;
      if (table === "profiles") return profilesChain;
      return lookupChain;
    });

    const { recordGRN } = await import("../../lib/services/grnService");
    const result = await recordGRN(
      {
        transfer_request_id: "tr-002",
        items: [
          {
            product_id: "prod-001",
            issued_quantity: 5,
            quantity_received: 3,
            variance_notes: "Two units damaged on arrival",
          },
        ],
      },
      "unit-user-001",
    );

    expect(result.has_variance).toBe(true);
    expect(grnChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        transfer_request_id: "tr-002",
        has_variance: true,
        acknowledged: true,
      }),
    ]);
    expect(lineItemsChain.insert).toHaveBeenCalledWith([
      {
        grn_id: "grn-002",
        product_id: "prod-001",
        issued_quantity: 5,
        quantity_received: 3,
        variance_notes: "Two units damaged on arrival",
      },
    ]);
    expect(transferUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED_WITH_VARIANCE" }),
    );
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "WAREHOUSE_MANAGER",
        type: "grn_variance",
        related_entity_id: "grn-002",
      }),
    ]);
    expect(notificationChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_role: "BU_MANAGER",
        type: "grn_submitted",
        related_entity_id: "grn-002",
      }),
    ]);
  });

  it("rejects GRN submission unless the transfer is still issued", async () => {
    const transferFetchChain = makeChain({
      data: { id: "tr-003", status: "COMPLETED", sbu_id: "sbu-001" },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") return transferFetchChain;
      return makeChain({ data: null, error: null });
    });

    const { recordGRN } = await import("../../lib/services/grnService");

    await expect(
      recordGRN(
        {
          transfer_request_id: "tr-003",
          items: [{ product_id: "prod-001", issued_quantity: 5, quantity_received: 5 }],
        },
        "unit-user-001",
      ),
    ).rejects.toThrow("GRN can only be submitted for ISSUED transfers");
    expect(mockFrom).not.toHaveBeenCalledWith("grns");
    expect(mockFrom).not.toHaveBeenCalledWith("grn_line_items");
  });
});
