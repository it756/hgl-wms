"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CatalogueProductPicker from "@/components/CatalogueProductPicker";
import type { CatalogueProduct } from "@/lib/catalogue";
import {
  Plus,
  Trash,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
} from "lucide-react";

interface SBUUnit {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface DestinationProduct {
  product_id: string;
  requested_quantity: number;
}

interface DestinationCard {
  unitId: string;
  products: DestinationProduct[];
  collapsed: boolean;
  copyOpenFor: string | null;
  copyTargets: string[];
}

const PENDING_KEY = "pending_transfer_request";

export default function NewMultiStationRequestPage() {
  const router = useRouter();

  const [units, setUnits] = useState<SBUUnit[]>([]);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [pickerUnitId, setPickerUnitId] = useState("");
  const [destinations, setDestinations] = useState<DestinationCard[]>([]);
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isUnitStaff, setIsUnitStaff] = useState(false);
  const [homeUnitId, setHomeUnitId] = useState<string>("");

  const seededOnceRef = useRef(false);

  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem("access_token");
      const role = localStorage.getItem("user_role") ?? "";
      const home = localStorage.getItem("user_unit_id") ?? "";
      setIsUnitStaff(role === "UNIT_STAFF");
      setHomeUnitId(home);
      try {
        const unitsRes = await fetch("/api/bu/units", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (unitsRes.ok) {
          const list: SBUUnit[] = (await unitsRes.json()) || [];
          setUnits(list);
          if (!seededOnceRef.current) {
            seededOnceRef.current = true;
            const seed = list.find((u) => u.id === home && u.is_active !== false);
            if (seed) {
              setDestinations([makeCard(seed.id)]);
            }
          }
        } else {
          let msg = "Could not load units.";
          try {
            const d = await unitsRes.json();
            msg = d.error || msg;
          } catch {
            /* HTML error */
          }
          setUnitsError(msg);
        }
      } catch (err) {
        console.error("Data prefetch failed", err);
      }
    }
    loadData();
  }, []);

  const productById = useMemo(() => {
    const m = new Map<string, CatalogueProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const unitById = useMemo(() => {
    const m = new Map<string, SBUUnit>();
    for (const u of units) m.set(u.id, u);
    return m;
  }, [units]);

  const availableUnitsForPicker = units.filter(
    (u) =>
      u.is_active !== false &&
      !destinations.some((d) => d.unitId === u.id) &&
      // UNIT_STAFF may only order for their own home unit — the API doesn't
      // block cross-unit orders (only cross-SBU) so we enforce the policy here.
      (!isUnitStaff || u.id === homeUnitId),
  );

  // Aggregate qty per product across all destinations — the API-side stock
  // check sums the same way, so this must match to prevent surprise 422s.
  const totalRequestedByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of destinations) {
      for (const p of d.products) {
        if (!p.product_id) continue;
        totals.set(p.product_id, (totals.get(p.product_id) ?? 0) + (p.requested_quantity || 0));
      }
    }
    return totals;
  }, [destinations]);

  function productExceedsStock(productId: string): boolean {
    const product = productById.get(productId);
    if (!product) return false;
    return (totalRequestedByProduct.get(productId) ?? 0) > (product.stock_quantity ?? 0);
  }

  const hasOverStock = useMemo(() => {
    for (const [pid] of totalRequestedByProduct) if (productExceedsStock(pid)) return true;
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRequestedByProduct, productById]);

  const estimatedValue = useMemo(() => {
    let sum = 0;
    for (const d of destinations) {
      for (const p of d.products) {
        const cost = productById.get(p.product_id)?.unit_cost ?? 0;
        sum += cost * (p.requested_quantity || 0);
      }
    }
    return sum;
  }, [destinations, productById]);

  function makeCard(unitId: string): DestinationCard {
    return {
      unitId,
      products: [],
      collapsed: false,
      copyOpenFor: null,
      copyTargets: [],
    };
  }

  function addDestination() {
    if (!pickerUnitId) return;
    if (destinations.some((d) => d.unitId === pickerUnitId)) return;
    setDestinations((prev) => [
      ...prev.map((d) => ({ ...d, collapsed: true, copyOpenFor: null, copyTargets: [] })),
      makeCard(pickerUnitId),
    ]);
    setPickerUnitId("");
  }

  function removeDestination(unitId: string) {
    if (isUnitStaff && unitId === homeUnitId) return;
    setDestinations((prev) => prev.filter((d) => d.unitId !== unitId));
  }

  function toggleCollapsed(unitId: string) {
    setDestinations((prev) =>
      prev.map((d) => (d.unitId === unitId ? { ...d, collapsed: !d.collapsed } : d)),
    );
  }

  function toggleProduct(unitId: string, productId: string) {
    setDestinations((prev) =>
      prev.map((d) => {
        if (d.unitId !== unitId) return d;
        const has = d.products.some((p) => p.product_id === productId);
        return {
          ...d,
          products: has
            ? d.products.filter((p) => p.product_id !== productId)
            : [...d.products, { product_id: productId, requested_quantity: 1 }],
        };
      }),
    );
  }

  function updateQty(unitId: string, productId: string, qty: number) {
    setDestinations((prev) =>
      prev.map((d) => {
        if (d.unitId !== unitId) return d;
        return {
          ...d,
          products: d.products.map((p) =>
            p.product_id === productId ? { ...p, requested_quantity: Math.max(0, qty) } : p,
          ),
        };
      }),
    );
  }

  function removeProduct(unitId: string, productId: string) {
    setDestinations((prev) =>
      prev.map((d) =>
        d.unitId === unitId
          ? { ...d, products: d.products.filter((p) => p.product_id !== productId) }
          : d,
      ),
    );
  }

  function openCopyMenu(unitId: string, productId: string) {
    setDestinations((prev) =>
      prev.map((d) =>
        d.unitId === unitId
          ? { ...d, copyOpenFor: productId, copyTargets: [] }
          : { ...d, copyOpenFor: null },
      ),
    );
  }

  function closeCopyMenu(unitId: string) {
    setDestinations((prev) =>
      prev.map((d) => (d.unitId === unitId ? { ...d, copyOpenFor: null, copyTargets: [] } : d)),
    );
  }

  function toggleCopyTarget(unitId: string, targetUnitId: string) {
    setDestinations((prev) =>
      prev.map((d) => {
        if (d.unitId !== unitId) return d;
        const has = d.copyTargets.includes(targetUnitId);
        return {
          ...d,
          copyTargets: has
            ? d.copyTargets.filter((id) => id !== targetUnitId)
            : [...d.copyTargets, targetUnitId],
        };
      }),
    );
  }

  function applyCopy(sourceUnitId: string) {
    setDestinations((prev) => {
      const source = prev.find((d) => d.unitId === sourceUnitId);
      if (!source || !source.copyOpenFor) return prev;
      const row = source.products.find((p) => p.product_id === source.copyOpenFor);
      if (!row) return prev;
      const targets = new Set(source.copyTargets);
      return prev.map((d) => {
        if (d.unitId === sourceUnitId) {
          return { ...d, copyOpenFor: null, copyTargets: [] };
        }
        if (!targets.has(d.unitId)) return d;
        const existingIdx = d.products.findIndex((p) => p.product_id === row.product_id);
        if (existingIdx >= 0) {
          return {
            ...d,
            products: d.products.map((p, i) =>
              i === existingIdx ? { ...p, requested_quantity: row.requested_quantity } : p,
            ),
          };
        }
        return {
          ...d,
          products: [
            ...d.products,
            { product_id: row.product_id, requested_quantity: row.requested_quantity },
          ],
        };
      });
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (destinations.length === 0) {
      setError("Add at least one destination before submitting.");
      return;
    }

    const empty = destinations.find((d) => d.products.length === 0);
    if (empty) {
      const u = unitById.get(empty.unitId);
      setError(
        `Destination "${u?.name ?? empty.unitId}" has no products — add products or remove it.`,
      );
      return;
    }

    for (const d of destinations) {
      for (const p of d.products) {
        if (!p.product_id || p.requested_quantity < 1) {
          const u = unitById.get(d.unitId);
          setError(`Every product in "${u?.name ?? d.unitId}" needs a quantity of 1 or more.`);
          return;
        }
      }
    }

    if (hasOverStock) {
      const offending: string[] = [];
      for (const [pid] of totalRequestedByProduct) {
        if (productExceedsStock(pid)) {
          const p = productById.get(pid);
          if (p) offending.push(`${p.name} (available ${p.stock_quantity})`);
        }
      }
      setError(
        `Insufficient stock across destinations for: ${offending.join(", ")}. Reduce quantities or drop a destination.`,
      );
      return;
    }

    setSubmitting(true);

    const expandedLines = destinations.flatMap((d) =>
      d.products.map((p) => ({
        product_id: p.product_id,
        requested_quantity: p.requested_quantity,
        destination_unit_id: d.unitId,
      })),
    );

    // First-added destination becomes the row's owner unit — see plan.md.
    const requestingUnitId = destinations[0].unitId;
    const snapshotUnits = destinations
      .map((d) => unitById.get(d.unitId))
      .filter((u): u is SBUUnit => !!u)
      .map((u) => ({ id: u.id, name: u.name, code: u.code }));

    const clientId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const optimistic = {
      clientId,
      status: "SUBMITTING" as const,
      created_at: new Date().toISOString(),
      payload: {
        requesting_unit_id: requestingUnitId,
        required_date: requiredDate || undefined,
        estimated_value: estimatedValue > 0 ? estimatedValue : undefined,
        notes: notes || undefined,
        lines: expandedLines,
      },
      snapshot: {
        units: snapshotUnits,
        estimated_value: estimatedValue > 0 ? estimatedValue : null,
        required_date: requiredDate || null,
      },
    };

    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(optimistic));
    } catch {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/transfer-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(optimistic.payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Submission failed");
        router.push(`/requests?created=${data.reference_number}`);
      } catch (err: any) {
        setError(err.message ?? "Submission failed");
        setSubmitting(false);
      }
      return;
    }

    router.push("/requests");
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <PageHeader
        title="New Multi-Station Request"
        description={
          isUnitStaff
            ? "Your request is locked to your assigned unit. Add products and quantities below."
            : "Raise a single request that fans out to several destination units. Add a destination, pick its products and quantities, then repeat."
        }
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Request Parameters */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 flex flex-col gap-4 shadow-sm">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b border-outline-variant pb-2">
              Request Parameters
            </h3>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                htmlFor="required_date"
              >
                Required Date
              </label>
              <input
                id="required_date"
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Total Value (ZMW)
              </label>
              <div className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-slate-50 font-mono font-bold text-slate-700 select-none">
                {estimatedValue.toLocaleString("en-ZM", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                Auto-calculated across every destination. Transfers at or above the configured SBU
                threshold require Finance approval.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                htmlFor="notes"
              >
                Notes / Justification
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for the request, special handling instructions..."
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline-variant font-medium"
              />
            </div>

            <div className="border-t border-outline-variant pt-3 flex flex-col gap-1">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Destinations added
              </p>
              <p className="text-sm font-extrabold text-slate-700">
                {destinations.length}{" "}
                <span className="text-slate-400 font-semibold">
                  · {destinations.reduce((n, d) => n + d.products.length, 0)} product rows
                </span>
              </p>
              <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                {isUnitStaff
                  ? "As Unit Staff, your request is locked to your assigned unit."
                  : "The first destination you add becomes the request's primary owner. Every distinct destination is shown as a co-owner on the request detail."}
              </p>
            </div>
          </div>

          <div className="bg-sky-50/50 border border-sky-200 rounded-xl p-5 shadow-sm text-sky-900 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-sky-700" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-sky-800">
                Transfer Policy
              </h4>
            </div>
            <ul className="text-xs list-disc pl-4 space-y-1.5 text-sky-950 font-medium">
              <li>All internal transfers must be balanced within 48 hours.</li>
              <li>Transit losses must be reported immediately.</li>
              <li>Warehouse digital signature is mandatory on receipt.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Destination collapsibles */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {isUnitStaff ? (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm text-xs font-semibold text-amber-800 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>
                As Unit Staff, requests are locked to your assigned unit. Ask a BU Manager to raise
                a multi-station request.
              </span>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Add Destination
              </h3>
              {unitsError ? (
                <p className="text-xs text-rose-600 font-semibold">{unitsError}</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={pickerUnitId}
                    onChange={(e) => setPickerUnitId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="">
                      {availableUnitsForPicker.length === 0
                        ? "All available units added"
                        : "Select a destination unit…"}
                    </option>
                    {availableUnitsForPicker.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addDestination}
                    disabled={!pickerUnitId}
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add destination
                  </button>
                </div>
              )}
            </div>
          )}

          {destinations.length === 0 && (
            <div className="bg-white border border-dashed border-outline-variant rounded-xl p-8 text-center text-sm text-slate-500 font-semibold">
              No destinations yet. Add one above to start selecting products.
            </div>
          )}

          {destinations.map((dest, idx) => {
            const unit = unitById.get(dest.unitId);
            const subtotal = dest.products.reduce((sum, p) => {
              const cost = productById.get(p.product_id)?.unit_cost ?? 0;
              return sum + cost * (p.requested_quantity || 0);
            }, 0);
            const isPrimary = idx === 0;
            const isLocked = isUnitStaff && dest.unitId === homeUnitId;
            const otherDestinations = destinations.filter((d) => d.unitId !== dest.unitId);

            return (
              <div
                key={dest.unitId}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-outline-variant bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(dest.unitId)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {dest.collapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-800 truncate">
                          {unit?.name ?? "Unknown unit"}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {unit?.code ?? "?"}
                        </span>
                        {isPrimary && (
                          <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Primary owner
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Locked to your unit
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {dest.products.length} product
                        {dest.products.length === 1 ? "" : "s"} · subtotal{" "}
                        <span className="font-mono">
                          {subtotal.toLocaleString("en-ZM", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>{" "}
                        ZMW
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDestination(dest.unitId)}
                    disabled={isLocked}
                    className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-rose-600 rounded-lg cursor-pointer transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-50"
                    title={isLocked ? "Your assigned unit can't be removed" : "Remove destination"}
                    aria-label={`Remove ${unit?.name ?? "destination"}`}
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>

                {!dest.collapsed && (
                  <div className="p-5 flex flex-col gap-4">
                    {/* Search + picker */}
                    <CatalogueProductPicker
                      label={`Products for ${unit?.name ?? "destination"}`}
                      value={null}
                      requireStock
                      selectedIds={dest.products.map((row) => row.product_id)}
                      onChange={(product) => {
                        if (!product) return;
                        setProducts((previous) => [
                          ...previous.filter((p) => p.id !== product.id),
                          product,
                        ]);
                        toggleProduct(dest.unitId, product.id);
                      }}
                    />

                    {/* Selected products */}
                    {dest.products.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          Selected products
                        </label>
                        <div className="border border-outline-variant rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                <th className="text-left px-3 py-2 font-bold uppercase tracking-wider">
                                  Product
                                </th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider w-28">
                                  Qty
                                </th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider w-28">
                                  Line total
                                </th>
                                <th className="text-right px-3 py-2 font-bold uppercase tracking-wider w-40" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/60 bg-white">
                              {dest.products.map((row) => {
                                const p = productById.get(row.product_id);
                                const over = productExceedsStock(row.product_id);
                                const totalForProduct =
                                  totalRequestedByProduct.get(row.product_id) ?? 0;
                                const lineTotal =
                                  (p?.unit_cost ?? 0) * (row.requested_quantity || 0);
                                return (
                                  <tr key={row.product_id} className="align-top">
                                    <td className="px-3 py-2">
                                      <div className="font-semibold text-slate-700 truncate max-w-65">
                                        {p?.name ?? "Unknown product"}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {p?.sku ?? "—"} · {p?.uom ?? "—"} · stock{" "}
                                        {p?.stock_quantity ?? 0}
                                      </div>
                                      {over && (
                                        <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                          Across all destinations you&apos;ve requested{" "}
                                          {totalForProduct} — max {p?.stock_quantity}.
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <input
                                        type="number"
                                        min={1}
                                        value={row.requested_quantity || ""}
                                        onChange={(e) =>
                                          updateQty(
                                            dest.unitId,
                                            row.product_id,
                                            Number(e.target.value),
                                          )
                                        }
                                        className={`w-24 px-2 py-1.5 border rounded-md text-right text-sm font-mono font-bold focus:outline-none focus:ring-2 transition-all ${
                                          over
                                            ? "border-rose-300 text-rose-700 focus:ring-rose-200 focus:border-rose-400"
                                            : "border-outline-variant text-slate-700 focus:ring-primary/20 focus:border-primary"
                                        }`}
                                        placeholder="1"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                                      {lineTotal.toLocaleString("en-ZM", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="inline-flex items-center gap-2 relative">
                                        {otherDestinations.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              dest.copyOpenFor === row.product_id
                                                ? closeCopyMenu(dest.unitId)
                                                : openCopyMenu(dest.unitId, row.product_id)
                                            }
                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-2 py-1 rounded cursor-pointer"
                                            title="Copy this product & qty to other destinations"
                                          >
                                            <Copy className="w-3 h-3" />
                                            Copy to…
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => removeProduct(dest.unitId, row.product_id)}
                                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
                                          title="Remove"
                                          aria-label={`Remove ${p?.name ?? "product"}`}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        {dest.copyOpenFor === row.product_id && (
                                          <CopyMenu
                                            targets={otherDestinations
                                              .map((d) => unitById.get(d.unitId))
                                              .filter((u): u is SBUUnit => !!u)}
                                            selected={dest.copyTargets}
                                            onToggle={(id) => toggleCopyTarget(dest.unitId, id)}
                                            onCancel={() => closeCopyMenu(dest.unitId)}
                                            onApply={() => applyCopy(dest.unitId)}
                                          />
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2 border-t border-outline-variant/60 pt-4">
            <Link
              href="/requests"
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || hasOverStock || destinations.length === 0}
              className="px-5 py-2.5 bg-primary-container hover:bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CopyMenu({
  targets,
  selected,
  onToggle,
  onCancel,
  onApply,
}: {
  targets: SBUUnit[];
  selected: string[];
  onToggle: (unitId: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="absolute top-full right-0 mt-1 z-10 bg-white border border-outline-variant rounded-lg shadow-lg w-64 p-3 flex flex-col gap-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        Copy to other destinations
      </p>
      <div className="max-h-40 overflow-y-auto flex flex-col divide-y divide-outline-variant/60">
        {targets.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-2 px-1 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 rounded"
          >
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => onToggle(u.id)}
              className="w-3.5 h-3.5 text-primary border-slate-300 rounded focus:ring-primary/20"
            />
            <span className="flex-1 truncate">{u.name}</span>
            <span className="font-mono text-[10px] text-slate-400">{u.code}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-[11px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={selected.length === 0}
          className="px-2 py-1 text-[11px] font-bold text-white bg-primary hover:bg-primary/95 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
