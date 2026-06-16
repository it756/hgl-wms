import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabaseServer", () => ({
  supabaseAdmin: {},
}));

import { buildNotificationEmail } from "../../lib/notifications/emailTemplate";
import { buildDetailMessage } from "../../lib/notifications/messages";

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