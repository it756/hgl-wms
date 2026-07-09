import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: vi.fn(),
    auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
  },
  getUserFromAuthHeader: mockGetUser,
}));

type SupabaseChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function makeChain(result: unknown) {
  const chain = {} as SupabaseChain;
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
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
});