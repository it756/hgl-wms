"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, XCircle, AlertCircle, FileText, Check, X, ShieldAlert, BarChart3, TrendingUp } from "lucide-react";

interface PendingItem {
  id: string;
  reference_number: string;
  status: string;
  estimated_value?: number;
  invoice_amount?: number;
  supplier_name?: string;
  created_at: string;
}

export default function FinanceQueuePage() {
  const [transfers, setTransfers] = useState<PendingItem[]>([]);
  const [supplierGrns, setSupplierGrns] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesError, setNotesError] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/finance/approvals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load approvals queue");
      setTransfers(data.transfer_requests ?? []);
      setSupplierGrns(data.supplier_grns ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleAction(
    entityType: "transfer_request" | "supplier_grn",
    entityId: string,
    action: "approve" | "reject",
  ) {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/finance/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          action,
          notes: notes[entityId] ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSuccess(
        `${entityType === "transfer_request" ? "Transfer" : "Supplier GRN"} ${action === "approve" ? "approved" : "rejected"} successfully.`,
      );
      // clear notes for that item
      setNotes(prev => {
        const copy = { ...prev };
        delete copy[entityId];
        return copy;
      });
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function setNoteForItem(id: string, val: string) {
    setNotes((prev) => ({ ...prev, [id]: val }));
  }

  // Calculate stats
  const totalPending = transfers.length + supplierGrns.length;
  const pendingValue = transfers.reduce((sum, t) => sum + (t.estimated_value || 0), 0) + 
                       supplierGrns.reduce((sum, g) => sum + (g.invoice_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Dynamic header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Corporate</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#005c55]">Finance Queue</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">Finance Approvals</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Authorise key stock transfers and supplier GRN receipts above threshold limits.</p>
        </div>

        {/* Global Notifications */}
        {success && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-650 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPI Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Pending */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <ShieldAlert className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active queue</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Awaiting Approval</h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">{String(totalPending).padStart(2, '0')}</p>
            </div>
            <div className="text-[10px] text-slate-405 font-bold tracking-wide">
              Requires immediate action
            </div>
          </div>

          {/* Card 2: Approved */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-[#E6F4F1] rounded-lg">
                <Check className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest font-sans">Approved today</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Completed Today</h3>
              <p className="text-3xl font-extrabold text-slate-850 font-mono mt-1">02</p>
            </div>
            <div className="text-[10px] text-teal-600 font-bold tracking-wide flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +100% vs yesterday
            </div>
          </div>

          {/* Card 3: Rejected */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50/50 rounded-lg border border-rose-50">
                <X className="w-5 h-5 text-rose-600" />
              </div>
              <span className="text-[10px] font-bold text-rose-650 uppercase tracking-widest">Rejected today</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Rejected</h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">01</p>
            </div>
            <div className="text-[10px] text-rose-600 font-bold tracking-wide">
              Requires detailed review
            </div>
          </div>

          {/* Card 4: Outstanding Value */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-50">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Outstanding liabilities</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending Value</h3>
              <p className="text-2xl font-extrabold text-[#0D9488] font-mono mt-1">KES {pendingValue.toLocaleString() || "0"}</p>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wide">
              Accumulated queue valuation
            </div>
          </div>
        </section>

        {/* Action Queues Section */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
            <p className="text-xs font-bold font-mono">LOADING FINANCE QUEUE...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transfer Requests approvals list */}
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <span>Transfer Requests Approvals</span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">{transfers.length}</span>
              </h3>
              {transfers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold text-xs font-mono uppercase">
                  No transfer requests pending approval.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {transfers.map((t) => (
                    <div key={t.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 hover:border-teal-300 transition-all flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-extrabold text-[#005c55] font-mono text-sm">{t.reference_number}</span>
                          <p className="text-xs text-slate-500 font-semibold mt-1">
                            Estimated Value: <strong className="text-slate-800 font-mono font-bold">KES {t.estimated_value?.toLocaleString() ?? "—"}</strong>
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-full uppercase font-sans">
                          Awaiting Approval
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          rows={2}
                          placeholder="Provide approval / rejection notes (optional)..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all placeholder:text-slate-300 font-medium"
                          value={notes[t.id] ?? ""}
                          onChange={(e) => setNoteForItem(t.id, e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                        <button
                          onClick={() => handleAction("transfer_request", t.id, "reject")}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction("transfer_request", t.id, "approve")}
                          className="px-3.5 py-1.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier GRN approvals list */}
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <span>Supplier GRN Approvals</span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">{supplierGrns.length}</span>
              </h3>
              {supplierGrns.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold text-xs font-mono uppercase">
                  No supplier GRNs pending approval.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {supplierGrns.map((g) => (
                    <div key={g.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 hover:border-teal-300 transition-all flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-extrabold text-[#005c55] font-mono text-sm">{g.reference_number}</span>
                          <p className="text-xs text-slate-500 font-semibold mt-1">
                            Supplier: <strong className="text-slate-800 font-bold">{g.supplier_name ?? "—"}</strong>
                          </p>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            Invoice: <strong className="text-slate-800 font-mono font-bold">KES {g.invoice_amount?.toLocaleString() ?? "—"}</strong>
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-full uppercase font-sans">
                          Awaiting Approval
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          rows={2}
                          placeholder="Provide approval / rejection notes (optional)..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all placeholder:text-slate-300 font-medium"
                          value={notes[g.id] ?? ""}
                          onChange={(e) => setNoteForItem(g.id, e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                        <button
                          onClick={() => handleAction("supplier_grn", g.id, "reject")}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction("supplier_grn", g.id, "approve")}
                          className="px-3.5 py-1.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
