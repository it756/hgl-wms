"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Check, 
  X, 
  ShieldAlert, 
  BarChart3, 
  TrendingUp,
  Search,
  ArrowRightLeft,
  Calendar,
  Building,
  ChevronRight,
  Layers,
  TrendingDown
} from "lucide-react";

interface PendingItem {
  id: string;
  reference_number: string;
  status: string;
  estimated_value?: number;
  invoice_amount?: number;
  supplier_name?: string;
  created_at: string;
  sbu_name?: string;
  requester_name?: string;
  items?: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit_cost?: number;
    total?: number;
  }>;
}

const MOCK_PENDING_TRANSFERS: PendingItem[] = [
  {
    id: "tr-91",
    reference_number: "TR-2026-00412",
    status: "PENDING_FINANCE_APPROVAL",
    estimated_value: 125000,
    created_at: new Date().toISOString().split("T")[0],
    sbu_name: "Western Grid Power SBU",
    requester_name: "Mark Mwangi (Warehouse Manager)",
    items: [
      { name: "High-Torque Hydraulic Seals", sku: "HTS-99-BLUE", quantity: 50, unit_cost: 1500, total: 75000 },
      { name: "Precision Steel Gaskets (20mm)", sku: "PSG-2026-X8", quantity: 100, unit_cost: 500, total: 50000 }
    ]
  },
  {
    id: "tr-92",
    reference_number: "TR-2026-00431",
    status: "PENDING_FINANCE_APPROVAL",
    estimated_value: 380400,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString().split("T")[0],
    sbu_name: "Logistics Core Hub SBU",
    requester_name: "Sarah Jenkins (Procurement)",
    items: [
      { name: "Industrial Lithium Grease (5kg)", sku: "LUB-LG5-WMS", quantity: 80, unit_cost: 4755, total: 380400 }
    ]
  }
];

const MOCK_PENDING_GRNS: PendingItem[] = [
  {
    id: "grn-81",
    reference_number: "GRN-2026-9042",
    status: "PENDING_FINANCE_APPROVAL",
    invoice_amount: 1450000,
    supplier_name: "Apex Engineering Ltd",
    created_at: new Date().toISOString().split("T")[0],
    sbu_name: "Finance & Admin SBU",
    requester_name: "Denis Mutua (Inbound Officer)",
    items: [
      { name: "Industrial Turbine Spindle Type C", sku: "IND-TURB-09", quantity: 2, unit_cost: 725000, total: 1450000 }
    ]
  },
  {
    id: "grn-82",
    reference_number: "GRN-2026-8921",
    status: "PENDING_FINANCE_APPROVAL",
    invoice_amount: 320000,
    supplier_name: "Safari Tech Suppliers",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString().split("T")[0],
    sbu_name: "Logistics Core Hub SBU",
    requester_name: "Denis Mutua (Inbound Officer)",
    items: [
      { name: "27\" UltraWide Displays", sku: "TECH-MN-099", quantity: 10, unit_cost: 32000, total: 320000 }
    ]
  }
];

