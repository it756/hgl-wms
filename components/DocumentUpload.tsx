"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Image, Paperclip, Trash2, Upload, X } from "lucide-react";

export type TransactionType =
  | "transfer_request"
  | "issuance"
  | "grn"
  | "supplier_grn"
  | "return_request";

export interface TransactionDocument {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  document_label: string | null;
  uploaded_by: string;
  created_at: string;
  url: string | null;
}

interface StagedFile {
  file: File;
  label: string;
  uploading: boolean;
  error: string | null;
}

interface DocumentUploadProps {
  transactionType: TransactionType;
  transactionId: string;
  /** Whether the currently logged-in user can delete documents */
  canDelete: boolean;
  /** Auth token for API calls */
  token: string;
  /** When true, hides upload controls — display-only mode for reviewers */
  readOnly?: boolean;
  /** Called after each successful upload so the parent can update state if needed */
  onUploaded?: (doc: TransactionDocument) => void;
  /** Called after a document is deleted */
  onDeleted?: (id: string) => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image className="w-4 h-4 flex-shrink-0" />;
  return <FileText className="w-4 h-4 flex-shrink-0" />;
}

export default function DocumentUpload({
  transactionType,
  transactionId,
  canDelete,
  token,
  readOnly = false,
  onUploaded,
  onDeleted,
}: DocumentUploadProps) {
  const [docs, setDocs] = useState<TransactionDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch existing documents ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingDocs(true);

    fetch(`/api/documents?transaction_type=${transactionType}&transaction_id=${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDocs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transactionType, transactionId, token]);

  // ── Stage files from picker ───────────────────────────────────────────────
  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newStaged: StagedFile[] = files.map((f) => ({
      file: f,
      label: "",
      uploading: false,
      error: null,
    }));
    setStaged((prev) => [...prev, ...newStaged]);
    // Reset input so the same file can be picked again if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeStaged(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLabel(index: number, label: string) {
    setStaged((prev) => prev.map((s, i) => (i === index ? { ...s, label } : s)));
  }

  // ── Upload all staged files ───────────────────────────────────────────────
  async function uploadAll() {
    if (staged.length === 0) return;

    const results = await Promise.all(
      staged.map(async (s, index) => {
        setStaged((prev) =>
          prev.map((item, i) => (i === index ? { ...item, uploading: true, error: null } : item)),
        );

        const form = new FormData();
        form.append("file", s.file);
        form.append("transaction_type", transactionType);
        form.append("transaction_id", transactionId);
        if (s.label.trim()) form.append("document_label", s.label.trim());

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStaged((prev) =>
            prev.map((item, i) =>
              i === index
                ? { ...item, uploading: false, error: data.error ?? "Upload failed" }
                : item,
            ),
          );
          return null;
        }

        const doc: TransactionDocument = await res.json();
        setStaged((prev) =>
          prev.map((item, i) => (i === index ? { ...item, uploading: false } : item)),
        );
        return { doc, index };
      }),
    );

    // Remove successfully uploaded staged files and add to docs list
    const successfulIndices = new Set(results.filter(Boolean).map((r) => r!.index));
    setStaged((prev) => prev.filter((_, i) => !successfulIndices.has(i)));
    const newDocs = results.filter(Boolean).map((r) => r!.doc);
    if (newDocs.length > 0) {
      setDocs((prev) => [...prev, ...newDocs]);
      newDocs.forEach((d) => onUploaded?.(d));
    }
  }

  // ── Delete an existing document ───────────────────────────────────────────
  async function deleteDoc(id: string) {
    if (!confirm("Remove this document? This cannot be undone.")) return;
    setDeletingId(id);

    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete document");
      return;
    }

    setDocs((prev) => prev.filter((d) => d.id !== id));
    onDeleted?.(id);
  }

  const hasStaged = staged.length > 0;
  const isUploading = staged.some((s) => s.uploading);

  return (
    <div className="space-y-4">
      {/* Existing documents */}
      {loadingDocs ? (
        <p className="text-sm text-gray-500">Loading documents…</p>
      ) : docs.length === 0 && !hasStaged ? (
        <p className="text-sm text-gray-400 italic">No documents attached.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              <FileIcon mime={doc.mime_type} />
              <div className="flex-1 min-w-0">
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline truncate block"
                  >
                    {doc.file_name}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-gray-700 truncate block">
                    {doc.file_name}
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {doc.document_label && (
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {doc.document_label}
                    </span>
                  )}
                  {doc.file_size && <span>{formatBytes(doc.file_size)}</span>}
                </div>
              </div>
              {canDelete && (
                <button
                  onClick={() => deleteDoc(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50"
                  title="Remove document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Staged files */}
      {staged.length > 0 && (
        <ul className="space-y-2">
          {staged.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50"
            >
              <FileIcon mime={s.file.type} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-medium text-gray-700 truncate">{s.file.name}</p>
                <input
                  type="text"
                  placeholder="Label (e.g. Invoice, Delivery Note)"
                  value={s.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  disabled={s.uploading}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                />
                {s.error && <p className="text-xs text-red-600">{s.error}</p>}
              </div>
              {!s.uploading && (
                <button
                  onClick={() => removeStaged(i)}
                  className="p-1 text-gray-400 hover:text-gray-600 mt-0.5"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {s.uploading && (
                <span className="text-xs text-blue-500 mt-1 whitespace-nowrap">Uploading…</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Controls — hidden in read-only mode */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`doc-picker-${transactionId}`}
            className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
            Attach files
          </label>
          <input
            ref={fileInputRef}
            id={`doc-picker-${transactionId}`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            className="sr-only"
            onChange={handleFilePick}
          />
          {hasStaged && (
            <button
              onClick={uploadAll}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {isUploading
                ? "Uploading…"
                : `Upload ${staged.length} file${staged.length > 1 ? "s" : ""}`}
            </button>
          )}
          <span className="text-xs text-gray-400">PDF, JPEG or PNG · max 20 MB each</span>
        </div>
      )}
    </div>
  );
}
