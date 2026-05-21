"use client";

import { useState } from "react";

interface ExportCard {
  id: string;
  title: string;
  description: string;
  endpoint: string;
}

const EXPORTS: ExportCard[] = [
  {
    id: "transfers",
    title: "Transfer Requests",
    description: "Export all transfer requests with status, SBU, estimated value and dates.",
    endpoint: "/api/exports/transfers",
  },
  {
    id: "grns",
    title: "GRNs",
    description: "Export goods received notes including variance flags.",
    endpoint: "/api/exports/grns",
  },
  {
    id: "supplier-grns",
    title: "Supplier GRNs",
    description: "Export supplier GRNs with invoice references and approval status.",
    endpoint: "/api/exports/supplier-grns",
  },
  {
    id: "audit",
    title: "Audit Log",
    description: "Export the immutable audit trail with actors, actions and timestamps.",
    endpoint: "/api/exports/audit",
  },
];

export default function ExportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);

  const token = () => localStorage.getItem("access_token") ?? "";

  function showToast(id: string) {
    setToasts((prev) => [...prev, id]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t !== id)), 4000);
  }

  async function handleExport(card: ExportCard) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = `${card.endpoint}?${params.toString()}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Export failed");
      return;
    }

    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${card.id}-export.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(card.id);
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Export Data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Download CSV exports of system records. Optionally filter by date range.
      </p>

      {/* Date range */}
      <div className="flex gap-3 mb-8">
        <div>
          <label className="text-xs text-gray-600 block mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXPORTS.map((card) => (
          <div key={card.id} className="bg-white border rounded p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="font-medium text-gray-800">{card.title}</p>
              <p className="text-xs text-gray-500 mt-1">{card.description}</p>
            </div>
            <button
              onClick={() => handleExport(card)}
              className="mt-auto bg-teal-700 text-white rounded px-4 py-2 text-sm hover:bg-teal-800 w-full"
            >
              Export CSV
            </button>
            {toasts.includes(card.id) && (
              <p className="text-green-600 text-xs text-center">
                Export ready — download starting…
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
