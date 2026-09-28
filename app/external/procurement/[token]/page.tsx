"use client";

import { use, useEffect, useState } from "react";
import { Table, TableHead, Td, Th, Tr } from "@/components/Table";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  AlertTriangle,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

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

interface ProcurementDocument {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  document_label: string | null;
  uploaded_by: string | null;
  created_at: string;
  url: string | null;
}

interface StagedDocument {
  file: File;
  label: string;
  uploading: boolean;
  error: string | null;
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

export default function ProcurementReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
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
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [documents, setDocuments] = useState<ProcurementDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [stagedDocuments, setStagedDocuments] = useState<StagedDocument[]>([]);

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
  const canUpload = allowedActions.includes("UPLOAD");

  useEffect(() => {
    let cancelled = false;

    async function loadRequest() {
      const res = await fetch(`/api/external/procurement/${token}`);
      const data = await res.json();
      if (cancelled) return;

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
    }

    loadRequest().catch(() => {
      if (cancelled) return;

      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Could not load this purchase request. Please try again.",
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!canUpload) return;

    let cancelled = false;

    fetch(`/api/external/procurement/${token}/documents`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;

        setDocuments(res.ok && Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;

        setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canUpload, token]);

  function formatBytes(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function stageDocuments(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    setStagedDocuments((prev) => [
      ...prev,
      ...nextFiles.map((file) => ({
        file,
        label: "Proforma / Invoice",
        uploading: false,
        error: null,
      })),
    ]);
  }

  function removeStagedDocument(index: number) {
    setStagedDocuments((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadDocuments() {
    if (stagedDocuments.length === 0) return;

    const results = await Promise.all(
      stagedDocuments.map(async (item, index) => {
        setStagedDocuments((prev) =>
          prev.map((doc, i) => (i === index ? { ...doc, uploading: true, error: null } : doc)),
        );

        const form = new FormData();
        form.append("file", item.file);
        form.append("document_label", item.label.trim() || "Proforma / Invoice");

        const res = await fetch(`/api/external/procurement/${token}/documents`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStagedDocuments((prev) =>
            prev.map((doc, i) =>
              i === index
                ? { ...doc, uploading: false, error: data.error ?? "Upload failed" }
                : doc,
            ),
          );
          return null;
        }

        return { document: (await res.json()) as ProcurementDocument, index };
      }),
    );

    const successfulIndices = new Set(results.filter(Boolean).map((result) => result!.index));
    setStagedDocuments((prev) => prev.filter((_, index) => !successfulIndices.has(index)));
    setDocuments((prev) => [
      ...prev,
      ...results.filter(Boolean).map((result) => result!.document),
    ]);
  }

  async function submitAction(action: ActionType) {
    if (stagedDocuments.length > 0) {
      setState((prev) => ({
        ...prev,
        submitError: "Upload or remove the selected document before submitting your decision.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, submitError: null }));
    try {
      const res = await fetch(`/api/external/procurement/${token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
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

  const currency = "ZMW";
  const uploadInProgress = stagedDocuments.some((document) => document.uploading);

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
          <Table>
            <TableHead>
              <Th className="px-3 py-2">Item</Th>
              <Th align="center" className="px-3 py-2">Qty</Th>
              <Th align="right" className="px-3 py-2">Unit Cost</Th>
              <Th align="right" className="px-3 py-2">Line Total</Th>
            </TableHead>
            <tbody className="divide-y divide-slate-100">
              {pr.purchase_request_line_items.map((l) => (
                <Tr key={l.id}>
                  <Td className="px-3 py-2.5">
                    <span className="font-medium text-slate-700">{l.product_name}</span>
                    {l.sku && <span className="ml-1.5 text-xs text-slate-400">({l.sku})</span>}
                    {l.notes && <p className="text-xs text-slate-400 mt-0.5">{l.notes}</p>}
                  </Td>
                  <Td align="center" className="px-3 py-2.5 text-slate-600">
                    {l.quantity_requested} {l.unit_of_measure}
                  </Td>
                  <Td align="right" className="px-3 py-2.5 text-slate-600">
                    {l.unit_cost != null ? `${currency} ${l.unit_cost.toLocaleString()}` : "—"}
                  </Td>
                  <Td align="right" className="px-3 py-2.5 font-medium text-slate-700">
                    {l.unit_cost != null
                      ? `${currency} ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                      : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
            {pr.estimated_total != null && (
              <tfoot>
                <Tr className="bg-slate-50 hover:bg-slate-50">
                  <Td
                    colSpan={3}
                    align="right"
                    className="px-3 py-2 text-sm font-medium text-slate-600"
                  >
                    Estimated Total
                  </Td>
                  <Td align="right" className="px-3 py-2 font-bold text-slate-800">
                    {currency} {pr.estimated_total.toLocaleString()}
                  </Td>
                </Tr>
              </tfoot>
            )}
          </Table>
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

          {canUpload && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    <FileText className="inline w-4 h-4 mr-1 text-slate-400" />
                    Proforma / Invoice Documents
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Optional PDF, JPEG, or PNG supporting files.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Paperclip className="w-4 h-4" />
                  Attach
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      stageDocuments(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {documentsLoading ? (
                <p className="text-sm text-slate-400">Loading documents…</p>
              ) : documents.length > 0 ? (
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        {document.url ? (
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-sm font-medium text-blue-700 hover:underline"
                          >
                            {document.file_name}
                          </a>
                        ) : (
                          <p className="truncate text-sm font-medium text-slate-700">
                            {document.file_name}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          {document.document_label ?? "Supporting document"}
                          {document.file_size ? ` · ${formatBytes(document.file_size)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-slate-400">No documents uploaded.</p>
              )}

              {stagedDocuments.length > 0 && (
                <div className="space-y-2">
                  {stagedDocuments.map((document, index) => (
                    <div
                      key={`${document.file.name}-${index}`}
                      className="flex items-start gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-2.5"
                    >
                      <FileText className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {document.file.name}
                        </p>
                        <p className="text-xs text-slate-400">{formatBytes(document.file.size)}</p>
                        {document.error && <p className="text-xs text-rose-600">{document.error}</p>}
                      </div>
                      {!document.uploading ? (
                        <button
                          type="button"
                          onClick={() => removeStagedDocument(index)}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                          aria-label={`Remove ${document.file.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-blue-600">Uploading…</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={uploadDocuments}
                    disabled={uploadInProgress}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadInProgress ? "Uploading…" : "Upload Selected"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {allowedActions.includes("APPROVE") && (
              <button
                onClick={() => {
                  setActiveAction("APPROVE");
                  submitAction("APPROVE");
                }}
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
