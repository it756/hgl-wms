"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DocumentUpload from "@/components/DocumentUpload";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Search,
  AlertCircle,
  ArrowRightLeft,
  Building,
  ArrowLeftRight,
  TrendingDown,
  Calendar,
  ChevronRight,
  FileText,
  Paperclip,
} from "lucide-react";

type HistoryTab = "transfers" | "grns" | "returns" | "intra";

interface HistoryLineItem {
  name: string;
  sku: string;
  quantity: number;
  unitCost: number | null;
  total: number | null;
}

interface HistoryRow {
  id: string;
  reference: string;
  type: HistoryTab;
  status: string;
  ownerLabel: string;
  owner: string;
  secondaryLabel?: string;
  secondary?: string | null;
  destination: string | null;
  value: number | null;
  createdAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  approvalNotes: string | null;
  reason: string | null;
  items: HistoryLineItem[];
}

const TAB_META: Record<
  HistoryTab,
  { label: string; icon: typeof ArrowRightLeft; accent: string; iconBg: string; iconColor: string }
> = {
  transfers: {
    label: "Transfers",
    icon: ArrowRightLeft,
    accent: "border-[#005c55]/60 ring-[#005c55]/20 bg-[#E6F4F1]/30",
    iconBg: "bg-[#E6F4F1]",
    iconColor: "text-[#005c55]",
  },
  grns: {
    label: "Supplier GRNs",
    icon: Building,
    accent: "border-teal-600/60 ring-teal-500/20 bg-teal-50/30",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-700",
  },
  returns: {
    label: "Returns",
    icon: ArrowLeftRight,
    accent: "border-purple-600/60 ring-purple-500/20 bg-purple-50/30",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  intra: {
    label: "Intra-Transfers",
    icon: TrendingDown,
    accent: "border-amber-500/60 ring-amber-500/20 bg-amber-50/30",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
};

function fmtDateTime(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { fmt } = useCurrency();

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
          transfers: (transfers ?? []).map((row: any) => {
            const destinationNames = Array.from(
              new Set(
                (row.transfer_line_items ?? [])
                  .map((l: any) => l.destination?.name ?? l.destination?.code ?? null)
                  .filter(Boolean),
              ),
            );
            return {
              id: row.id,
              reference: row.reference_number,
              type: "transfers",
              status: row.status,
              ownerLabel: "Requesting SBU",
              owner: row.sbus?.name ?? row.sbu_id ?? "-",
              destination: destinationNames.length > 0 ? destinationNames.join(", ") : null,
              value: row.estimated_value ?? null,
              createdAt: row.created_at,
              approvedAt: row.approved_at ?? null,
              receivedAt: null,
              notes: row.notes ?? null,
              approvalNotes: row.finance_approval_notes ?? null,
              reason: null,
              items: (row.transfer_line_items ?? []).map((l: any) => ({
                name: l.products?.name ?? `Product ${l.product_id}`,
                sku: l.products?.sku ?? "",
                quantity: l.requested_quantity,
                unitCost: l.products?.unit_cost ?? null,
                total: l.requested_quantity * (l.products?.unit_cost ?? 0),
              })),
            };
          }),
          grns: (grns ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "grns",
            status: row.status,
            ownerLabel: "Supplier",
            owner: row.supplier_name ?? "-",
            secondaryLabel: "Invoice Ref.",
            secondary: row.supplier_invoice_reference ?? null,
            destination: row.sbus?.name ?? "Warehouse Pool",
            value: row.invoice_amount ?? null,
            createdAt: row.created_at,
            approvedAt: row.approved_at ?? null,
            receivedAt: null,
            notes: null,
            approvalNotes: row.approval_notes ?? null,
            reason: null,
            items: (row.supplier_grn_line_items ?? []).map((l: any) => ({
              name: l.products?.name ?? `Product ${l.product_id}`,
              sku: l.products?.sku ?? "",
              quantity: l.quantity_received,
              unitCost: l.unit_cost ?? null,
              total: l.quantity_received * (l.unit_cost ?? 0),
            })),
          })),
          returns: (returnsList ?? []).map((row: any) => {
            const items = (row.return_line_items ?? []).map((l: any) => ({
              name: l.products?.name ?? `Product ${l.product_id}`,
              sku: l.products?.sku ?? "",
              quantity: l.quantity_to_return,
              unitCost: l.products?.unit_cost ?? null,
              total: l.quantity_to_return * (l.products?.unit_cost ?? 0),
            }));
            return {
              id: row.id,
              reference: row.reference_number,
              type: "returns",
              status: row.status,
              ownerLabel: "Returning SBU",
              owner: row.sbus?.name ?? row.sbu_id ?? "-",
              destination: "Warehouse",
              value: items.reduce((sum: number, it: HistoryLineItem) => sum + (it.total ?? 0), 0),
              createdAt: row.created_at,
              approvedAt: row.approved_at ?? null,
              receivedAt: row.received_at ?? null,
              notes: row.notes ?? null,
              approvalNotes: row.approval_notes ?? null,
              reason: row.reason ?? null,
              items,
            };
          }),
          intra: (intraTransfers ?? []).map((row: any) => ({
            id: row.id,
            reference: row.reference_number,
            type: "intra",
            status: row.status,
            ownerLabel: "Destination SBU",
            owner: row.to_sbu?.name ?? row.to_sbu_id ?? "-",
            secondaryLabel: "Source",
            secondary: row.from_sbu?.name ?? "Warehouse Pool",
            destination: null,
            value: row.quantity * (row.products?.unit_cost ?? 0),
            createdAt: row.created_at,
            approvedAt: null,
            receivedAt: null,
            notes: row.notes ?? null,
            approvalNotes: null,
            reason: null,
            items: [
              {
                name: row.products?.name ?? `Product ${row.product_id}`,
                sku: row.products?.sku ?? "",
                quantity: row.quantity,
                unitCost: row.products?.unit_cost ?? null,
                total: row.quantity * (row.products?.unit_cost ?? 0),
              },
            ],
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

  const tabs: { id: HistoryTab; label: string }[] = (Object.keys(TAB_META) as HistoryTab[]).map(
    (id) => ({ id, label: TAB_META[id].label }),
  );

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

  const selectedItem = useMemo(
    () => visibleRows.find((row) => row.id === selectedId) ?? null,
    [visibleRows, selectedId],
  );

  function selectTab(tab: HistoryTab) {
    setActiveTab(tab);
    setSelectedId(null);
  }

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

      {/* Tab Selection, Filter Search & Main Split Grid View */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left: record list */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-0.5 rounded-lg bg-slate-50/80 p-0.5">
              {tabs.map((tab) => {
                const Icon = TAB_META[tab.id].icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectTab(tab.id)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTab === tab.id
                        ? "bg-white font-extrabold text-primary shadow-sm"
                        : "text-slate-450 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>
                      {tab.label} ({rowsByTab[tab.id].length})
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reference, status, owner..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-slate-400 shadow-sm">
              <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></span>
              <p className="text-xs font-extrabold uppercase tracking-wider font-mono">
                Loading finance history...
              </p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 shadow-sm">
              No history records found.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleRows.map((row) => {
                const meta = TAB_META[row.type];
                const Icon = meta.icon;
                const isSelected = selectedId === row.id;
                return (
                  <div
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`relative flex cursor-pointer flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all hover:border-slate-400/60 md:flex-row md:items-center md:justify-between ${
                      isSelected ? `${meta.accent} ring-1` : "border-slate-200/90"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-1 shrink-0 rounded-lg p-3 ${meta.iconBg} ${meta.iconColor}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-extrabold tracking-tight text-slate-800">
                            {row.reference}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${statusClass(row.status)}`}
                          >
                            {row.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {row.ownerLabel}: <strong className="text-slate-700">{row.owner}</strong>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          {row.items.length} line item{row.items.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-end justify-between border-t border-slate-100 pt-3 md:flex-col md:items-end md:justify-center md:border-t-0 md:pt-0">
                      <span className="hidden text-[10px] font-bold uppercase tracking-widest text-slate-400 md:block">
                        Value
                      </span>
                      <span className="font-mono text-base font-black text-slate-700">
                        {fmt(row.value)}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-450">
                        <Calendar className="h-3 w-3" /> {fmtDateTime(row.createdAt)}
                      </span>
                    </div>

                    <span className="absolute right-3 top-3 text-slate-350 opacity-45">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: sticky detail panel */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-450">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                No Record Selected
              </h4>
              <p className="max-w-50 text-xs font-medium leading-relaxed text-slate-400">
                Select a record from the list to view its full transaction details.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450">
                    Detail Summary
                  </span>
                  <h3 className="mt-0.5 font-mono text-lg font-black leading-tight text-slate-800">
                    {selectedItem.reference}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded bg-slate-100 p-1 px-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-200"
                >
                  Close ×
                </button>
              </div>

              <span
                className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${statusClass(selectedItem.status)}`}
              >
                {selectedItem.status.replace(/_/g, " ")}
              </span>

              <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3.5 text-xs font-semibold text-slate-500">
                <div className="flex justify-between">
                  <span>{selectedItem.ownerLabel}:</span>
                  <span className="font-bold text-slate-800">{selectedItem.owner}</span>
                </div>
                {selectedItem.secondary && (
                  <div className="flex justify-between">
                    <span>{selectedItem.secondaryLabel}:</span>
                    <span className="font-bold text-slate-800">{selectedItem.secondary}</span>
                  </div>
                )}
                {selectedItem.destination && (
                  <div className="flex justify-between">
                    <span>Destination:</span>
                    <span className="font-bold text-slate-800">{selectedItem.destination}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Date Filed:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {fmtDateTime(selectedItem.createdAt)}
                  </span>
                </div>
                {selectedItem.approvedAt && (
                  <div className="flex justify-between">
                    <span>Approved:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {fmtDateTime(selectedItem.approvedAt)}
                    </span>
                  </div>
                )}
                {selectedItem.receivedAt && (
                  <div className="flex justify-between">
                    <span>Received:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {fmtDateTime(selectedItem.receivedAt)}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-slate-200/50 pt-2.5">
                  <span className="font-semibold text-slate-705">Financial Value:</span>
                  <span className="font-mono text-base font-black text-slate-800">
                    {fmt(selectedItem.value)}
                  </span>
                </div>
              </div>

              {selectedItem.reason && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-[11px] font-medium leading-relaxed text-slate-700">
                  <strong>Reason:</strong> {selectedItem.reason}
                </div>
              )}
              {selectedItem.notes && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-[11px] font-medium leading-relaxed text-slate-700">
                  <strong>Notes:</strong> {selectedItem.notes}
                </div>
              )}
              {selectedItem.approvalNotes && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-[11px] font-medium leading-relaxed text-slate-700">
                  <strong>Approval Notes:</strong> {selectedItem.approvalNotes}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Inspected Items Ledger
                </h4>
                <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-150 bg-white px-3">
                  {selectedItem.items.map((it, i) => (
                    <div key={i} className="flex justify-between gap-4 py-2.5 text-xs font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold leading-tight text-slate-750">{it.name}</span>
                        <span className="font-mono text-[9px] text-slate-400">{it.sku}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono font-bold text-slate-800">
                          Qty {it.quantity}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {fmt(it.unitCost)} ea
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedItem.type === "grns" && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <Paperclip className="h-3 w-3" /> Attached Documents
                  </h4>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <DocumentUpload
                      transactionType="supplier_grn"
                      transactionId={selectedItem.id}
                      canDelete={false}
                      readOnly={true}
                      token={
                        typeof window !== "undefined"
                          ? (localStorage.getItem("access_token") ?? "")
                          : ""
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
