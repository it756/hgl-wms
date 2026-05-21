"use client";

import { useEffect, useState } from "react";

interface GRNLineItem {
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes: string | null;
}

interface GRNRow {
  id: string;
  has_variance: boolean;
  variance_notes: string | null;
  created_at: string;
  grn_line_items: GRNLineItem[];
}

interface VarianceTransfer {
  id: string;
  reference_number: string;
  sbu_id: string | null;
  created_at: string;
  updated_at: string;
  grns: GRNRow[];
}

export default function VariancePage() {
  const [transfers, setTransfers] = useState<VarianceTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution modal
  const [resolving, setResolving] = useState<string | null>(null);
  const [resNotes, setResNotes] = useState("");
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/variance", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTransfers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitResolution(e: React.FormEvent) {
    e.preventDefault();
    if (!resolving || !resNotes.trim()) return;
    setResLoading(true);
    setResError(null);
    try {
      const res = await fetch("/api/admin/variance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ transfer_request_id: resolving, resolution_notes: resNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResolving(null);
      setResNotes("");
      load();
    } catch (e: any) {
      setResError(e.message);
    } finally {
      setResLoading(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Variance Resolution</h1>
      <p className="text-sm text-gray-500 mb-6">
        These transfers were completed with a quantity variance. Review the discrepancies and record
        a resolution to close them.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : transfers.length === 0 ? (
        <p className="text-gray-400 text-sm">No variance transfers to resolve.</p>
      ) : (
        <div className="space-y-4">
          {transfers.map((tr) => {
            const grn = tr.grns?.[0];
            return (
              <div key={tr.id} className="bg-white border border-orange-200 rounded p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{tr.reference_number}</p>
                    <p className="text-xs text-gray-500">
                      Updated {new Date(tr.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700">
                    COMPLETED_WITH_VARIANCE
                  </span>
                </div>

                {grn && (
                  <div className="overflow-x-auto mb-3">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="px-3 py-2 text-left">Product ID</th>
                          <th className="px-3 py-2 text-left">Issued</th>
                          <th className="px-3 py-2 text-left">Received</th>
                          <th className="px-3 py-2 text-left">Variance</th>
                          <th className="px-3 py-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {grn.grn_line_items.map((li, i) => {
                          const variance = li.quantity_received - li.issued_quantity;
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                                {li.product_id.slice(0, 8)}
                              </td>
                              <td className="px-3 py-2">{li.issued_quantity}</td>
                              <td className="px-3 py-2">{li.quantity_received}</td>
                              <td
                                className={`px-3 py-2 font-semibold ${variance !== 0 ? "text-red-600" : "text-green-600"}`}
                              >
                                {variance > 0 ? `+${variance}` : variance}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500">
                                {li.variance_notes ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  onClick={() => {
                    setResolving(tr.id);
                    setResNotes("");
                    setResError(null);
                  }}
                  className="bg-teal-700 text-white rounded px-4 py-2 text-sm hover:bg-teal-800"
                >
                  Record Resolution
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution modal */}
      {resolving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={submitResolution} className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="font-semibold mb-4">Record Variance Resolution</h2>
            <textarea
              required
              rows={4}
              placeholder="Describe how the variance was resolved…"
              value={resNotes}
              onChange={(e) => setResNotes(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full mb-3 resize-none"
            />
            {resError && <p className="text-red-600 text-xs mb-3">{resError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolving(null)}
                className="border rounded px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resLoading}
                className="bg-teal-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {resLoading ? "Saving…" : "Confirm Resolution"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
