/**
 * Integration test: Finance Approval Flows (T050)
 *
 * Tests /api/finance/approvals POST endpoint:
 * - Approve / reject a transfer_request
 * - Approve a supplier_grn (must call stock increment RPC)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockWriteAuditLog = vi.fn();
const mockCreateNotification = vi.fn();
const mockBuildTransferNotificationMessage = vi.fn();
const mockBuildSupplierGrnNotificationMessage = vi.fn();
const mockBuildReturnNotificationMessage = vi.fn();
const mockBuildIntraTransferNotificationMessage = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
  },
  getUserFromAuthHeader: mockGetUser,
}));

vi.mock("../../lib/services/auditService", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("../../lib/services/notificationService", () => ({
  createNotification: mockCreateNotification,
}));

vi.mock("../../lib/notifications/messages", () => ({
  buildTransferNotificationMessage: mockBuildTransferNotificationMessage,
  buildSupplierGrnNotificationMessage: mockBuildSupplierGrnNotificationMessage,
  buildReturnNotificationMessage: mockBuildReturnNotificationMessage,
  buildIntraTransferNotificationMessage: mockBuildIntraTransferNotificationMessage,
}));

/** Thenable Supabase chain — every method returns itself; awaiting resolves to `result`. */
function makeChain(result: unknown) {
  const c: any = {};
  const self = () => c;
  c.select = vi.fn(self);
  c.insert = vi.fn(self);
  c.update = vi.fn(self);
  c.eq = vi.fn(self);
  c.in = vi.fn(self);
  c.order = vi.fn(self);
  c.range = vi.fn(self);
  c.single = vi.fn(() => Promise.resolve(result));
  c.maybeSingle = vi.fn(() => Promise.resolve(result));
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

const FM_USER = { id: "fin-user-001", user_metadata: { role: "FINANCE_MANAGER" } };

describe("Finance Approval — transfer_request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves a PENDING_APPROVAL transfer → 200 with APPROVED_FOR_ISSUE", async () => {
    const tr = { id: "tr-001", status: "PENDING_APPROVAL", reference_number: "TRF-2026-00001" };

    // Call 1: fetch TR (.select().eq().single())  → tr data
    // Call 2: update TR (.update().eq())           → void success
    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        fromCallCount++;
        return fromCallCount === 1
          ? makeChain({ data: tr, error: null })
          : makeChain({ data: [{ id: tr.id }], error: null });
      }
      if (table === "profiles") return makeChain({ data: [], error: null });
      // notifications + audit_logs
      return makeChain({ data: { id: "x" }, error: null });
    });
    mockGetUser.mockResolvedValue(FM_USER);

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "transfer_request",
        entity_id: "tr-001",
        action: "approve",
        notes: "OK",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("APPROVED_FOR_ISSUE");
  });

  it("rejects a PENDING_APPROVAL transfer → 200 with CANCELLED", async () => {
    const tr = { id: "tr-002", status: "PENDING_APPROVAL", reference_number: "TRF-2026-00002" };
    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "transfer_requests") {
        fromCallCount++;
        return fromCallCount === 1
          ? makeChain({ data: tr, error: null })
          : makeChain({ data: [{ id: tr.id }], error: null });
      }
      if (table === "profiles") return makeChain({ data: [], error: null });
      return makeChain({ data: { id: "x" }, error: null });
    });
    mockGetUser.mockResolvedValue(FM_USER);

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "transfer_request",
        entity_id: "tr-002",
        action: "reject",
        notes: "Over budget",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("CANCELLED");
  });
});

