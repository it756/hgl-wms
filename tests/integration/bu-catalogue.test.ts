import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CataloguePage, CatalogueProduct } from "../../lib/catalogue";

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: { rpc },
  getUserFromAuthHeader: getUser,
}));

const sbuId = "ebddccaf-d96c-4b84-9228-6122666b3816";
const otherSbu = "11111111-1111-1111-1111-111111111111";
const product = (index: number): CatalogueProduct => ({
  id: `00000000-0000-0000-0000-${index.toString(16).padStart(12, "0")}`,
  name: "Lace",
  sku: `EJBL-${index}`,
  uom: "unit",
  unit_cost: 20,
  stock_quantity: index % 2,
});

async function query(params = "") {
  const { GET } = await import("../../app/api/bu/catalogue/route");
  return GET(new Request(`http://localhost/api/bu/catalogue${params ? `?${params}` : ""}`));
}

describe("paginated SBU catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ user_metadata: { role: "BU_MANAGER", sbu_id: sbuId } });
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("uses database-side membership filtering and ignores a scoped user's SBU override", async () => {
    const response = await query(`sbu_id=${otherSbu}&search=%20lace%20`);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("search_sbu_catalogue", {
      p_sbu_id: sbuId,
      p_search: "lace",
      p_after_name: null,
      p_after_id: null,
      p_limit: 51,
    });
    expect(await response.json()).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it("retrieves all 1,203 products across bounded pages with duplicate names and zero stock", async () => {
    const catalogue = Array.from({ length: 1203 }, (_, i) => product(i + 1));
    rpc.mockImplementation((_name, args: { p_after_id: string | null; p_limit: number }) => {
      const start = args.p_after_id ? catalogue.findIndex((p) => p.id === args.p_after_id) + 1 : 0;
      return Promise.resolve({ data: catalogue.slice(start, start + args.p_limit), error: null });
    });
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await query(`limit=100${cursor ? `&cursor=${cursor}` : ""}`);
      expect(response.status).toBe(200);
      const page: CataloguePage = await response.json();
      expect(page.items.length).toBeLessThanOrEqual(100);
      expect(page.hasMore).toBe(page.nextCursor !== null);
      ids.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toEqual(catalogue.map((p) => p.id));
    expect(new Set(ids).size).toBe(1203);
    expect(rpc).toHaveBeenCalledTimes(13);
    expect(rpc.mock.calls.every(([, args]) => args.p_limit === 101)).toBe(true);
  });

  it("includes zero-stock products and uses the last emitted row, not the extra row, in the cursor", async () => {
    rpc.mockResolvedValue({ data: [product(2), product(3)], error: null });
    const page: CataloguePage = await (await query("limit=1")).json();
    expect(page.items[0].stock_quantity).toBe(0);
    expect(page.hasMore).toBe(true);
    await query(`limit=1&cursor=${page.nextCursor}`);
    expect(rpc.mock.calls[1][1].p_after_id).toBe(product(2).id);
    expect(rpc.mock.calls[1][1].p_after_name).toBe("Lace");
  });

  it.each([
    "limit=0",
    "limit=101",
    "limit=1.5",
    "limit=NaN",
    "limit=",
    "cursor=",
    "cursor=invalid",
    `search=${"a".repeat(101)}`,
  ])("rejects invalid query %s", async (params) => {
    expect((await query(params)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects cursors reused with a different search or SBU", async () => {
    rpc.mockResolvedValue({ data: [product(1), product(2)], error: null });
    const page: CataloguePage = await (await query("limit=1&search=lace")).json();
    rpc.mockClear();
    expect((await query(`cursor=${page.nextCursor}&search=silk`)).status).toBe(400);
    getUser.mockResolvedValue({ user_metadata: { role: "BU_MANAGER", sbu_id: otherSbu } });
    expect((await query(`cursor=${page.nextCursor}&search=lace`)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "FINANCE_MANAGER", "WAREHOUSE_MANAGER"])(
    "requires explicit scope for %s",
    async (role) => {
      getUser.mockResolvedValue({ user_metadata: { role } });
      expect((await query()).status).toBe(400);
      expect((await query(`sbu_id=${sbuId}`)).status).toBe(200);
    },
  );

  it("allows unit staff only in their SBU and rejects a missing assignment", async () => {
    getUser.mockResolvedValue({ user_metadata: { role: "UNIT_STAFF", sbu_id: sbuId } });
    expect((await query(`sbu_id=${otherSbu}`)).status).toBe(200);
    expect(rpc.mock.calls[0][1].p_sbu_id).toBe(sbuId);
    getUser.mockResolvedValue({ user_metadata: { role: "BU_MANAGER", sbu_id: null } });
    expect((await query()).status).toBe(422);
  });

  it("rejects unauthenticated and forbidden users", async () => {
    getUser.mockResolvedValue(null);
    expect((await query()).status).toBe(401);
    getUser.mockResolvedValue({ user_metadata: { role: "PROCUREMENT" } });
    expect((await query()).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports database failures instead of returning an empty catalogue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      rpc.mockResolvedValue({ data: null, error: { message: "RPC missing" } });
      const response = await query();
      expect(response.status).toBe(500);
      expect(await response.json()).toHaveProperty("error");
      expect(log).toHaveBeenCalled();
      getUser.mockRejectedValue(new Error("Profile query failed"));
      expect((await query()).status).toBe(500);
    } finally {
      log.mockRestore();
    }
  });
});
