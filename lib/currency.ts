/** Base currency for all stored amounts */
export type Currency = "ZMW" | "USD";

const CACHE_KEY_RATE = "zmw_usd_rate";
const CACHE_KEY_TS = "zmw_usd_rate_ts";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Format an amount (always stored in ZMW) for display.
 * When currency is ZMW, displays with the "K" symbol.
 * When currency is USD, converts using the provided rate.
 */
export function formatAmount(
  amount: number | null | undefined,
  currency: Currency,
  rate: number | null
): string {
  if (amount == null) return "—";
  if (currency === "USD") {
    if (rate == null) return "—";
    const converted = amount * rate;
    return `$${converted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `K ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Fetch the live ZMW → USD exchange rate from open.er-api.com.
 * Caches the result in localStorage for 1 hour.
 */
export async function fetchZmwToUsd(): Promise<number> {
  // Check localStorage cache first
  if (typeof window !== "undefined") {
    const cachedRate = localStorage.getItem(CACHE_KEY_RATE);
    const cachedTs = localStorage.getItem(CACHE_KEY_TS);
    if (cachedRate && cachedTs) {
      const age = Date.now() - Number(cachedTs);
      if (age < CACHE_TTL_MS) {
        return Number(cachedRate);
      }
    }
  }

  const res = await fetch("https://open.er-api.com/v6/latest/ZMW");
  if (!res.ok) {
    throw new Error(`Exchange rate API error: ${res.status}`);
  }
  const data = await res.json();
  const usdRate: number = data?.rates?.USD;
  if (!usdRate || typeof usdRate !== "number") {
    throw new Error("Invalid exchange rate response");
  }

  // Cache the result
  if (typeof window !== "undefined") {
    localStorage.setItem(CACHE_KEY_RATE, String(usdRate));
    localStorage.setItem(CACHE_KEY_TS, String(Date.now()));
  }

  return usdRate;
}
