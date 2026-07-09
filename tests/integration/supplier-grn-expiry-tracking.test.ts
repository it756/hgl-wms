import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockCreateNotification = vi.fn();
const mockBuildSupplierGrnNotificationMessage = vi.fn();

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
}));

type SupabaseChain = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

function makeChain(result: unknown) {
  const chain = {} as SupabaseChain;
  const self = () => chain;
  chain.insert = vi.fn(self);
  chain.select = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const WAREHOUSE_MANAGER = {
  id: "warehouse-user-001",
  user_metadata: { role: "WAREHOUSE_MANAGER" },
};

describe("supplier GRN expiry tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockBuildSupplierGrnNotificationMessage.mockResolvedValue("Supplier GRN notification");
    mockCreateNotification.mockResolvedValue({ id: "notification-001" });
  });

  it("returns supplier GRN line-item expiry dates for edit mode", async () => {
    const supplierGrn = {
      id: "sgrn-001",
      reference_number: "SGRN-2026-00001",
      supplier_grn_line_items: [
        {
          id: "line-001",
          product_id: "prod-001",
          quantity_received: 12,
          unit_cost: 4.5,
          expiry_date: "2026-12-31",
        },
      ],
    };

    const supplierGrnChain = makeChain({ data: supplierGrn, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") return supplierGrnChain;
      return makeChain({ data: null, error: null });
    });
    mockGetUser.mockResolvedValue(WAREHOUSE_MANAGER);

    const { GET } = await import("../../app/api/supplier-grns/[id]/route");
    const res = await GET(new Request("http://localhost/api/supplier-grns/sgrn-001"), {
      params: Promise.resolve({ id: "sgrn-001" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(supplierGrnChain.select).toHaveBeenCalledWith(
      expect.stringContaining("expiry_date"),
    );
    expect(body.supplier_grn_line_items[0].expiry_date).toBe("2026-12-31");
  });

  it("falls back to direct inserts when create_supplier_grn_atomic is missing from schema cache", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the function public.create_supplier_grn_atomic(p_actor_id, p_date_received, p_invoice_amount, p_items, p_reference_number, p_sbu_id, p_supplier_invoice_reference, p_supplier_name) in the schema cache",
      },
    });

    const supplierGrnChain = makeChain({
      data: { id: "sgrn-001", reference_number: "SGRN-2026-00001" },
      error: null,
    });
    const lineItemsChain = makeChain({ data: null, error: null });
    const auditChain = makeChain({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "supplier_grns") return supplierGrnChain;
      if (table === "supplier_grn_line_items") return lineItemsChain;
      if (table === "audit_logs") return auditChain;
      return makeChain({ data: null, error: null });
    });
    mockGetUser.mockResolvedValue(WAREHOUSE_MANAGER);

    const { POST } = await import("../../app/api/supplier-grns/route");
    const res = await POST(
      new Request("http://localhost/api/supplier-grns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({
          supplier_name: "Test Supplier",
          supplier_invoice_reference: "INV-001",
          date_received: "2026-07-09",
          items: [
            {
              product_id: "prod-001",
              quantity_expected: 10,
              quantity_received: 8,
              unit_cost: 5,
              expiry_date: "2026-12-31",
            },
          ],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("sgrn-001");
    expect(body.has_packing_variance).toBe(true);
    expect(supplierGrnChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        supplier_name: "Test Supplier",
        status: "AWAITING_FINANCE_APPROVAL",
      }),
    ]);
    expect(lineItemsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        supplier_grn_id: "sgrn-001",
        product_id: "prod-001",
        quantity_received: 8,
        expiry_date: "2026-12-31",
      }),
    ]);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_role: "FINANCE_MANAGER",
        type: "supplier_grn_awaiting_approval",
        related_entity_id: "sgrn-001",
      }),
    );
  });
});