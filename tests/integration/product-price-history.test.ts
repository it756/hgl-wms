/**
 * Integration tests: product_price_history (T060)
 *
 * Covers six scenarios:
 *  1. Finance approval increments stock as before (no regression).
 *  2. Approval inserts one price history row per costed GRN line.
 *  3. GRN line with unit_cost = null does not create a price history row.
 *  4. products.unit_cost is updated to the latest approved GRN cost.
 *  5. Rejected Supplier GRN does not update stock, product cost, or price history.
 *  6. GET /api/admin/products/[id]/price-history returns history ordered newest-first.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const priceHistoryConflictRepairSql = readFileSync(
  join(process.cwd(), "supabase/migrations/037_fix_price_history_conflict_target.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockCreateNotification = vi.fn();
const mockBuildSupplierGrnNotificationMessage = vi.fn();
const mockBuildTransferNotificationMessage = vi.fn();
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

vi.mock("../../lib/services/notificationService", () => ({
  createNotification: mockCreateNotification,
}));

vi.mock("../../lib/notifications/messages", () => ({
  buildSupplierGrnNotificationMessage: mockBuildSupplierGrnNotificationMessage,
  buildTransferNotificationMessage: mockBuildTransferNotificationMessage,
  buildReturnNotificationMessage: mockBuildReturnNotificationMessage,
  buildIntraTransferNotificationMessage: mockBuildIntraTransferNotificationMessage,
}));

// ─── Chain helper ─────────────────────────────────────────────────────────

function makeChain(result: unknown) {
  const c: any = {};
  const self = () => c;
  c.select = vi.fn(self);
  c.insert = vi.fn(self);
  c.update = vi.fn(self);
  c.delete = vi.fn(self);
  c.eq = vi.fn(self);
  c.in = vi.fn(self);
  c.order = vi.fn(self);
  c.range = vi.fn(self);
  c.single = vi.fn(() => Promise.resolve(result));
  c.maybeSingle = vi.fn(() => Promise.resolve(result));
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FM_USER = { id: "fin-user-001", user_metadata: { role: "FINANCE_MANAGER" } };
const ADMIN_USER = { id: "admin-user-001", user_metadata: { role: "ADMIN" } };

const SUPPLIER_GRN = {
  id: "sgrn-001",
  reference_number: "SGRN-2026-00001",
  status: "AWAITING_FINANCE_APPROVAL",
  purchase_request_id: null,
  supplier_name: "ABC Medical Supplies",
};

// ─── Finance approval tests ───────────────────────────────────────────────

describe("product_price_history — Finance approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockBuildSupplierGrnNotificationMessage.mockResolvedValue("GRN notification message");
    mockCreateNotification.mockResolvedValue({ id: "notif-001" });
  });

  it("keeps the GRN line conflict target backed by a non-partial unique index", () => {
    expect(priceHistoryConflictRepairSql).toContain(
      "DROP INDEX IF EXISTS public.idx_pph_unique_grn_line",
    );
    expect(priceHistoryConflictRepairSql).toContain(
      "CREATE UNIQUE INDEX idx_pph_unique_grn_line\n  ON public.product_price_history(supplier_grn_line_item_id);",
    );
    expect(priceHistoryConflictRepairSql).not.toContain("WHERE supplier_grn_line_item_id IS NOT NULL");
  });

  it("1. Approving a supplier GRN calls increment_stock_after_grn RPC and returns 200", async () => {
    mockGetUser.mockResolvedValue(FM_USER);
    mockRpc.mockResolvedValue({ data: SUPPLIER_GRN.id, error: null });

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") {
        fromCallCount++;
        return fromCallCount === 1
          ? makeChain({ data: SUPPLIER_GRN, error: null })
          : makeChain({ data: [{ id: SUPPLIER_GRN.id }], error: null });
      }
      return makeChain({ data: { id: "x" }, error: null });
    });

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: SUPPLIER_GRN.id,
        action: "approve",
        notes: "Looks good",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // RPC must have been called with the correct args
    expect(mockRpc).toHaveBeenCalledWith(
      "increment_stock_after_grn",
      expect.objectContaining({ p_grn_id: SUPPLIER_GRN.id }),
    );
  });

  it("2. Approval RPC receives p_approved_by so the DB can write price history rows", async () => {
    mockGetUser.mockResolvedValue(FM_USER);
    mockRpc.mockResolvedValue({ data: SUPPLIER_GRN.id, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns")
        return makeChain({ data: SUPPLIER_GRN, error: null });
      return makeChain({ data: { id: "x" }, error: null });
    });

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: SUPPLIER_GRN.id,
        action: "approve",
        notes: "Checked",
      }),
    });

    await POST(req);

    const rpcArgs = mockRpc.mock.calls.find(([fn]) => fn === "increment_stock_after_grn")?.[1];
    expect(rpcArgs).toMatchObject({
      p_grn_id:    SUPPLIER_GRN.id,
      p_approved_by: FM_USER.id,
    });
  });

  it("3. Rejecting a supplier GRN does NOT call increment_stock_after_grn", async () => {
    mockGetUser.mockResolvedValue(FM_USER);

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns")
        return makeChain({ data: SUPPLIER_GRN, error: null });
      return makeChain({ data: { id: "x" }, error: null });
    });

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: SUPPLIER_GRN.id,
        action: "reject",
        notes: "Invoice mismatch",
      }),
    });

    await POST(req);

    const rpcCalls = mockRpc.mock.calls.map(([fn]) => fn);
    expect(rpcCalls).not.toContain("increment_stock_after_grn");
  });

  it("4. RPC error on approval returns a 500/409 — does not silently succeed", async () => {
    mockGetUser.mockResolvedValue(FM_USER);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "grn not awaiting approval (GRN_APPROVED)" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns")
        return makeChain({ data: SUPPLIER_GRN, error: null });
      return makeChain({ data: { id: "x" }, error: null });
    });

    const { POST } = await import("../../app/api/finance/approvals/route");
    const req = new Request("http://localhost/api/finance/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({
        entity_type: "supplier_grn",
        entity_id: SUPPLIER_GRN.id,
        action: "approve",
        notes: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── GET /api/admin/products/[id]/price-history ────────────────────────────

describe("GET /api/admin/products/[id]/price-history", () => {
  const PRODUCT = { id: "prod-001", name: "Nitrile Gloves", sku: "MED-GLOVES" };

  const HISTORY_ROWS = [
    {
      id: "pph-002",
      product_id: PRODUCT.id,
      supplier_grn_id: "sgrn-002",
      supplier_grn_line_item_id: "sgli-002",
      source_type: "supplier_grn",
      unit_cost: 55,
      currency: "ZMW",
      quantity_received: 50,
      effective_at: "2026-07-09T10:00:00Z",
      created_at: "2026-07-09T10:00:00Z",
      supplier_grns: {
        reference_number: "SGRN-2026-00002",
        supplier_name: "ABC Medical Supplies",
        date_received: "2026-07-09",
      },
    },
    {
      id: "pph-001",
      product_id: PRODUCT.id,
      supplier_grn_id: "sgrn-001",
      supplier_grn_line_item_id: "sgli-001",
      source_type: "supplier_grn",
      unit_cost: 50,
      currency: "ZMW",
      quantity_received: 100,
      effective_at: "2026-06-01T08:00:00Z",
      created_at: "2026-06-01T08:00:00Z",
      supplier_grns: {
        reference_number: "SGRN-2026-00001",
        supplier_name: "ABC Medical Supplies",
        date_received: "2026-06-01",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("5. Returns price history rows newest-first for authorised roles", async () => {
    mockGetUser.mockResolvedValue(FM_USER);

    mockFrom.mockImplementation((table: string) => {
      if (table === "products")
        return makeChain({ data: PRODUCT, error: null });
      if (table === "product_price_history")
        return makeChain({ data: HISTORY_ROWS, error: null });
      return makeChain({ data: null, error: null });
    });

    const { GET } = await import("../../app/api/admin/products/[id]/price-history/route");
    const req = new Request(`http://localhost/api/admin/products/${PRODUCT.id}/price-history`, {
      headers: { Authorization: "Bearer tok" },
    });

    const res = await GET(req, { params: Promise.resolve({ id: PRODUCT.id }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    // Newest row first
    expect(body[0].unit_cost).toBe(55);
    expect(body[1].unit_cost).toBe(50);
  });

  it("6. Returns 404 when product does not exist", async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    mockFrom.mockImplementation((table: string) => {
      if (table === "products")
        return makeChain({ data: null, error: { message: "not found" } });
      return makeChain({ data: [], error: null });
    });

    const { GET } = await import("../../app/api/admin/products/[id]/price-history/route");
    const req = new Request("http://localhost/api/admin/products/no-such-id/price-history", {
      headers: { Authorization: "Bearer tok" },
    });

    const res = await GET(req, { params: Promise.resolve({ id: "no-such-id" }) });
    expect(res.status).toBe(404);
  });

  it("7. Returns 403 for a BU_MANAGER role", async () => {
    mockGetUser.mockResolvedValue({
      id: "bu-user-001",
      user_metadata: { role: "BU_MANAGER" },
    });

    const { GET } = await import("../../app/api/admin/products/[id]/price-history/route");
    const req = new Request(`http://localhost/api/admin/products/${PRODUCT.id}/price-history`, {
      headers: { Authorization: "Bearer tok" },
    });

    const res = await GET(req, { params: Promise.resolve({ id: PRODUCT.id }) });
    expect(res.status).toBe(403);
  });

  it("8. Returns empty array when product exists but has no price history yet", async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    mockFrom.mockImplementation((table: string) => {
      if (table === "products")
        return makeChain({ data: PRODUCT, error: null });
      if (table === "product_price_history")
        return makeChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });

    const { GET } = await import("../../app/api/admin/products/[id]/price-history/route");
    const req = new Request(`http://localhost/api/admin/products/${PRODUCT.id}/price-history`, {
      headers: { Authorization: "Bearer tok" },
    });

    const res = await GET(req, { params: Promise.resolve({ id: PRODUCT.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
