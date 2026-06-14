"use client";

import { useState, useCallback } from "react";
import { Currency, formatAmount, fetchZmwToUsd } from "@/lib/currency";

interface UseCurrencyReturn {
  currency: Currency;
  rate: number | null;
  fetching: boolean;
  rateError: string | null;
  toggleCurrency: () => void;
  fmt: (amount: number | null | undefined) => string;
}

export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurrency] = useState<Currency>("ZMW");
  const [rate, setRate] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const toggleCurrency = useCallback(async () => {
    if (currency === "ZMW") {
      // Switching to USD — need a rate
      setFetching(true);
      setRateError(null);
      try {
        const usdRate = await fetchZmwToUsd();
        setRate(usdRate);
        setCurrency("USD");
      } catch {
        setRateError("Could not fetch exchange rate. Please try again.");
      } finally {
        setFetching(false);
      }
    } else {
      setCurrency("ZMW");
    }
  }, [currency]);

  const fmt = useCallback(
    (amount: number | null | undefined) => formatAmount(amount, currency, rate),
    [currency, rate],
  );

  return { currency, rate, fetching, rateError, toggleCurrency, fmt };
}
