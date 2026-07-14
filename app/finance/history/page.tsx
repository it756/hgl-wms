"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import HScrollArea from "@/components/HScrollArea";
import { TableHead, Th, Tr, Td } from "@/components/Table";
import { Search, AlertCircle } from "lucide-react";

type HistoryTab = "transfers" | "grns" | "returns" | "intra";

interface HistoryRow {
  id: string;
  reference: string;
  type: string;
  status: string;
  owner: string;
  value: number | null;
  createdAt: string;
}

function fmtValue(value: number | null): string {
  if (value == null) return "-";
  return `ZMW ${value.toLocaleString()}`;
}

function statusClass(status: string): string {
  if (status.includes("APPROVED") || status === "COMPLETED" || status === "RECEIVED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status.includes("REJECT") || status === "CANCELLED") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (status.includes("PENDING") || status.includes("AWAITING")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function FinanceHistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>("transfers");
  const [rowsByTab, setRowsByTab] = useState<Record<HistoryTab, HistoryRow[]>>({
    transfers: [],
    grns: [],
    returns: [],
    intra: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("access_token") ?? "";
        const headers = { Authorization: `Bearer ${token}` };
        const [transfersRes, grnsRes, returnsRes, intraRes] = await Promise.all([
          fetch("/api/transfer-requests", { headers }),
          fetch("/api/supplier-grns", { headers }),
          fetch("/api/return-requests", { headers }),
          fetch("/api/warehouse/intra-transfer", { headers }),
        ]);
        const [transfers, grns, returnsList, intraTransfers] = await Promise.all([
          transfersRes.json(),
          grnsRes.json(),
          returnsRes.json(),
          intraRes.json(),
        ]);
        if (!transfersRes.ok) throw new Error(transfers.error || "Failed to load transfers");
        if (!grnsRes.ok) throw new Error(grns.error || "Failed to load supplier GRNs");
        if (!returnsRes.ok) throw new Error(returnsList.error || "Failed to load returns");
        if (!intraRes.ok) throw new Error(intraTransfers.error || "Failed to load intra-transfers");

        if (cancelled) return;
        setRowsByTab({
          transfers: (transfers ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "Transfer",
            status: row.status,
            owner: row.sbus?.name ?? row.sbu_id ?? "-",
            value: row.estimated_value ?? null,
            createdAt: row.created_at,
          })),
          grns: (grns ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "Supplier GRN",
            status: row.status,
            owner: row.supplier_name ?? row.sbu_id ?? "-",
            value: row.invoice_amount ?? null,
            createdAt: row.created_at,
          })),
          returns: (returnsList ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "Return",
            status: row.status,
            owner: row.sbu_id ?? "-",
            value: null,
            createdAt: row.created_at,
          })),
          intra: (intraTransfers ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "Intra-Transfer",
            status: row.status,
            owner: row.to_sbu?.name ?? row.to_sbu_id ?? "-",
            value: null,
            createdAt: row.created_at,
          })),
        });
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: "transfers", label: "Transfers" },
    { id: "grns", label: "Supplier GRNs" },
    { id: "returns", label: "Returns" },
    { id: "intra", label: "Intra-Transfers" },
  ];

  const visibleRows = useMemo(() => {
    const rows = rowsByTab[activeTab];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.reference.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.owner.toLowerCase().includes(q),
    );
  }, [activeTab, rowsByTab, search]);

  return (
    <div className="flex w-full flex-col gap-6 text-slate-800">
      <PageHeader
        title="Finance Approval History"
        description="Review processed and pending approval records across transfers, supplier receipts, returns, and intra-warehouse transfers."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition ${
                  activeTab === tab.id
                    ? "bg-primary text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label} ({rowsByTab[tab.id].length})
              </button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, status, owner..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <HScrollArea>
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <TableHead>
              <Th pinned>Reference</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Owner</Th>
              <Th align="right">Value</Th>
              <Th>Created</Th>
            </TableHead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center font-semibold text-slate-400">
                    Loading finance history...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center font-semibold text-slate-400">
                    No history records found.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <Tr key={`${activeTab}-${row.id}`}>
                    <Td pinned className="font-mono font-bold text-primary">
                      {row.reference}
                    </Td>
                    <td className="px-6 py-3.5 font-semibold text-slate-600">{row.type}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${statusClass(row.status)}`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-600">{row.owner}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-700">
                      {fmtValue(row.value)}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </table>
        </HScrollArea>
      </div>
    </div>
  );
}