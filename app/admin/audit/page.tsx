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

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  
  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      
      const res = await fetch(`/api/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load audit log");
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setEntityType("");
    setFrom("");
    setTo("");
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <DashboardLayout activePage="/admin/audit">
      <div className="flex flex-col gap-6 text-[#1E293B]">
        
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Administration</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#005c55]">System Audit Logs</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Monitor real-time system changes, database entities state logs, warehouse operation events, and user activities.
          </p>
        </div>

        {/* Filter Toolbar Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3 text-[#005c55]" /> Entity Type
              </label>
              <input
                type="text"
                placeholder="e.g. transfer_request"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#005c55]" /> From Timestamp
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-700"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#005c55]" /> End Date Limit
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-700"
              />
            </div>
          </div>

          <div className="flex gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={resetFilters}
              title="Reset Search Fields"
              className="flex-1 md:flex-initial p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fetchLogs}
              className="flex-1 md:flex-initial px-5 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
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
          ) : logs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
              <Database className="w-8 h-8 text-slate-200" />
              <p className="font-extrabold text-xs font-mono uppercase text-slate-405">No auditable actions stored under selection.</p>
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
                  {logs.map((log) => (
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
                        {log.entity_id ? log.entity_id.slice(0, 8) : "—"}
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
                            {log.performed_by.slice(0, 8)}
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
