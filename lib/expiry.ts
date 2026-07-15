export type ExpiryStatus = "expired" | "expiring_soon" | "ok";

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

/** Classifies an expiry_date against today. Returns null when there is no expiry date. */
export function getExpiryStatus(
  expiryDate: string | null | undefined,
  thresholdDays = EXPIRING_SOON_THRESHOLD_DAYS,
): ExpiryStatus | null {
  if (!expiryDate) return null;
  const days = getDaysUntilExpiry(expiryDate);
  if (days < 0) return "expired";
  if (days <= thresholdDays) return "expiring_soon";
  return "ok";
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  ok: "Fresh",
};

export const EXPIRY_STATUS_COLORS: Record<ExpiryStatus, string> = {
  expired: "bg-rose-100 text-rose-700 border border-rose-200",
  expiring_soon: "bg-amber-50 text-amber-700 border border-amber-200",
  ok: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
