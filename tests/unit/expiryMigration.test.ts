import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/033_reimplement_expiry_tracking.sql"),
  "utf8",
);

describe("expiry tracking migration", () => {
  it("updates product expiry date when supplier GRN approval increments stock", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.increment_stock_after_grn");
    expect(migrationSql).toContain("expiry_date = CASE");
    expect(migrationSql).toContain("LEAST(expiry_date, v_line.expiry_date)");
  });

  it("validates supplier GRN line ownership during expiry write-off", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.expire_product_batch_atomic");
    expect(migrationSql).toContain("supplier GRN line item does not belong to product");
    expect(migrationSql).toContain("quantity_expired exceeds supplier GRN line quantity");
    expect(migrationSql).toContain("v_effective_expiry_date := COALESCE(p_expiry_date, v_batch_expiry_date)");
  });
});