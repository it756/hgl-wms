"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, FileText, AlertTriangle } from "lucide-react";

interface LineItem {
  id: string;
  product_name: string;
  sku: string | null;
  quantity_requested: number;
  unit_of_measure: string;
  unit_cost: number | null;
  notes: string | null;
}

interface PurchaseRequest {
  id: string;
  reference_number: string;
  status: string;
  supplier_name: string | null;
  notes: string | null;
  estimated_total: number | null;
  created_at: string;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: LineItem[];
}

type ActionType = "APPROVE" | "REJECT" | "CHANGES_REQUESTED";

interface PageState {
  loading: boolean;
  error: string | null;
  purchaseRequest: PurchaseRequest | null;
  allowedActions: string[];
  expiresAt: string | null;
  submitted: boolean;
  submittedAction: ActionType | null;
  submitting: boolean;
  submitError: string | null;
}

export default function ProcurementReviewPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    purchaseRequest: null,
    allowedActions: [],
    expiresAt: null,
    submitted: false,
    submittedAction: null,
    submitting: false,
    submitError: null,
  });

  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);

  useEffect(() => {
    loadRequest();
  }, []);

  async function loadRequest() {
    try {
      const res = await fetch(`/api/external/procurement/${params.token}`);
      const data = await res.json();
      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? "Invalid link." }));
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        purchaseRequest: data.purchaseRequest,
        allowedActions: data.token.allowedActions,
        expiresAt: data.token.expiresAt,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Could not load this purchase request. Please try again.",
      }));
    }
  }

  async function submitAction(action: ActionType) {
    setState((prev) => ({ ...prev, submitting: true, submitError: null }));
    try {
      const res = await fetch(`/api/external/procurement/${params.token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
          document_url: documentUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          submitting: false,
          submitError: data.error ?? "Action failed.",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        submitting: false,
        submitted: true,
        submittedAction: action,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        submitting: false,
        submitError: "Something went wrong. Please try again.",
      }));
    }
  }

  const {
    loading,
    error,
    purchaseRequest: pr,
    allowedActions,
    expiresAt,
    submitted,
    submittedAction,
    submitting,
    submitError,
  } = state;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading purchase request…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Link Unavailable</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400">
            If you believe this is an error, please contact the requesting team to send a new link.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const messages: Record<ActionType, { title: string; body: string; icon: React.ReactNode }> = {
      APPROVE: {
        title: "Purchase Request Approved",
        body: "You have approved this purchase request. The requesting team has been notified and it will now proceed to internal control review.",
        icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
      },
      REJECT: {
        title: "Purchase Request Rejected",
        body: "You have rejected this purchase request. The requesting team has been notified.",
        icon: <XCircle className="w-6 h-6 text-rose-500" />,
      },
      CHANGES_REQUESTED: {
        title: "Changes Requested",
        body: "You have requested changes to this purchase request. The requesting team has been notified and will review and resubmit.",
        icon: <RefreshCw className="w-6 h-6 text-amber-500" />,
      },
    };

    const msg = submittedAction ? messages[submittedAction] : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            {msg?.icon}
          </div>
          <h1 className="text-lg font-semibold text-slate-800">{msg?.title}</h1>
          <p className="text-sm text-slate-500">{msg?.body}</p>
          <p className="text-xs text-slate-400">
            This window can be closed. Thank you for your review.
          </p>
        </div>
      </div>
    );
  }

  if (!pr) return null;

  const currency = "KES";

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-medium mb-1">
                Harvest WMS · Purchase Request Review
              </p>
              <h1 className="text-xl font-bold text-slate-800">{pr.reference_number}</h1>
              {pr.sbus && (
                <p className="text-sm text-slate-500 mt-1">
                  Requesting SBU: <strong>{pr.sbus.name}</strong>
                </p>
              )}
            </div>
            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium whitespace-nowrap">
              Awaiting Your Review
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {pr.supplier_name && (
              <>
                <span className="text-slate-500">Supplier</span>
                <span className="text-slate-700 font-medium">{pr.supplier_name}</span>
              </>
            )}
            {pr.estimated_total != null && (
              <>
                <span className="text-slate-500">Estimated Total</span>
                <span className="text-slate-700 font-medium">
                  {currency} {pr.estimated_total.toLocaleString()}
                </span>
              </>
            )}
            <span className="text-slate-500">Date Created</span>
            <span className="text-slate-700">{new Date(pr.created_at).toLocaleDateString()}</span>
            {expiresAt && (
              <>
                <span className="text-slate-500">Link Expires</span>
                <span className="text-slate-700">{new Date(expiresAt).toLocaleDateString()}</span>
              </>
            )}
          </div>

          {pr.notes && (
            <div className="mt-4 bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600">
              <span className="font-medium">Notes from requesting team:</span> {pr.notes}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
          <h2 className="font-semibold text-slate-700 mb-3">Requested Items</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pr.purchase_request_line_items.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-slate-700">{l.product_name}</span>
                    {l.sku && <span className="ml-1.5 text-xs text-slate-400">({l.sku})</span>}
                    {l.notes && <p className="text-xs text-slate-400 mt-0.5">{l.notes}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {l.quantity_requested} {l.unit_of_measure}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {l.unit_cost != null ? `${currency} ${l.unit_cost.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {l.unit_cost != null
                      ? `${currency} ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {pr.estimated_total != null && (
              <tfoot>
                <tr className="bg-slate-50">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-right text-sm font-medium text-slate-600"
                  >
                    Estimated Total
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">
                    {currency} {pr.estimated_total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Your Review</h2>

          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes / Comments
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes, conditions, or reasons for your decision…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {allowedActions.includes("UPLOAD") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <FileText className="inline w-4 h-4 mr-1 text-slate-400" />
                Attach Proforma / Quotation URL (optional)
              </label>
              <input
                type="url"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Paste a shareable link to a proforma invoice, quotation, or supporting document.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {allowedActions.includes("APPROVE") && (
              <button
                onClick={() => submitAction("APPROVE")}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting && activeAction === "APPROVE" ? "Processing…" : "Approve"}
              </button>
            )}
            {allowedActions.includes("CHANGES_REQUESTED") && (
              <button
                onClick={() => {
                  setActiveAction("CHANGES_REQUESTED");
                  submitAction("CHANGES_REQUESTED");
                }}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Request Changes
              </button>
            )}
            {allowedActions.includes("REJECT") && (
              <button
                onClick={() => {
                  setActiveAction("REJECT");
                  submitAction("REJECT");
                }}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 text-center">
            This is a secure, single-use review link. Approving or rejecting will record your
            decision and close this link. The requesting team will be notified immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
