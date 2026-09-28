"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Upload, FileSpreadsheet, Download, CheckCircle2, XCircle } from "lucide-react";

interface ImportResultRow {
  row: number;
  success: boolean;
  error?: string;
}

export default function SalesImportPage() {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);
  const [summary, setSummary] = useState<{ imported: number; failed: number } | null>(null);

  function token() {
    return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
  }

  async function handleUpload(file: File) {
    setImporting(true);
    setError(null);
    setResults(null);
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/sales/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import sales CSV.");
      setResults(data.results ?? []);
      setSummary({ imported: data.imported ?? 0, failed: data.failed ?? 0 });
    } catch (err: any) {
      setError(err.message || "Failed to import sales CSV.");
    } finally {
      setImporting(false);
    }
  }

  const failedRows = (results ?? []).filter((r) => !r.success);

  return (
    <div className="flex flex-col gap-6 w-full">
      <PageHeader
        title="Record Sales"
        description="Import a POS export CSV of goods sold out of a unit store — feeds the Quantity Issued report."
      />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-700">Upload sales CSV</h3>
            <p className="text-xs text-slate-500 mt-1">
              Required columns: unit_code, product_sku, quantity_sold, unit_price, sale_date
              (YYYY-MM-DD).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/unit_sales_template.csv"
              download
              className="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download template
            </a>
            <label className="px-3 py-2 bg-primary text-white hover:opacity-90 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {importing ? "Importing…" : "Upload CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {summary && (
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {summary.imported} imported
            </span>
            {summary.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                <XCircle className="w-3.5 h-3.5" />
                {summary.failed} failed
              </span>
            )}
          </div>
        )}

        {failedRows.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[11px] font-medium">
            <p className="font-bold uppercase tracking-wider text-[10px] mb-1">
              {failedRows.length} row{failedRows.length === 1 ? "" : "s"} skipped
            </p>
            <ul className="list-disc list-inside max-h-56 overflow-y-auto">
              {failedRows.map((r) => (
                <li key={r.row}>
                  Row {r.row}: {r.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!error && !summary && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
            <FileSpreadsheet className="w-8 h-8" />
            <p className="text-xs font-semibold">No file uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
