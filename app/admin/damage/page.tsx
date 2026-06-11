"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Flame,
  RefreshCw,
  PackageCheck,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DamageLedgerEntry {
  id: string;
  quantity: number;
  unit_cost_at_writeoff: number;
  estimated_value: number;
  currency: string;
  writeoff_reason: string;
  transfer_reference: string;
  written_off_by: string;
  written_off_by_name: string | null;
  written_off_at: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    sku: string;
    unit_of_measure: string | null;
  } | null;
  damage_recalls: {
    id: string;
    status: "PENDING" | "IN_TRANSIT" | "RECEIVED";
    notes: string | null;
    initiated_by: string;
    initiated_by_name: string | null;
    received_by: string | null;
    received_by_name: string | null;
    received_at: string | null;
    created_at: string;
  } | null;
}

const token = () =>
  typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

const RECALL_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Recall Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="w-3 h-3 mr-1" />,
  },
  IN_TRANSIT: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-800",
    icon: <Truck className="w-3 h-3 mr-1" />,
  },
  RECEIVED: {
    label: "Received",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
  },
};

const ADVANCE_LABEL: Record<string, string> = {
  PENDING: "Mark In Transit",
  IN_TRANSIT: "Mark Received",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DamageLedgerPage() {
  const [entries, setEntries] = useState<DamageLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  // Recall initiation modal
  const [recallTarget, setRecallTarget] = useState<DamageLedgerEntry | null>(null);
  const [recallNotes, setRecallNotes] = useState("");
  const [recallSubmitting, setRecallSubmitting] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);

  // Status advance confirmation
  const [advanceTarget, setAdvanceTarget] = useState<{
    entry: DamageLedgerEntry;
    nextStatus: string;
  } | null>(null);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);

  const { currency, rate, fetching: fetchingRate, rateError, toggleCurrency, fmt } = useCurrency();

  // ── Load entries ────────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/damage-ledger", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      setEntries(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user_metadata");
    if (stored) {
      try {
        const meta = JSON.parse(stored);
        setUserRole(meta.role ?? "");
      } catch {
        /* ignore */
      }
    }
    loadEntries();
  }, [loadEntries]);

  // ── Derive KPIs ─────────────────────────────────────────────────────────────
  const totalEntries = entries.length;
  const totalValue = entries.reduce((sum, e) => sum + (e.estimated_value ?? 0), 0);
  const pendingRecalls = entries.filter(
    (e) => e.damage_recalls?.status === "PENDING" || e.damage_recalls?.status === "IN_TRANSIT",
  ).length;
  const receivedRecalls = entries.filter((e) => e.damage_recalls?.status === "RECEIVED").length;
  const noRecall = entries.filter((e) => !e.damage_recalls).length;

  // ── Initiate recall ─────────────────────────────────────────────────────────
  const submitRecall = async () => {
    if (!recallTarget) return;
    setRecallSubmitting(true);
    setRecallError(null);
    try {
      const res = await fetch(`/api/admin/damage-ledger/${recallTarget.id}/recall`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: recallNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setRecallTarget(null);
      setRecallNotes("");
      await loadEntries();
    } catch (e: any) {
      setRecallError(e.message ?? "Error initiating recall");
    } finally {
      setRecallSubmitting(false);
    }
  };

  // ── Advance recall status ───────────────────────────────────────────────────
  const advanceStatus = async () => {
    if (!advanceTarget) return;
    setAdvanceSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/damage-ledger/recalls/${advanceTarget.entry.damage_recalls!.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token()}` },
        },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setAdvanceTarget(null);
      await loadEntries();
    } catch (e: any) {
      alert(e.message ?? "Error updating recall status");
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const canMutate = ["ADMIN", "WAREHOUSE_MANAGER"].includes(userRole);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Damage Ledger</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCurrency}
            disabled={fetchingRate}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {fetchingRate ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
            {currency === "ZMW" ? "Show in USD" : "Show in ZMW"}
          </button>
          <button
            onClick={loadEntries}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {rateError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          {rateError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Flame className="w-5 h-5 text-red-400" />}
          label="Total Write-offs"
          value={String(totalEntries)}
          bg="bg-red-50"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
          label="Total Est. Value"
          value={fmt(totalValue)}
          bg="bg-orange-50"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5 text-yellow-400" />}
          label="Active Recalls"
          value={String(pendingRecalls)}
          bg="bg-yellow-50"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          label="Recalls Received"
          value={String(receivedRecalls)}
          bg="bg-green-50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading damage ledger…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          No damage write-offs recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-right">Est. Value</th>
                <th className="px-4 py-3 text-left">Transfer Ref</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Written Off By</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Recall Status</th>
                {canMutate && <th className="px-4 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {entries.map((entry) => {
                const recall = entry.damage_recalls;
                const statusCfg = recall ? RECALL_STATUS_CONFIG[recall.status] : null;

                return (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{entry.products?.name ?? "—"}</div>
                      <div className="text-xs text-gray-400">
                        {entry.products?.sku ?? ""}
                        {entry.products?.unit_of_measure
                          ? ` · ${entry.products.unit_of_measure}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">{entry.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-800">
                      {fmt(entry.estimated_value)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.transfer_reference ?? "—"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-gray-600 max-w-[180px] truncate"
                      title={entry.writeoff_reason}
                    >
                      {entry.writeoff_reason}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.written_off_by_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(entry.written_off_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {recall && statusCfg ? (
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}
                          >
                            {statusCfg.icon}
                            {statusCfg.label}
                          </span>
                          {recall.status === "RECEIVED" && recall.received_at && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(recall.received_at).toLocaleDateString()}
                              {recall.received_by_name ? ` · ${recall.received_by_name}` : ""}
                            </div>
                          )}
                          {recall.notes && (
                            <div
                              className="text-xs text-gray-400 mt-0.5 italic truncate max-w-[160px]"
                              title={recall.notes}
                            >
                              {recall.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No recall</span>
                      )}
                    </td>
                    {canMutate && (
                      <td className="px-4 py-3 text-center">
                        {!recall ? (
                          <button
                            onClick={() => {
                              setRecallTarget(entry);
                              setRecallNotes("");
                              setRecallError(null);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                          >
                            Initiate Recall
                          </button>
                        ) : recall.status !== "RECEIVED" ? (
                          <button
                            onClick={() =>
                              setAdvanceTarget({
                                entry,
                                nextStatus: recall.status === "PENDING" ? "IN_TRANSIT" : "RECEIVED",
                              })
                            }
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                          >
                            {ADVANCE_LABEL[recall.status]}
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Initiate Recall Modal ──────────────────────────────────────────── */}
      {recallTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Initiate Damage Recall
              </h2>
              <button
                onClick={() => setRecallTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Entry Summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Product</span>
                  <span className="font-medium text-gray-800">
                    {recallTarget.products?.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quantity</span>
                  <span className="font-medium text-gray-800">{recallTarget.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Value</span>
                  <span className="font-medium text-gray-800">
                    {fmt(recallTarget.estimated_value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transfer Ref</span>
                  <span className="font-mono text-xs text-blue-700">
                    {recallTarget.transfer_reference}
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-3">
                <strong>Note:</strong> A recall tracks the physical return of damaged goods to the
                warehouse. Stock will <em>not</em> be restored — the goods are damaged.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={recallNotes}
                  onChange={(e) => setRecallNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Goods to be collected by courier on Monday…"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {recallError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {recallError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setRecallTarget(null)}
                disabled={recallSubmitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRecall}
                disabled={recallSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {recallSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm Recall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Advance Status Confirmation ───────────────────────────────────── */}
      {advanceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Confirm Status Update</h2>
              <button
                onClick={() => setAdvanceTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 text-sm text-gray-600 space-y-2">
              <p>
                Update recall status for{" "}
                <strong>{advanceTarget.entry.products?.name ?? "this item"}</strong> to{" "}
                <strong>{advanceTarget.nextStatus.replace("_", " ")}</strong>?
              </p>
              {advanceTarget.nextStatus === "RECEIVED" && (
                <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                  Marking as Received confirms the damaged goods have physically arrived at the
                  warehouse.
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setAdvanceTarget(null)}
                disabled={advanceSubmitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={advanceStatus}
                disabled={advanceSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {advanceSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── KPI Card Sub-component ──────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-lg p-4 flex items-start gap-3`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-xl font-bold text-gray-800 tabular-nums">{value}</div>
      </div>
    </div>
  );
}
