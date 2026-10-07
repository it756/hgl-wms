"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fetchCataloguePage, type CataloguePage, type CatalogueProduct } from "@/lib/catalogue";

interface Props {
  value: CatalogueProduct | null;
  onChange: (product: CatalogueProduct | null) => void;
  label?: string;
  required?: boolean;
  excludeIds?: string[];
  requireStock?: boolean;
  selectedIds?: string[];
}

export default function CatalogueProductPicker({
  value,
  onChange,
  label = "Product",
  required = false,
  excludeIds = [],
  requireStock = false,
  selectedIds,
}: Props) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<CataloguePage>({ items: [], hasMore: false, nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const normalizedSearch = search.trim();

  function resetResults() {
    setPage({ items: [], hasMore: false, nextCursor: null });
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    const current = ++generation.current;
    request.current?.abort();
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      try {
        const result = await fetchCataloguePage(normalizedSearch, null, controller.signal);
        if (current === generation.current && !controller.signal.aborted) setPage(result);
      } catch (err) {
        if (current === generation.current && !controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not load the product catalogue.");
        }
      } finally {
        if (current === generation.current && !controller.signal.aborted) {
          busy.current = false;
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
      request.current?.abort();
    };
  }, [normalizedSearch, retry]);

  async function loadMore() {
    if (!page.nextCursor || busy.current) return;
    busy.current = true;
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCataloguePage(normalizedSearch, page.nextCursor, controller.signal);
      if (current === generation.current && !controller.signal.aborted) {
        setPage((previous) => ({
          ...result,
          items: [...new Map([...previous.items, ...result.items].map((p) => [p.id, p])).values()],
        }));
      }
    } catch (err) {
      if (current === generation.current && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Could not load more products.");
      }
    } finally {
      if (current === generation.current && !controller.signal.aborted) {
        busy.current = false;
        setLoading(false);
      }
    }
  }

  const options = [
    ...new Map([...(value ? [value] : []), ...page.items].map((p) => [p.id, p])).values(),
  ].filter((p) => p.id === value?.id || !excludeIds.includes(p.id));
  const controlClass =
    "w-full border border-outline-variant rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={`${id}-search`} className="text-xs font-medium text-slate-600">
        Search {label.toLowerCase()} by name or SKU
      </label>
      <input
        id={`${id}-search`}
        type="search"
        value={search}
        maxLength={100}
        onChange={(event) => {
          if (event.target.value.trim() !== normalizedSearch) resetResults();
          setSearch(event.target.value);
        }}
        placeholder="Type a name or SKU"
        className={`${controlClass} placeholder:text-slate-500`}
      />
      <label
        htmlFor={selectedIds ? undefined : `${id}-product`}
        id={`${id}-label`}
        className="text-xs font-medium text-slate-600"
      >
        {label}
        {required ? " *" : ""}
      </label>
      {selectedIds ? (
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          aria-busy={loading}
          aria-describedby={`${id}-status`}
          className="border border-outline-variant rounded-lg bg-white max-h-52 overflow-y-auto divide-y divide-outline-variant"
        >
          {options.map((product) => (
            <label
              key={product.id}
              className="flex items-start gap-2 px-3 py-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(product.id)}
                disabled={
                  requireStock && product.stock_quantity <= 0 && !selectedIds.includes(product.id)
                }
                onChange={() => onChange(product)}
                className="mt-1 accent-primary"
              />
              <span className="min-w-0 break-words">
                {product.name} <span className="font-mono">({product.sku})</span>
                <span className="block text-xs text-slate-600">
                  {product.uom} -{" "}
                  {product.stock_quantity > 0
                    ? `${product.stock_quantity} in stock`
                    : "out of stock"}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <select
          id={`${id}-product`}
          value={value?.id ?? ""}
          required={required}
          aria-describedby={`${id}-status`}
          aria-busy={loading}
          onChange={(event) => onChange(options.find((p) => p.id === event.target.value) ?? null)}
          className={controlClass}
        >
          <option value="">Select product...</option>
          {options.map((product) => (
            <option
              key={product.id}
              value={product.id}
              disabled={requireStock && product.stock_quantity <= 0 && product.id !== value?.id}
            >
              {product.name} ({product.sku}) - {product.uom}
              {requireStock
                ? ` - ${product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "out of stock"}`
                : ""}
            </option>
          ))}
        </select>
      )}
      <div id={`${id}-status`} aria-live="polite" className="text-xs text-slate-600">
        {loading ? (
          "Loading products..."
        ) : error ? (
          <span className="text-rose-700">
            {error}{" "}
            <button
              type="button"
              onClick={() => {
                if (page.nextCursor) {
                  void loadMore();
                } else {
                  resetResults();
                  setRetry((n) => n + 1);
                }
              }}
              className="font-semibold underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Retry
            </button>
          </span>
        ) : page.items.length === 0 ? (
          normalizedSearch ? (
            "No matching products. Try another name or SKU."
          ) : (
            "No products in your SBU catalogue. Contact your Warehouse Manager."
          )
        ) : (
          `${page.items.length} products loaded. Search to narrow results.`
        )}
      </div>
      {page.hasMore && !error && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="self-start text-xs font-semibold text-primary underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          Load more products
        </button>
      )}
    </div>
  );
}
