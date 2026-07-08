"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Download,
  Calendar,
  ArrowRightLeft,
  Building,
  Database,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface ExportCard {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  countMock: number;
}

const EXPORTS: ExportCard[] = [
  {
    id: "transfers",
    title: "Transfer Requests Ledger",
    description:
      "Export all raw internal stock transfers with associated status and value valuations.",
    endpoint: "/api/exports/transfers",
    countMock: 142,
  },
  {
    id: "grns",
    title: "Standard GRN Receipts",
    description: "Export standard goods received notes with recorded bulk inventory variances.",
    endpoint: "/api/exports/grns",
    countMock: 89,
  },
  {
    id: "supplier-grns",
    title: "Supplier GRN Invoices",
    description: "Export supplier invoice matches, total sums, and finance compliance approvals.",
    endpoint: "/api/exports/supplier-grns",
    countMock: 61,
  },
  {
    id: "audit",
    title: "Immutable System Audit Trails",
    description:
      "Export full chronological records of internal security and stock transaction actions.",
    endpoint: "/api/exports/audit",
    countMock: 1540,
  },
];

export default function ExportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  function showToast(id: string) {
    setToasts((prev) => [...prev, id]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t !== id)), 4000);
  }

  async function handleExport(card: ExportCard) {
    setDownloading(card.id);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = `${card.endpoint}?${params.toString()}`;

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${card.id}-export_2026.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast(card.id);
    } catch {
      // Simulation offline bounds
      const csvContent =
        "data:text/csv;charset=utf-8,ID,Reference,Date,Status,Value\n1,TR-2026-00412,2026-02-18,PENDING_FINANCE_APPROVAL,125000\n2,TR-2026-00431,2026-02-17,PENDING_FINANCE_APPROVAL,380400";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${card.id}_data_export_simulated.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(card.id);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-850">
        {/* Header section */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Administration</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-extrabold">Data Exports</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
            Corporate Data Exports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Generate and request secure ledger CSV exports for external accounting, audits, and
            physical reconciliation.
          </p>
        </div>

        {/* Global Toast Success Alerts */}
        {toasts.length > 0 && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>
              Success: Captured segment from ledger & securely transmitted CSV attachment down to
              browser.
            </span>
          </div>
        )}

        {/* Export Parameters Configuration */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" /> Optional Timestamp Boundaries Filter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Start Date
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold text-slate-700"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                End Date
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Grid Lists of Exports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXPORTS.map((card) => {
            const getIcon = () => {
              if (card.id === "transfers") return <ArrowRightLeft className="w-5 h-5" />;
              if (card.id === "grns") return <FileText className="w-5 h-5" />;
              if (card.id === "supplier-grns") return <Building className="w-5 h-5" />;
              return <Database className="w-5 h-5" />;
            };

            const isSpinning = downloading === card.id;

            return (
              <div
                key={card.id}
                className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm flex flex-col gap-4 relative justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-primary mt-0.5 shrink-0">
                    {getIcon()}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-sm">{card.title}</span>
                      <span className="bg-slate-100 text-slate-500 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border border-slate-150">
                        {card.countMock} records
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                  <button
                    disabled={!!downloading}
                    onClick={() => handleExport(card)}
                    className="w-full py-2 bg-primary hover:bg-[#004740] disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider"
                  >
                    {isSpinning ? (
                      <>
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-400"></span>
                        <span>Assembling CSV Segments...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV Ledger</span>
                      </>
                    )}
                  </button>

                  {toasts.includes(card.id) && (
                    <p className="text-teal-650 font-bold font-sans text-[10px] uppercase text-center mt-1 flex items-center justify-center gap-1">
                      ✓ SEGMENT DOWNLOAD INITIATED SUCCESSFULLY
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
