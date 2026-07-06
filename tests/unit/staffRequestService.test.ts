import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNotification, mockFrom, mockWriteAuditLog } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockFrom: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

vi.mock("../../lib/services/auditService", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("../../lib/services/notificationService", () => ({
  createNotification: mockCreateNotification,
}));

type MockChain = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
};

function makeChain(result: unknown, opts: { terminalSelect?: boolean } = {}) {
  const chain = {} as MockChain;
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => (opts.terminalSelect ? Promise.resolve(result) : chain));
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  return chain;
}

describe("staffRequestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates a pending staff request, notification, and audit log", async () => {
    const createdRequest = {
      id: "sr-001",
      requested_by_sbu_id: "sbu-001",
      requested_user_info: {
        full_name: "Jane Staff",
        email: "jane@example.com",
        proposed_role: "UNIT_STAFF",
      },
      requested_roles: ["UNIT_STAFF"],
      status: "PENDING",
      created_by: "manager-001",
    };
    const staffRequestsChain = makeChain({ data: createdRequest, error: null });
    mockFrom.mockReturnValue(staffRequestsChain);

    const { createStaffRequest } = await import("../../lib/services/staffRequestService");

    await expect(
      createStaffRequest(
        {
          requested_user_info: createdRequest.requested_user_info,
          requested_roles: ["UNIT_STAFF"],
          sbu_id: "sbu-001",
          notes: "Needs warehouse access",
        },
        "manager-001",
      ),
    ).resolves.toEqual(createdRequest);

    expect(mockFrom).toHaveBeenCalledWith("staff_requests");
    expect(staffRequestsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        requested_by_sbu_id: "sbu-001",
        requested_roles: ["UNIT_STAFF"],
        status: "PENDING",
        notes: "Needs warehouse access",
        created_by: "manager-001",
      }),
    ]);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_role: "ADMIN",
        type: "staff_request_pending",
        related_entity_id: "sr-001",
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "staff_request",
        entity_id: "sr-001",
        action: "CREATED",
        performed_by: "manager-001",
      }),
    );
  });

  it("rejects invalid requested roles before writing to the database", async () => {
    const { createStaffRequest } = await import("../../lib/services/staffRequestService");

    await expect(
      createStaffRequest(
        {
          requested_user_info: {
            full_name: "Jane Staff",
            email: "jane@example.com",
            proposed_role: "ADMIN",
          },
          requested_roles: ["ADMIN"],
          sbu_id: "sbu-001",
        },
        "manager-001",
      ),
    ).rejects.toThrow("Invalid role: ADMIN");

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("guards approve decisions with a pending-status update filter", async () => {
    const existingRequest = {
      id: "sr-001",
      status: "PENDING",
      created_by: "manager-001",
      requested_user_info: { full_name: "Jane Staff" },
    };
    const fetchChain = makeChain({ data: existingRequest, error: null });
    const updateChain = makeChain({ data: [], error: null }, { terminalSelect: true });
    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

    const { approveStaffRequest } = await import("../../lib/services/staffRequestService");

    await expect(approveStaffRequest("sr-001", "admin-001")).rejects.toThrow(
      "Staff request was already reviewed by another admin",
    );

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED", reviewed_by: "admin-001" }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "sr-001");
    expect(updateChain.eq).toHaveBeenCalledWith("status", "PENDING");
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("guards reject decisions with a pending-status update filter", async () => {
    const existingRequest = {
      id: "sr-001",
      status: "PENDING",
      created_by: "manager-001",
      requested_user_info: { full_name: "Jane Staff" },
    };
    const fetchChain = makeChain({ data: existingRequest, error: null });
    const updateChain = makeChain({ data: [], error: null }, { terminalSelect: true });
    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

    const { rejectStaffRequest } = await import("../../lib/services/staffRequestService");

    await expect(rejectStaffRequest("sr-001", "admin-001", "Duplicate")).rejects.toThrow(
      "Staff request was already reviewed by another admin",
    );

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "REJECTED", reviewed_by: "admin-001", notes: "Duplicate" }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "sr-001");
    expect(updateChain.eq).toHaveBeenCalledWith("status", "PENDING");
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
