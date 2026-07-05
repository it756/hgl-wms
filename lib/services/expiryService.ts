import { supabaseAdmin } from "../supabaseServer";
import { createNotification } from "./notificationService";

export type ExpiryStatus = "expired" | "near_expiry" | "ok";

export interface ExpiryAlertItem {
  supplier_grn_line_item_id: string;
  supplier_grn_id: string;
  grn_reference: string;
  sbu_id: string | null;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity_received: number;
  expiry_date: string;
  days_until_expiry: number;
  expiry_status: ExpiryStatus;
}

/** Number of days before expiry that triggers a near-expiry alert. */
const NEAR_EXPIRY_THRESHOLD_DAYS = 30;

// ─────────────────────────────────────────────
// Query expiry alerts from supplier GRN line items
// ─────────────────────────────────────────────

/**
 * Returns all supplier GRN line items that have an expiry_date set,
 * categorised as expired, near_expiry, or ok.
 *
 * @param thresholdDays - days before expiry to classify as near_expiry (default 30)
 */
export async function getExpiryAlerts(
  thresholdDays = NEAR_EXPIRY_THRESHOLD_DAYS,
  opts?: { sbu_id?: string; status?: ExpiryStatus },
): Promise<ExpiryAlertItem[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_grn_line_items")
    .select(
      `id, supplier_grn_id, quantity_received, expiry_date,
       products(id, name, sku),
       supplier_grns!inner(id, reference_number, sbu_id, status)`,
    )
    .eq("supplier_grns.status", "GRN_APPROVED")
    .not("expiry_date", "is", null)
    .order("expiry_date", { ascending: true });

  if (error) throw error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

  const rows: ExpiryAlertItem[] = [];

  for (const row of data ?? []) {
    const r = row as any;
    const grn = r.supplier_grns;
    const product = r.products;

    if (opts?.sbu_id && grn?.sbu_id !== opts.sbu_id) continue;

    const expiryDate = new Date(r.expiry_date);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let expiryStatus: ExpiryStatus;
    if (daysUntilExpiry < 0) {
      expiryStatus = "expired";
    } else if (daysUntilExpiry <= thresholdDays) {
      expiryStatus = "near_expiry";
    } else {
      expiryStatus = "ok";
    }

    if (opts?.status && expiryStatus !== opts.status) continue;

    rows.push({
      supplier_grn_line_item_id: r.id,
      supplier_grn_id: grn?.id ?? r.supplier_grn_id,
      grn_reference: grn?.reference_number ?? "",
      sbu_id: grn?.sbu_id ?? null,
      product_id: product?.id ?? r.product_id,
      product_name: product?.name ?? "",
      sku: product?.sku ?? null,
      quantity_received: r.quantity_received,
      expiry_date: r.expiry_date,
      days_until_expiry: daysUntilExpiry,
      expiry_status: expiryStatus,
    });
  }

  return rows;
}

// ─────────────────────────────────────────────
// Send expiry notifications
// ─────────────────────────────────────────────

/**
 * Queries all near-expiry and expired GRN line items and dispatches
 * notifications to WAREHOUSE_MANAGER and ADMIN.
 *
 * Intended to be called by a daily cron job via POST /api/admin/expiry/notify.
 *
 * Returns a summary of notifications sent.
 */
export async function sendExpiryNotifications(performedBy: string): Promise<{
  expired: number;
  near_expiry: number;
  notified: number;
}> {
  const alerts = await getExpiryAlerts(NEAR_EXPIRY_THRESHOLD_DAYS, {
    status: undefined, // fetch near_expiry and expired
  });

  const actionable = alerts.filter((a) =>
    a.expiry_status === "expired" || a.expiry_status === "near_expiry",
  );

  if (actionable.length === 0) {
    return { expired: 0, near_expiry: 0, notified: 0 };
  }

  const expiredItems = actionable.filter((a) => a.expiry_status === "expired");
  const nearExpiryItems = actionable.filter((a) => a.expiry_status === "near_expiry");

  let notified = 0;

  // Batch summary notification
  if (expiredItems.length > 0) {
    const message =
      `${expiredItems.length} product batch(es) have EXPIRED and should be written off. ` +
      `Items: ${expiredItems.slice(0, 5).map((i) => i.product_name).join(", ")}` +
      (expiredItems.length > 5 ? ` and ${expiredItems.length - 5} more.` : ".");

    for (const role of ["WAREHOUSE_MANAGER", "ADMIN"] as const) {
      try {
        await createNotification({
          user_role: role,
          type: "stock_expired",
          message,
          dispatchChannels: true,
        });
        notified++;
      } catch (e) {
        console.error(`[expiryService] expired notification failed for ${role}`, e);
      }
    }
  }

  if (nearExpiryItems.length > 0) {
    const message =
      `${nearExpiryItems.length} product batch(es) are expiring within ${NEAR_EXPIRY_THRESHOLD_DAYS} days. ` +
      `Items: ${nearExpiryItems.slice(0, 5).map((i) => `${i.product_name} (${i.days_until_expiry}d)`).join(", ")}` +
      (nearExpiryItems.length > 5 ? ` and ${nearExpiryItems.length - 5} more.` : ".");

    for (const role of ["WAREHOUSE_MANAGER", "ADMIN"] as const) {
      try {
        await createNotification({
          user_role: role,
          type: "stock_near_expiry",
          message,
          dispatchChannels: true,
        });
        notified++;
      } catch (e) {
        console.error(`[expiryService] near_expiry notification failed for ${role}`, e);
      }
    }
  }

  return {
    expired: expiredItems.length,
    near_expiry: nearExpiryItems.length,
    notified,
  };
}
