"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Table, TableHead, Th, Tr, Td } from "@/components/Table";
import HScrollArea from "@/components/HScrollArea";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { Search, Download, RefreshCw, Package } from "lucide-react";

interface ReportRow {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  sbu_id: string;
  sbu_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_issued_period: number;
  quantity_sold_period: number;
  amount_sold_period: number;
  balance: number;
}

interface Sbu {
  id: string;
  name: string;
  code: string;
}

const PRIVILEGED_ROLES = ["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"];

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function QuantityIssuedReportPage() {
  const [role, setRole] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [sbus, setSbus] = useState<Sbu[]>([]);
  const [selectedSbuId, setSelectedSbuId] = useState("");
  const { currency, fmt, toggleCurrency } = useCurrency();

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  useEffect(() => {
    const r = typeof window !== "undefined" ? (localStorage.getItem("user_role") ?? "") : "";
    setRole(r);
    if (PRIVILEGED_ROLES.includes(r)) {
      fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } })
        .then((res) => res.json())
        .then((data: Sbu[]) => setSbus(data ?? []))
        .catch(() => undefined);
    }
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedSbuId) params.set("sbu_id", selectedSbuId);
      const res = await fetch(`/api/reports/quantity-issued?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load report");
      setRows(data ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selectedSbuId]);

  function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedSbuId) params.set("sbu_id", selectedSbuId);
    params.set("format", "csv");
    fetch(`/api/reports/quantity-issued?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quantity-issued-report.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.unit_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // BU Manager: issued / sold / balance. Finance: sold / amount / balance.
  // Admin & Warehouse Manager get the full picture.
  const showIssued = role !== "FINANCE_MANAGER";
  const showAmount = role !== "BU_MANAGER";

  return (
    <div className="flex flex-col gap-6 w-full">
      <PageHeader
        title="Quantity Issued Report"
        description="Track how stock moved out of each unit store — issued from the warehouse and sold to customers."
        actions={
          <button
            onClick={downloadCsv}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
          />
        </div>
        {PRIVILEGED_ROLES.includes(role) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">SBU</label>
            <select
              value={selectedSbuId}
              onChange={(e) => setSelectedSbuId(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white cursor-pointer"
            >
              <option value="">All SBUs</option>
              {sbus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5 flex-1 min-w-52">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Search
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product, SKU or unit..."
              className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
            />
          </div>
        </div>
        {showAmount && (
          <button
            type="button"
            onClick={toggleCurrency}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            {currency}
          </button>
        )}
        <button
          type="button"
          onClick={load}
          className="p-2.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <HScrollArea>
          <Table className="w-full text-left border-collapse">
            <TableHead>
              <Th>Unit Store</Th>
              <Th>Product</Th>
              <Th className="font-mono">SKU</Th>
              {showIssued && <Th align="center">Quantity Issued</Th>}
              <Th align="center">Quantity Sold</Th>
              {showAmount && <Th align="right">Amount</Th>}
              <Th align="center">Balance</Th>
            </TableHead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <Tr>
                  <Td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">
                    Loading…
                  </Td>
                </Tr>
              ) : filteredRows.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-6 h-6" />
                      No sales or issuance activity found for this period.
                    </div>
                  </Td>
                </Tr>
              ) : (
                filteredRows.map((r) => (
                  <Tr key={`${r.unit_id}:${r.product_id}`}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{r.unit_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.unit_code} · {r.sbu_name}
                        </span>
                      </div>
                    </Td>
                    <Td className="font-semibold text-slate-700">{r.product_name}</Td>
                    <Td className="font-mono text-slate-500">{r.sku}</Td>
                    {showIssued && (
                      <Td className="text-center font-mono font-bold text-slate-700">
                        {r.quantity_issued_period.toLocaleString()}
                      </Td>
                    )}
                    <Td className="text-center font-mono font-bold text-slate-700">
                      {r.quantity_sold_period.toLocaleString()}
                    </Td>
                    {showAmount && (
                      <Td className="text-right font-mono font-bold text-slate-700">
                        {fmt(r.amount_sold_period)}
                      </Td>
                    )}
                    <Td
                      className={`text-center font-mono font-extrabold ${
                        r.balance < 0 ? "text-rose-600" : "text-emerald-700"
                      }`}
                    >
                      {r.balance.toLocaleString()}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </HScrollArea>
      </div>
    </div>
  );
}
