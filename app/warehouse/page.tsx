"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ArrowUpRight,
  TrendingUp,
  Package,
  CheckCircle,
  Truck,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
  BarChart3,
} from "lucide-react";

// Mock activities and performance metrics
const RECENT_ACTIVITIES = [
  {
    id: "act-1",
    ref: "TRF-2026-00042",
    type: "DISPATCH",
    sbu: "Finance & Admin (North)",
    status: "DISPATCHED",
    time: "25 mins ago",
    items: "3 line items",
  },
  {
    id: "act-2",
    ref: "GRN-2026-98124",
    type: "INBOUND",
    sbu: "Stark Ltd Supplier",
    status: "APPROVED",
    time: "1 hour ago",
    items: "Product PSG-2026-X8",
  },
  {
    id: "act-3",
    ref: "TRF-2026-00041",
    type: "DISPATCH",
    sbu: "Fleet & Transport SBU",
    status: "DISPATCHED",
    time: "4 hours ago",
    items: "Industrial Lubricants",
  },
];

export default function WarehouseDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<"TODAY" | "WEEK" | "MONTH">("TODAY");

  // Multi-period metric simulation
  const stats = {
    TODAY: {
      dispatches: "18 Orders",
      inbound: "14 Receipts",
      variance: "0.00%",
      avgHours: "1.4 hours",
    },
    WEEK: {
      dispatches: "124 Orders",
      inbound: "88 Receipts",
      variance: "0.02%",
      avgHours: "1.8 hours",
    },
    MONTH: {
      dispatches: "492 Orders",
      inbound: "310 Receipts",
      variance: "0.01%",
      avgHours: "1.5 hours",
    },
  }[selectedPeriod];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Dynamic header breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Warehouse Manager</span>
              <span className="text-slate-300">/</span>
              <span className="text-primary font-bold">Performance Overview</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
              Warehouse Ops Command Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Real-time inbound/outbound fulfillment diagnostics, bento analytics, and inventory
              verification.
            </p>
          </div>

          {/* Period selector tabs */}
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 self-start text-xs font-bold shadow-sm">
            {(["TODAY", "WEEK", "MONTH"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer leading-none ${
                  selectedPeriod === period
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Premium Bento Stats / KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Outbound Dispatches */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-primary">
            <div className="w-12 h-12 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-primary">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Outbound Dispatches
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {stats.dispatches}
              </h3>
              <p className="text-[10px] text-teal-650 font-black flex items-center gap-1 mt-1 uppercase">
                <TrendingUp className="w-3 h-3" /> 100% Fulfilled
              </p>
            </div>
          </div>

          {/* Card 2: Inbound GRNs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-primary">
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Supplier Receipts (GRN)
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {stats.inbound}
              </h3>
              <p className="text-[10px] text-blue-600 font-extrabold flex items-center gap-1 mt-1 uppercase">
                🛡 Queued for Approval
              </p>
            </div>
          </div>

          {/* Card 3: Stock Variance Rate */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-primary">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Stock Variance Rate
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {stats.variance}
              </h3>
              <p className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 mt-1 uppercase">
                🎯 High-Accuracy Target
              </p>
            </div>
          </div>

          {/* Card 4: Avg Turnaround Time */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-primary">
            <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Fulfillment SLA
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {stats.avgHours}
              </h3>
              <p className="text-[10px] text-amber-600 font-extrabold flex items-center gap-1 mt-1 uppercase">
                ⚡ industry-leading
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Split Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions & Short Navigation Card (Span 2) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">
                Operational Workflows
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Workflow 1 */}
                <Link
                  href="/warehouse/queue"
                  className="group p-5 border border-slate-200 rounded-xl hover:border-primary/60 hover:bg-slate-50/20 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-12 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-primary mb-3">
                      <Package className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-primary transition flex items-center gap-1">
                      Outbound Dispatch Queue
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 leading-normal">
                      Approve and record SBU transfer requests, handle itemized audits, shortfalls,
                      and courier dispatches.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-black text-primary uppercase">
                    Launch Dispatcher{" "}
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

                {/* Workflow 2 */}
                <Link
                  href="/warehouse/supplier-grn"
                  className="group p-5 border border-slate-200 rounded-xl hover:border-primary/60 hover:bg-slate-50/20 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
                      <Truck className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-primary transition flex items-center gap-1">
                      Inbound Supplier GRN
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 leading-normal">
                      Record supplier stock arrivals, inspect packaging grades, register cost
                      matrices, and queue for Finance audits.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-black text-primary uppercase">
                    Log Inbound Receipt{" "}
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Performance Audit Notice Banner */}
            <div className="bg-amber-50 border border-amber-200 text-[#904D00] rounded-xl p-4 flex gap-3.5 items-start">
              <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="font-extrabold text-[12px] uppercase tracking-wide">
                  Active Dispatch Auditing In Effect
                </h4>
                <p className="text-[11px] font-medium leading-relaxed mt-1 opacity-90">
                  Following the latest standard operation compliance checks, all outbound loads must
                  have physical driver license confirmations and courier plate numbers logged.
                  Dispatch without courier signoff is disabled.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Activity Stream (Span 1) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center justify-between">
              Live Operations Stream
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>

            <div className="flex flex-col gap-4 divide-y divide-slate-100">
              {RECENT_ACTIVITIES.map((act) => (
                <div key={act.id} className="pt-3 first:pt-0 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-primary">{act.ref}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{act.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-700">{act.sbu}</p>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        act.type === "DISPATCH"
                          ? "bg-teal-50 text-teal-700 border border-teal-100"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {act.items} · ({act.type})
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-6 pt-4 text-center">
              <Link
                href="/warehouse/queue"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                View full audit stream
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
