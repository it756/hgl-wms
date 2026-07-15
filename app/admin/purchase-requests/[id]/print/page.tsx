"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

interface LineItem {
  id: string;
  product_name: string;
  sku: string | null;
  quantity_requested: number;
  unit_of_measure: string;
  unit_cost: number | null;
  notes: string | null;
}

interface PrintablePurchaseRequest {
  reference_number: string;
  status: string;
  supplier_name: string | null;
  notes: string | null;
  estimated_total: number | null;
  created_at: string;
  printed_at: string | null;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: LineItem[];
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED_FOR_PURCHASE: "Approved",
  EXPECTED_ORDER: "Expected Order",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
};

export default function PurchaseRequestPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pr, setPr] = useState<PrintablePurchaseRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/admin/purchase-requests/${id}/print`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load printable request");
        if (!cancelled) setPr(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!pr) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [pr]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Preparing printable request…
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-rose-600 font-medium text-sm">
          {error ?? "Purchase request not found."}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const lineTotal = (l: LineItem) =>
    l.unit_cost != null ? l.unit_cost * l.quantity_requested : null;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 p-10 print:p-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Purchase Request</h1>
            <p className="font-mono text-sm text-slate-500 mt-1">{pr.reference_number}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {STATUS_LABELS[pr.status] ?? pr.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm mb-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">SBU</p>
            <p className="text-slate-800">
              {pr.sbus?.name ?? "—"}
              {pr.sbus?.code ? ` (${pr.sbus.code})` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Supplier</p>
            <p className="text-slate-800">{pr.supplier_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Created</p>
            <p className="text-slate-800">{new Date(pr.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Printed</p>
            <p className="text-slate-800">
              {pr.printed_at ? new Date(pr.printed_at).toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {pr.notes && (
          <div className="mb-6 text-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Notes</p>
            <p className="text-slate-700 whitespace-pre-wrap">{pr.notes}</p>
          </div>
        )}

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-center">Qty</th>
              <th className="py-2 pr-2 text-right">Unit Cost</th>
              <th className="py-2 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {pr.purchase_request_line_items.map((l) => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className="py-2 pr-2">
                  {l.product_name}
                  {l.sku && <span className="ml-1 text-slate-400 text-xs">({l.sku})</span>}
                  {l.notes && <p className="text-xs italic text-slate-400 mt-0.5">{l.notes}</p>}
                </td>
                <td className="py-2 pr-2 text-center">
                  {l.quantity_requested} {l.unit_of_measure}
                </td>
                <td className="py-2 pr-2 text-right">
                  {l.unit_cost != null ? `ZMW ${l.unit_cost.toLocaleString()}` : "—"}
                </td>
                <td className="py-2 text-right font-medium">
                  {lineTotal(l) != null ? `ZMW ${lineTotal(l)!.toLocaleString()}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right font-semibold text-slate-600">
                Estimated Total
              </td>
              <td className="pt-3 text-right font-bold text-slate-800">
                {pr.estimated_total != null ? `ZMW ${pr.estimated_total.toLocaleString()}` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-10 print:mt-16 text-xs text-slate-400">
          Generated by Harvest WMS · {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
