"use client";

import { useEffect, useState } from "react";

interface IssuedTransfer {
  id: string;
  reference_number: string;
  sbu_id: string;
  issuance_id?: string;
  transfer_line_items: { product_id: string; requested_quantity: number }[];
}

interface GRNLineItemInput {
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes?: string;
}

export default function SubmitGRNPage() {
  const [transfers, setTransfers] = useState<IssuedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grnItems, setGrnItems] = useState<GRNLineItemInput[]>([]);
  const [conditionNotes, setConditionNotes] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/transfer-requests?status=ISSUED", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTransfers(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function selectTransfer(t: IssuedTransfer) {
    setSelectedId(t.id);
    setGrnItems(
      t.transfer_line_items.map((l) => ({
        product_id: l.product_id,
        issued_quantity: l.requested_quantity,
        quantity_received: l.requested_quantity,
      })),
    );
    setError(null);
    setSuccess(null);
  }

  function updateGRNItem(idx: number, field: keyof GRNLineItemInput, value: string | number) {
    setGrnItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  async function submitGRN() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/grns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transfer_request_id: selectedId,
          date_received: dateReceived,
          condition_notes: conditionNotes || undefined,
          items: grnItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "GRN submission failed");
      setSuccess("GRN submitted. Transfer is now marked as completed.");
      setSelectedId(null);
      setGrnItems([]);
      setTransfers((prev) => prev.filter((t) => t.id !== selectedId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Submit Goods Received Note (GRN)</h1>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading issued transfers…</p>
      ) : transfers.length === 0 && !selectedId ? (
        <p className="text-gray-500 text-sm">No issued transfers awaiting GRN.</p>
      ) : (
        <>
          {!selectedId && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">Select a transfer to submit a GRN for:</p>
              {transfers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTransfer(t)}
                  className="w-full text-left border rounded p-3 hover:bg-blue-50 transition"
                >
                  <span className="font-mono font-medium">{t.reference_number}</span>
                  <span className="ml-2 text-xs text-gray-500">SBU: {t.sbu_id}</span>
                </button>
              ))}
            </div>
          )}

          {selectedId && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date Received</label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Line Items</p>
                {grnItems.map((item, idx) => (
                  <div key={idx} className="border rounded p-3 mb-2 space-y-2">
                    <p className="text-xs text-gray-500">Product: {item.product_id}</p>
                    <div className="flex gap-3">
                      <div>
                        <label className="block text-xs mb-1">Issued Qty</label>
                        <input
                          type="number"
                          value={item.issued_quantity}
                          readOnly
                          className="w-24 border rounded px-2 py-1 text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Received Qty</label>
                        <input
                          type="number"
                          min={0}
                          value={item.quantity_received}
                          onChange={(e) =>
                            updateGRNItem(idx, "quantity_received", Number(e.target.value))
                          }
                          className="w-24 border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs mb-1">Variance Notes</label>
                        <input
                          type="text"
                          value={item.variance_notes ?? ""}
                          onChange={(e) => updateGRNItem(idx, "variance_notes", e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Leave blank if quantities match"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Condition Notes</label>
                <textarea
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submitGRN}
                  disabled={submitting}
                  className="text-sm bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit GRN"}
                </button>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setGrnItems([]);
                  }}
                  className="text-sm border rounded px-4 py-2 hover:bg-gray-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
