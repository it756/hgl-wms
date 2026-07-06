import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {},
}));

import { buildNotificationEmail } from "../../lib/notifications/emailTemplate";
import { buildDetailMessage, formatContact, humanizeLabel } from "../../lib/notifications/messages";

describe("notification message formatting", () => {
  it("builds readable detail messages with actor, SBU, location, and products", () => {
    const message = buildDetailMessage({
      headline: "Supplier GRN SGRN-2026-10001 requires Finance approval",
      reference: "SGRN-2026-10001",
      actorLabel: "Received by",
      actorName: "Warehouse Lead",
      sbu: "Finance & Admin (FIN)",
      location: "A1",
      supplier: "Acme Supplies",
      products: [
        {
          name: "Printer Toner",
          sku: "FIN-TONER",
          quantity: 12,
          unit: "units",
          warehouseLocation: "A1",
        },
      ],
      notes: "Invoice checked against delivery note.",
    });

    expect(message).toContain("Received by: Warehouse Lead");
    expect(message).toContain("SBU: Finance & Admin (FIN)");
    expect(message).toContain("Products: 12 units x Printer Toner (FIN-TONER) @ A1");
    expect(message).toContain("Notes: Invoice checked against delivery note.");
  });

  it("appends a variance annotation to product lines when present", () => {
    const message = buildDetailMessage({
      headline: "Goods receipt reported a variance",
      products: [
        {
          name: "Printer Toner",
          sku: "FIN-TONER",
          quantity: 8,
          unit: "units",
          varianceNote: "issued 10, received 8",
        },
      ],
    });

    expect(message).toContain("Products: 8 units x Printer Toner (FIN-TONER) [issued 10, received 8]");
  });

  it("humanizes SCREAMING_SNAKE_CASE and snake_case labels while preserving acronyms", () => {
    expect(humanizeLabel("FINANCE_MANAGER")).toBe("Finance Manager");
    expect(humanizeLabel("transfer_request_pending_bu_approval")).toBe(
      "Transfer Request Pending BU Approval",
    );
    expect(humanizeLabel("supplier_grn_approved")).toBe("Supplier GRN Approved");
    expect(humanizeLabel(null)).toBe("");
  });

  it("formats a contact with name, email, and role", () => {
    expect(
      formatContact({ name: "Jane Doe", email: "jane@company.com", role: "BU_MANAGER" }),
    ).toBe("Jane Doe (jane@company.com) — BU Manager");
  });

  it("degrades gracefully when only some contact fields are present", () => {
    expect(formatContact({ name: "Jane Doe", email: null, role: null })).toBe("Jane Doe");
    expect(formatContact({ name: null, email: "jane@company.com", role: null })).toBe(
      "jane@company.com",
    );
    expect(formatContact({ name: null, email: null, role: null })).toBeNull();
    expect(formatContact(null)).toBeNull();
  });

  it("renders multi-line notification emails as escaped detail rows", () => {
    const html = buildNotificationEmail({
      type: "supplier_grn_awaiting_approval",
      role: "FINANCE_MANAGER",
      message: "Review required\nSupplier: ACME <Main>\nSBU: Finance & Admin",
    });

    expect(html).toContain("Review required");
    expect(html).toContain("<strong>Supplier:</strong> ACME &lt;Main&gt;");
    expect(html).toContain("<strong>SBU:</strong> Finance &amp; Admin");
  });
});