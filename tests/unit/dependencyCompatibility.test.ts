// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";
import * as XLSX from "../../scripts/seed/workbook";

describe("patched dependency compatibility", () => {
  it("reads inventory workbooks with the seed scripts' row conversion options", () => {
    const directory = mkdtempSync(join(tmpdir(), "hgl-wms-workbook-"));
    try {
      const filename = join(directory, "inventory.xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          ["Product", "Quantity", "Unit cost", "Notes"],
          ["Rice", 12, 25.5, "Dry storage"],
          ["Oil", 0, 10],
        ]),
        "Stock",
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
      XLSX.writeFile(workbook, filename);

      const loaded = XLSX.readFile(filename);
      expect(loaded.SheetNames).toEqual(["Stock", "Empty"]);
      expect(XLSX.utils.sheet_to_json(loaded.Sheets.Stock, { header: 1, defval: null })).toEqual([
        ["Product", "Quantity", "Unit cost", "Notes"],
        ["Rice", 12, 25.5, "Dry storage"],
        ["Oil", 0, 10, null],
      ]);
      expect(XLSX.utils.sheet_to_json(loaded.Sheets.Empty, { header: 1, defval: null })).toEqual(
        [],
      );
      expect(readFileSync(filename).length).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("preserves mail envelopes and base64 HTML encoding without sending SMTP traffic", async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const html = `<a href="https://example.com/review/${"a".repeat(96)}">Review request</a>`;
    const result = await transport.sendMail({
      from: "WMS <wms@example.com>",
      to: '"Warehouse, Manager" <warehouse@example.com>',
      subject: "Transfer request",
      html,
      textEncoding: "base64",
    });

    expect(result.envelope).toEqual({
      from: "wms@example.com",
      to: ["warehouse@example.com"],
    });
    const message = result.message.toString();
    expect(message).toContain("Content-Type: text/html");
    expect(message).toContain("Content-Transfer-Encoding: base64");
    const body = message.split("\r\n\r\n").slice(1).join("\r\n\r\n");
    expect(Buffer.from(body.replace(/\s/g, ""), "base64").toString()).toBe(html);
  });
});
