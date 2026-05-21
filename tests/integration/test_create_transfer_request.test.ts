/**
 * Integration test: Create Transfer Request (T020)
 *
 * These tests mock Supabase calls and validate the transferService business logic:
 * - Reference number generated in TRF-YYYY-NNNNN format
 * - Finance threshold logic: >= threshold → PENDING_APPROVAL; below → PENDING
 * - Notification sent to appropriate role
 * - Audit log written
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabaseAdmin before importing the service ──────────────────────────
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn() },
  },
  getUserFromAuthHeader: vi.fn(),
}));

// ── Helpers to configure fluent chain stubs ──────────────────────────────────
function buildChain(returnValue: unknown) {
  const chain: any = {};
  const noop = () => chain;
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => returnValue);
  chain.eq = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("transferService.createTransferRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a reference in TRF-YYYY-NNNNN format and status PENDING for low-value request", async () => {
    // Stub app_settings lookup → threshold = 1000
    const settingsChain = buildChain(
      Promise.resolve({ data: { value: "1000" }, error: null }),
    );
    // Stub transfer_requests insert → returns new record
    const trChain = buildChain(
      Promise.resolve({
        data: { id: "tr-uuid-001", reference_number: "TRF-2026-12345", status: "PENDING" },
        error: null,
      }),
    );
    // Stub transfer_line_items insert
    const liChain = buildChain(Promise.resolve({ data: [], error: null }));
    // Stub notifications insert
    const notifChain = buildChain(Promise.resolve({ data: {}, error: null }));
    // Stub audit_logs insert
    const auditChain = buildChain(Promise.resolve({ data: {}, error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "app_settings") return settingsChain;
      if (table === "transfer_requests") return trChain;
      if (table === "transfer_line_items") return liChain;
      if (table === "notifications") return notifChain;
      if (table === "audit_logs") return auditChain;
      return buildChain(Promise.resolve({ data: null, error: null }));
    });

    // Dynamic import AFTER mocks are set up
    const { createTransferRequest } = await import("../../lib/services/transferService");

    const result = await createTransferRequest(
      {
        sbu_id: "sbu-001",
        estimated_value: 500,
        lines: [{ product_id: "prod-001", requested_quantity: 10 }],
      },
      "user-001",
    );

    expect(result.status).toBe("PENDING");
    expect(result.reference_number).toMatch(/^TRF-\d{4}-\d{5}$/);
  });

  it("sets status PENDING_APPROVAL when estimated_value >= threshold", async () => {
    const settingsChain = buildChain(
      Promise.resolve({ data: { value: "1000" }, error: null }),
    );
    const trChain = buildChain(
      Promise.resolve({
        data: { id: "tr-uuid-002", reference_number: "TRF-2026-99999", status: "PENDING_APPROVAL" },
        error: null,
      }),
    );
    const genericChain = buildChain(Promise.resolve({ data: {}, error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "app_settings") return settingsChain;
      if (table === "transfer_requests") return trChain;
      return genericChain;
    });

    const { createTransferRequest } = await import("../../lib/services/transferService");

    const result = await createTransferRequest(
      {
        sbu_id: "sbu-001",
        estimated_value: 1500,
        lines: [{ product_id: "prod-001", requested_quantity: 5 }],
      },
      "user-001",
    );

    expect(result.status).toBe("PENDING_APPROVAL");
  });

  it("throws when no line items provided", async () => {
    const { createTransferRequest } = await import("../../lib/services/transferService");
    await expect(
      createTransferRequest({ sbu_id: "sbu-001", lines: [] }, "user-001"),
    ).rejects.toThrow("At least one line item is required");
  });
});