describe("Finance Approval — supplier_grn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: "notif-001" });
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockBuildTransferNotificationMessage.mockResolvedValue("transfer notification");
    mockBuildSupplierGrnNotificationMessage.mockResolvedValue("supplier grn notification");
    mockBuildReturnNotificationMessage.mockResolvedValue("return notification");
    mockBuildIntraTransferNotificationMessage.mockResolvedValue("intra transfer notification");
  });

  it("approving a supplier GRN calls increment_stock_after_grn RPC", async () => {
    const sgrn = {
      id: "sgrn-001",
      status: "AWAITING_FINANCE_APPROVAL",
      reference_number: "SGRN-2026-00001",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") return makeChain({ data: sgrn, error: null });
      if (table === "profiles") return makeChain({ data: [], error: null });
      // notifications + audit_logs
      return makeChain({ data: { id: "x" }, error: null });
    });
    // RPC succeeds on first attempt
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue(FM_USER);

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: "sgrn-001",
        action: "approve",
        notes: "Invoice ok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("increment_stock_after_grn", {
      p_grn_id: "sgrn-001",
      p_approved_by: "fin-user-001",
      p_approval_notes: "Invoice ok",
    });
  });

  it("marks the linked purchase request as PARTIALLY_RECEIVED when another product is still short", async () => {
    const purchaseRequestUpdate = makeChain({ data: [{ id: "pr-001" }], error: null });
    const grnLinesChain = makeChain({
      data: [
        { product_id: "prod-a", quantity_received: 6 },
        { product_id: "prod-b", quantity_received: 2 },
      ],
      error: null,
    });
    let supplierGrnCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") {
        supplierGrnCallCount++;
        return supplierGrnCallCount === 1
          ? makeChain({
              data: {
                id: "sgrn-001",
                status: "AWAITING_FINANCE_APPROVAL",
                reference_number: "SGRN-2026-00001",
                purchase_request_id: "pr-001",
              },
              error: null,
            })
          : makeChain({ data: [{ id: "sgrn-previous-001" }], error: null });
      }
      if (table === "purchase_request_line_items") {
        return makeChain({
          data: [
            { product_id: "prod-a", quantity_requested: 5 },
            { product_id: "prod-b", quantity_requested: 4 },
          ],
          error: null,
        });
      }
      if (table === "supplier_grn_line_items") return grnLinesChain;
      if (table === "purchase_requests") return purchaseRequestUpdate;
      return makeChain({ data: { id: "x" }, error: null });
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue(FM_USER);

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "******" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: "sgrn-001",
        action: "approve",
        notes: "Invoice ok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(grnLinesChain.in).toHaveBeenCalledWith("supplier_grn_id", [
      "sgrn-previous-001",
      "sgrn-001",
    ]);
    expect(purchaseRequestUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PARTIALLY_RECEIVED" }),
    );
  });

  it("marks the linked purchase request as RECEIVED only after all products are fully received across approved GRNs", async () => {
    const purchaseRequestUpdate = makeChain({ data: [{ id: "pr-001" }], error: null });
    const grnLinesChain = makeChain({
      data: [
        { product_id: "prod-a", quantity_received: 5 },
        { product_id: "prod-b", quantity_received: 4 },
      ],
      error: null,
    });
    let supplierGrnCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") {
        supplierGrnCallCount++;
        return supplierGrnCallCount === 1
          ? makeChain({
              data: {
                id: "sgrn-001",
                status: "AWAITING_FINANCE_APPROVAL",
                reference_number: "SGRN-2026-00001",
                purchase_request_id: "pr-001",
              },
              error: null,
            })
          : makeChain({ data: [{ id: "sgrn-previous-001" }], error: null });
      }
      if (table === "purchase_request_line_items") {
        return makeChain({
          data: [
            { product_id: "prod-a", quantity_requested: 5 },
            { product_id: "prod-b", quantity_requested: 4 },
          ],
          error: null,
        });
      }
      if (table === "supplier_grn_line_items") return grnLinesChain;
      if (table === "purchase_requests") return purchaseRequestUpdate;
      return makeChain({ data: { id: "x" }, error: null });
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue(FM_USER);

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "******" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: "sgrn-001",
        action: "approve",
        notes: "Invoice ok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(grnLinesChain.in).toHaveBeenCalledWith("supplier_grn_id", [
      "sgrn-previous-001",
      "sgrn-001",
    ]);
    expect(purchaseRequestUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RECEIVED" }),
    );
  });
});
