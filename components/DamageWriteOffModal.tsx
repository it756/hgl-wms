"use client";

import { useState } from "react";
import { Flame, Loader2, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface DamageWriteOffModalProps {
  product: {
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
    unit_of_measure: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

const REASON_PRESETS = [
  "Physical damage",
  "Water damage",
  "Pest damage",
  "Contamination",
  "Manufacturing defect",
  "Other",
];

export default function DamageWriteOffModal({
  product,
  onClose,
  onSuccess,
}: DamageWriteOffModalProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [reasonPreset, setReasonPreset] = useState(REASON_PRESETS[0]);
  const [reasonOther, setReasonOther] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const finalReason = reasonPreset === "Other" ? reasonOther.trim() : reasonPreset;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    if (quantity > product.stock_quantity) {
      setError(`Cannot exceed stock (${product.stock_quantity} ${product.unit_of_measure})`);
      return;
    }
    if (!finalReason) {
      setError("A reason is required");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token") ?? "";
      const res = await fetch(`/api/admin/products/${product.id}/damage-writeoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity,
          reason: finalReason,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Write-off failed");
      setSuccess(`Recorded — new stock: ${data.new_stock_quantity}`);
      onSuccess?.();
      setTimeout(() => onClose(), 800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-600" />
            <h2 className="font-extrabold text-sm text-slate-800">Write Off Damaged Stock</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="font-bold text-slate-800 text-sm">{product.name}</div>
            <div className="font-mono text-[11px] text-slate-500">{product.sku}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Available: <span className="font-bold">{product.stock_quantity}</span>{" "}
              {product.unit_of_measure}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quantity to Write Off
            </label>
            <input
              type="number"
              min={1}
              max={product.stock_quantity}
              value={quantity || ""}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Reason
            </label>
            <select
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              {REASON_PRESETS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {reasonPreset === "Other" && (
              <input
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Specify reason…"
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                required
              />
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-700 text-xs bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" /> {success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Write-Off
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
