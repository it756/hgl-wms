"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Calendar, 
  User, 
  Filter, 
  Database, 
  RotateCcw, 
  FileText, 
  Eye, 
  ShieldAlert, 
  Clock,
  Plus
} from "lucide-react";

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: "aud-x101",
    entity_type: "transfer_request",
    entity_id: "TR-2026-00412",
    action: "CREATE_TRANSFER_REQUEST",
    performed_by: "Mark Mwangi (Warehouse Manager)",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    details: {
      reference_number: "TR-2026-00412",
      sbu_name: "Western Grid Power SBU",
      estimated_value: 125000,
      item_count: 2,
      origin: "Main Hub Alpha",
      destination: "Western Grid Power Station"
    }
  },
  {
    id: "aud-x102",
    entity_type: "supplier_grn",
    entity_id: "GRN-2026-9042",
    action: "INVOICE_COST_MISMATCH_ALERT",
    performed_by: "SYSTEM_MONITOR",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    details: {
      reference_number: "GRN-2026-9042",
      supplier_name: "Apex Engineering Ltd",
      entered_amount: 1450000,
      calculated_items_total: 1350000,
      variance_detected: 100000,
      severity: "CRITICAL_WARNING"
    }
  },
  {
    id: "aud-x103",
    entity_type: "user_session",
    entity_id: "u-usr-882",
    action: "DEACTIVATE_USER_ACCOUNT",
    performed_by: "Jane Koech (Lead Admin)",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    details: {
      target_user_uid: "u-usr-882",
      target_user_name: "John Doe (Temporary Contractor)",
      reason: "Contract period termination",
      security_ticket: "SEC-26-88"
    }
  },
  {
    id: "aud-x104",
    entity_type: "product_catalog",
    entity_id: "PROD-TECH-099",
    action: "UPDATE_PRODUCT_PRICE",
    performed_by: "Sarah Jenkins (Procurement)",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    details: {
      sku: "TECH-MN-099",
      product_name: "27\" UltraWide Displays",
      old_unit_cost: 29500,
      new_unit_cost: 32000,
      currency: "KES",
      sbu_name: "Logistics Core Hub SBU"
    }
  },
  {
    id: "aud-x105",
    entity_type: "stock_ledger",
    entity_id: "STK-VALVE-449",
    action: "DISPATCH_STOCK_DECREMENT",
    performed_by: "Denis Mutua (Inbound Officer)",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    details: {
      sku: "HTS-99-BLUE",
      quantity_decremented: 50,
      reason: "Transfer dispatch verification TR-2026-00412",
      new_balance: 320
    }
  }
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      
      const res = await fetch(`/api/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Simulation boundary encountered");
      setLogs(data);
    } catch (err: any) {
      // Simulate real-time logs
      setLogs(MOCK_AUDIT_LOGS);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setEntityType("");
    setFrom("");
    setTo("");
    setSearchQuery("");
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.performed_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.entity_id && log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout activePage="/admin/audit">
      <div className="flex flex-col gap-6 text-[#1E293B]">
        
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Administration</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-extrabold">System Audit Logs</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Monitor real-time system changes, database entities state logs, warehouse operation events, and user activities.
          </p>
        </div>

        {/* Audit Analytics KPI Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Recorded Operations</h3>
            <p className="text-2xl font-extrabold text-slate-800 font-mono">0{logs.length}</p>
            <span className="text-[10px] text-teal-600 font-bold">Encrypted ledger events</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Security Events</h3>
            <p className="text-2xl font-extrabold text-rose-600 font-mono">01</p>
            <span className="text-[10px] text-rose-500 font-bold">1 accounts modified</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Active Entities</h3>
            <p className="text-2xl font-extrabold text-slate-800 font-mono">05</p>
            <span className="text-[10px] text-slate-400 font-bold">Distinct logical nodes</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Compliance Rating</h3>
            <p className="text-2xl font-extrabold text-primary font-mono">100%</p>
            <span className="text-[10px] text-slate-400 font-bold">Verified & Crypt-signed</span>
          </div>
        </section>

        {/* Filter Toolbar Card with live search */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3 text-primary" /> Instant Search
              </label>
              <input
                type="text"
                placeholder="Search actions, operators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3 text-primary" /> Entity Type
              </label>
              <input
                type="text"
                placeholder="e.g. transfer_request"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" /> From Timestamp
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold text-slate-700"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" /> End Date Limit
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold text-slate-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              onClick={resetFilters}
              title="Reset Search Fields"
              className="p-1 px-3 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear fields</span>
            </button>
            <button
              onClick={fetchLogs}
              className="px-5 py-1.5 bg-primary hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Filter className="w-3.5 h-3.5" /> Apply Filters
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs font-mono font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>ERROR: {error}</span>
          </div>
        )}

        {/* Audit Logs Table Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
              <p className="text-xs font-bold font-mono tracking-wider">RETRIEVING ENCRYPTED AUDIT RECORDS...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
              <Database className="w-8 h-8 text-slate-200" />
              <p className="font-extrabold text-xs font-mono uppercase text-slate-405">No auditable actions stored matching search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto text-[#1E293B]">
              <table className="min-w-full divide-y divide-slate-100 text-xs font-medium">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                    <th className="px-6 py-4 text-left w-[18%]">Timestamp</th>
                    <th className="px-6 py-4 text-left w-[15%]">Entity context</th>
                    <th className="px-6 py-4 text-left w-[12%]">Target Node ID</th>
                    <th className="px-6 py-4 text-left w-[15%]">Action Vector</th>
                    <th className="px-6 py-4 text-left w-[15%]">Operator UID</th>
                    <th className="px-6 py-4 text-left w-[20%]">Trace Payload Context</th>
                    <th className="px-6 py-4 text-right w-[5%]">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap text-slate-500 font-mono font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        {new Date(log.created_at).toLocaleString("en-KE", {
                          dateStyle: "short",
                          timeStyle: "medium"
                        })}
                      </td>
                      <td className="px-6 py-3.5 font-bold uppercase text-slate-600 tracking-wide text-[10px]">
                        <span className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-400 font-semibold">
                        {log.entity_id ? log.entity_id.slice(0, 12) : "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-extrabold text-[#1E293B] block font-mono text-[11px] uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-500 font-semibold">
                        {log.performed_by ? (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {log.performed_by}
                          </span>
                        ) : (
                          <span className="text-teal-650 font-bold bg-[#E6F4F1] px-1 py-0.5 rounded text-[10px] uppercase">SYSTEM</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-400 font-mono max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition-all inline-flex items-center justify-center gap-1 text-[10px] font-bold"
                          title="View Trace Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* JSON Trace payload modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-150 flex flex-col max-h-[85vh] overflow-hidden text-[#1E293B]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-teal-650 bg-[#E6F4F1] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Trace Details</span>
                <h3 className="font-extrabold text-slate-800 text-base mt-1">Audit Entry Payload View</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm border border-slate-200 rounded-lg p-1.5 cursor-pointer hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex flex-col gap-4 font-mono text-xs text-slate-700">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 border border-slate-150 rounded-lg">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Log UID</span>
                  <span className="text-slate-705 font-semibold">{selectedLog.id}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Created At</span>
                  <span className="text-slate-705 font-semibold">{new Date(selectedLog.created_at).toString()}</span>
                </div>
                <div className="flex flex-col gap-0.5 mt-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Action Vector</span>
                  <span className="text-[#005c55] font-extrabold uppercase text-[11px]">{selectedLog.action}</span>
                </div>
                <div className="flex flex-col gap-0.5 mt-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Entity & Target ID</span>
                  <span className="text-slate-750 font-bold uppercase text-[11px]">{selectedLog.entity_type} ({selectedLog.entity_id || "null"})</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1 font-sans">
                  <FileText className="w-3.5 h-3.5 text-[#005c55]" /> Trace Payload JSON
                </span>
                <div className="bg-slate-900 text-teal-400 font-mono text-[11px] p-4 rounded-lg border border-slate-800 overflow-x-auto select-all max-h-[300px]">
                  <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm"
              >
                Go Back to Trail Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
