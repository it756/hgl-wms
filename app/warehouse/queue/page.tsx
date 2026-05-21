"use client";

import { useEffect, useState } from "react";

interface PendingRequest {
  id: string;
  reference_number: string;
  status: string;
  sbu_id: string;
  required_date: string | null;
  created_at: string;
  transfer_line_items: { product_id: string; requested_quantity: number }[];
}

interface IssuanceItem {
  product_id: string;
  quantity_issued: number;
  shortfall_reason?: string;
}

export default function WarehouseQueuePage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [issuanceItems, setIssuanceItems] = useState<IssuanceItem[]>([]);
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/transfer-requests?status=PENDING&status=APPROVED_FOR_ISSUE", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  function startIssuing(request: PendingRequest) {
    setIssuingId(request.id);
    setIssuanceItems(
      request.transfer_line_items.map((l) => ({
        product_id: l.product_id,
        quantity_issued: l.requested_quantity,
      })),
    );
    setLogisticsNotes("");
    setSuccessMsg(null);
    setError(null);
  }

  function cancelIssuing() {
    setIssuingId(null);
    setIssuanceItems([]);
  }

  function updateIssuanceItem(
    index: number,
    field: keyof IssuanceItem,
    value: string | number,
  ) {
    setIssuanceItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function submitIssuance() {
    if (!issuingId) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/issuances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transfer_request_id: issuingId,
          items: issuanceItems,
          logistics_notes: logisticsNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record issuance");
      setSuccessMsg("Issuance recorded successfully.");
      setIssuingId(null);
      setIssuanceItems([]);
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Warehouse Issuance Queue</h1>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading queue…</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500 text-sm">No pending requests in queue.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="border rounded p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono font-medium">{r.reference_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    SBU: {r.sbu_id} · Required:{" "}
                    {r.required_date ?? "ASAP"} · Status:{" "}
                    <span className="font-medium">{r.status.replace(/_/g, " ")}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.transfer_line_items.length} line item(s)
                  </p>
                </div>
                {issuingId !== r.id && (
                  <button
                    onClick={() => startIssuing(r)}
                    className="ml-4 text-sm bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700"
                  >
                    Record Issuance
                  </button>
                )}
              </div>

              {issuingId === r.id && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  <h3 className="text-sm font-medium">Record Issuance Quantities</h3>
                  {issuanceItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Product: {item.product_id}</p>
                        <input
                          type="number"
                          min={0}
                          value={item.quantity_issued}
                          onChange={(e) =>
                            updateIssuanceItem(idx, "quantity_issued", Number(e.target.value))
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Qty issued"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Shortfall reason (if any)</p>
                        <input
                          type="text"
                          value={item.shortfall_reason ?? ""}
                          onChange={(e) =>
                            updateIssuanceItem(idx, "shortfall_reason", e.target.value)
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Leave blank if no shortfall"
                        />
                      </div>
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Logistics Notes</label>
                    <textarea
                      value={logisticsNotes}
                      onChange={(e) => setLogisticsNotes(e.target.value)}
                      rows={2}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={submitIssuance}
                      disabled={submitting}
                      className="text-sm bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700 disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Confirm Issuance"}
                    </button>
                    <button
                      onClick={cancelIssuing}
                      className="text-sm text-gray-600 rounded px-3 py-1 border hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