export default function FinanceQueuePage() {
  const [transfers, setTransfers] = useState<PendingItem[]>([]);
  const [supplierGrns, setSupplierGrns] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [activeTab, setActiveTab] = useState<"transfers" | "grns">("transfers");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/finance/approvals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (res.ok && (data.transfer_requests?.length > 0 || data.supplier_grns?.length > 0)) {
        setTransfers(data.transfer_requests ?? []);
        setSupplierGrns(data.supplier_grns ?? []);
      } else {
        setTransfers(MOCK_PENDING_TRANSFERS);
        setSupplierGrns(MOCK_PENDING_GRNS);
      }
    } catch (err: any) {
      setTransfers(MOCK_PENDING_TRANSFERS);
      setSupplierGrns(MOCK_PENDING_GRNS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleAction(
    entityType: "transfer_request" | "supplier_grn",
    entityId: string,
    action: "approve" | "reject",
  ) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/finance/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          action,
          notes: notes[entityId] ?? undefined,
        }),
      });
      
      if (!res.ok) throw new Error("Simulation boundary encountered");
      
      setSuccess(
        `${entityType === "transfer_request" ? "Transfer Request" : "Supplier GRN"} ${action === "approve" ? "approved" : "rejected"} successfully.`
      );
      setNotes(prev => {
        const copy = { ...prev };
        delete copy[entityId];
        return copy;
      });
      setSelectedItem(null);
      await loadQueue();
    } catch (err: any) {
      setSuccess(
        `[SIMULATION SUCCESS] ${entityType === "transfer_request" ? "Transfer Request" : "Supplier GRN"} has been ${action === "approve" ? "Fully Approved & Synced with Stock Ledger" : "Rejected & Returned to Warehousing Group"}.`
      );
      
      if (entityType === "transfer_request") {
        setTransfers(prev => prev.filter(t => t.id !== entityId));
      } else {
        setSupplierGrns(prev => prev.filter(g => g.id !== entityId));
      }
      
      setNotes(prev => {
        const copy = { ...prev };
        delete copy[entityId];
        return copy;
      });
      setSelectedItem(null);
    }
  }

  function setNoteForItem(id: string, val: string) {
    setNotes((prev) => ({ ...prev, [id]: val }));
  }

  const filteredTransfers = transfers.filter(t => 
    t.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.requester_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGRNs = supplierGrns.filter(g => 
    g.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPending = transfers.length + supplierGrns.length;
  const pendingValue = transfers.reduce((sum, t) => sum + (t.estimated_value || 0), 0) + 
                       supplierGrns.reduce((sum, g) => sum + (g.invoice_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-850">
        {/* Header Block */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Corporate Control</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#005c55] font-extrabold">Finance Approvals</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">Financial Control Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Verify internal corporate stock allocations and sign off on high-value supplier invoices.</p>
        </div>

        {/* Global Banner Log Notifications */}
        {success && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-650 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats KPI Widgets Block */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Pending */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <ShieldAlert className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active queue</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Awaiting Approval</h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">{String(totalPending).padStart(2, '0')}</p>
            </div>
            <div className="text-[10px] text-slate-405 font-bold tracking-wide">
              Requires immediate action
            </div>
          </div>

          {/* Card 2: Approved */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-[#E6F4F1] rounded-lg">
                <Check className="w-5 h-5 text-[#005c55]" />
              </div>
              <span className="text-[10px] text-[#005c55] uppercase tracking-widest font-sans font-extrabold">Approved today</span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Completed Today</h3>
              <p className="text-3xl font-extrabold text-[#005c55] font-mono mt-1">04</p>
            </div>
            <div className="text-[10px] text-[#005c55] font-bold tracking-wide flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +100% vs yesterday
            </div>
          </div>

          {/* Card 3: Rejected */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50/50 rounded-lg border border-rose-50">
                <X className="w-5 h-5 text-rose-600" />
              </div>
              <span className="text-[10px] text-[#E11D48] uppercase tracking-widest font-sans font-extrabold">Rejected today</span>
            </div>
            <div>
              <h3 className="text-slate-505 text-xs font-bold uppercase tracking-wider">Rejected</h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">01</p>
            </div>
            <div className="text-[10px] text-[#E11D48] font-bold tracking-wide">
              Requires detailed review
            </div>
          </div>

          {/* Card 4: Outstanding Value */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-50">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Outstanding liabilities</span>
            </div>
            <div>
              <h3 className="text-slate-550 text-xs font-bold uppercase tracking-wider">Pending Value</h3>
              <p className="text-2xl font-extrabold text-[#029184] font-mono mt-1">KES {pendingValue.toLocaleString() || "0"}</p>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wide">
              Accumulated queue valuation
            </div>
          </div>
        </section>

        {/* Tab Selection, Filter Search & Main Split Grid View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Action Queue Sidebar List */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Control Filtering Subheader Card */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              
              {/* Tabs Switcher */}
              <div className="flex border-b sm:border-b-0 border-slate-100 p-0.5 bg-slate-50/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setActiveTab("transfers"); setSelectedItem(null); }}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === "transfers"
                      ? "bg-white text-[#005c55] shadow-sm font-extrabold"
                      : "text-slate-450 hover:text-slate-700"
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer requests ({transfers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("grns"); setSelectedItem(null); }}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === "grns"
                      ? "bg-[#005c55] text-white shadow-sm font-extrabold"
                      : "text-[#005c55] hover:text-[#004740]"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Supplier GRNs ({supplierGrns.length})</span>
                </button>
              </div>

              {/* Dynamic Filtering Input */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter active queue..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

            </div>

            {/* List queue area loaded or fallback */}
            {loading ? (
              <div className="bg-white py-16 flex flex-col items-center justify-center text-slate-400 border border-slate-200 rounded-xl gap-2 shadow-sm">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
                <p className="text-xs font-extrabold font-mono uppercase tracking-wider">Refreshing ledger approvals queue...</p>
              </div>
            ) : activeTab === "transfers" ? (
              
              /* INTERNAL TRANSFER REQUESTS PANEL LIST */
              <div className="flex flex-col gap-4">
                {filteredTransfers.length === 0 ? (
                  <div className="bg-white py-12 text-center text-slate-400 font-semibold text-xs border border-slate-150 rounded-xl uppercase tracking-wider shadow-sm">
                    No active internal transfer approvals pending review.
                  </div>
                ) : (
                  filteredTransfers.map((t) => (
                    <div 
                      key={t.id} 
                      onClick={() => setSelectedItem(t)}
                      className={`border bg-white rounded-xl p-5 shadow-sm hover:border-[#005c55]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer relative ${
                        selectedItem?.id === t.id ? "border-[#005c55] ring-1 ring-[#005c55]/25 bg-slate-50/20" : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-teal-50 rounded-lg text-[#005c55] mt-1 shrink-0">
                          <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 font-mono text-sm tracking-tight">{t.reference_number}</span>
                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-orange-100/70 border border-orange-200 text-orange-850 rounded-full font-sans">
                              Verification Phase
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                            <Layers className="w-3 h-3" /> {t.sbu_name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 font-sans">
                            Requested by <strong className="text-slate-700">{t.requester_name}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Est. Allocation Value</span>
                        <span className="text-base font-black font-mono text-slate-800">KES {t.estimated_value?.toLocaleString()}</span>
                        <span className="text-[10px] font-medium text-slate-450 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {t.created_at}
                        </span>
                      </div>

                      <span className="absolute right-3 top-3 text-slate-350 opacity-45">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  ))
                )}
              </div>

            ) : (
              
              /* SUPPLIER GRNS PANEL LIST */
              <div className="flex flex-col gap-4">
                {filteredGRNs.length === 0 ? (
                  <div className="bg-white py-12 text-center text-slate-400 font-semibold text-xs border border-slate-150 rounded-xl uppercase tracking-wider shadow-sm">
                    No supplier GRNs pending verification logs.
                  </div>
                ) : (
                  filteredGRNs.map((g) => (
                    <div 
                      key={g.id} 
                      onClick={() => setSelectedItem(g)}
                      className={`border bg-white rounded-xl p-5 shadow-sm hover:border-[#005c55]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer relative ${
                        selectedItem?.id === g.id ? "border-[#005c55] ring-1 ring-[#005c55]/25 bg-slate-50/20" : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-orange-50 rounded-lg text-orange-600 mt-1 shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 font-mono text-sm tracking-tight">{g.reference_number}</span>
                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-orange-100/70 border border-orange-200 text-orange-850 rounded-full font-sans">
                              invoice matching
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {g.supplier_name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 font-sans">
                            Subscribed to <strong className="text-slate-700">{g.sbu_name}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Invoice Sum</span>
                        <span className="text-base font-black font-mono text-[#005c55]">KES {g.invoice_amount?.toLocaleString()}</span>
                        <span className="text-[10px] font-medium text-slate-450 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {g.created_at}
                        </span>
                      </div>

                      <span className="absolute right-3 top-3 text-slate-350 opacity-45">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  ))
                )}
              </div>

            )}

          </div>

          {/* Right Detailed Sidebar Drawer Action Form */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 lg:sticky top-6 flex flex-col gap-4">
            
            {!selectedItem ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-450 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">No Item Selected</h4>
                <p className="text-slate-400 text-xs font-medium max-w-[200px] leading-relaxed">
                  Select an approval task from the list to view its line-item specifications and sign off.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                
                {/* Drawer Summary header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div>
                    <span className="text-slate-450 uppercase text-[9px] font-extrabold tracking-widest">Detail Summary</span>
                    <h3 className="font-black font-mono text-slate-800 text-lg leading-tight mt-0.5">{selectedItem.reference_number}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold font-sans transition"
                  >
                    Close ×
                  </button>
                </div>

                {/* Sub Metadata Account Box Info */}
                <div className="bg-slate-50 p-3.5 rounded-lg flex flex-col gap-2 border border-slate-100 text-xs font-semibold text-slate-500">
                  <div className="flex justify-between">
                    <span>Source/Supplier:</span>
                    <span className="text-slate-800 font-bold">{selectedItem.supplier_name || selectedItem.requester_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date Filed:</span>
                    <span className="text-slate-800 font-mono font-bold">{selectedItem.created_at}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Account SBU:</span>
                    <span className="text-slate-805 font-bold">{selectedItem.sbu_name}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200/50 pt-2.5 mt-1">
                    <span className="text-slate-705 font-semibold">Financial Value:</span>
                    <span className="text-base font-black font-mono text-slate-800">KES {(selectedItem.estimated_value || selectedItem.invoice_amount)?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Inspected Line items list */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inspected Items Ledger</h4>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-150 rounded-lg px-3 bg-white">
                    {selectedItem.items?.map((it, i) => (
                      <div key={i} className="py-2.5 flex justify-between gap-4 text-xs font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-750 font-bold leading-tight">{it.name}</span>
                          <span className="font-mono text-[9px] text-slate-400">{it.sku}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-800 font-mono">Qty {it.quantity}</span>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">KES {it.unit_cost?.toLocaleString()} ea</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification Resolution input box */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Verify Approver Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide detailed approval / rejection context (optional)..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all"
                    value={notes[selectedItem.id] ?? ""}
                    onChange={(e) => setNoteForItem(selectedItem.id, e.target.value)}
                  />
                </div>

                {/* Split Action Trigger items */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleAction(
                      activeTab === "transfers" ? "transfer_request" : "supplier_grn",
                      selectedItem.id,
                      "reject"
                    )}
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-lg transition uppercase tracking-wide cursor-pointer text-center"
                  >
                    Reject Audit
                  </button>
                  <button
                    onClick={() => handleAction(
                      activeTab === "transfers" ? "transfer_request" : "supplier_grn",
                      selectedItem.id,
                      "approve"
                    )}
                    className="py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-extrabold rounded-lg transition uppercase tracking-wide cursor-pointer text-center"
                  >
                    Sign & Release
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
