"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Building2, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Edit3, 
  Power, 
  AlertCircle, 
  Check, 
  X, 
  ShieldAlert, 
  Calculator,
  ChevronRight,
  TrendingUp,
  Activity
} from "lucide-react";

interface SBU {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  finance_approval_threshold: number | null;
}

export default function SBUsPage() {
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Inline edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editThreshold, setEditThreshold] = useState("");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sbus", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSbus(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(s: SBU) {
    setEditing(s.id);
    setEditName(s.name);
    setEditCode(s.code);
    setEditThreshold(s.finance_approval_threshold?.toString() ?? "");
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/admin/sbus/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          finance_approval_threshold: editThreshold ? Number(editThreshold) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update SBU");
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleActive(s: SBU) {
    try {
      const res = await fetch(`/api/admin/sbus/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to toggle status");
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await fetch("/api/admin/sbus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: newName, code: newCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setNewName("");
      setNewCode("");
      load();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  const filtered = sbus.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full font-sans">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Admin</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#005c55]">SBU Registry</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">Strategic Business Units</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Manage corporate branches, custom threshold configurations, and transaction rules.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="self-start md:self-auto px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Strategic Unit
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-250 text-rose-750 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add SBU Form Block */}
        {showForm && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm animate-none">
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#005c55]" />
              Register New Strategic Business Unit (SBU)
            </h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">SBU Name</label>
                <input
                  required
                  placeholder="e.g. Catering SBU"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all font-medium text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Unit Code</label>
                <input
                  required
                  placeholder="e.g. CAT"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all font-mono font-medium text-slate-850"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Commit
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
              {formError && (
                <p className="text-rose-600 text-xs font-semibold font-mono uppercase mt-1 md:col-span-3">{formError}</p>
              )}
            </form>
          </div>
        )}

        {/* List Card Container */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100/50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search SBU name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold font-mono">
              <Activity className="w-3.5 h-3.5 text-[#005c55]" />
              <span>ACTIVE UNITS: {sbus.filter(s => s.is_active).length}</span>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
              <p className="text-xs font-bold font-mono">RETRIEVING REGISTERED SBUS...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-semibold text-xs font-mono uppercase">
              No matching Strategic Business Units found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs font-medium">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4.5 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-2/5">
                      Business Unit Name
                    </th>
                    <th className="px-6 py-4.5 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-1/5">
                      SBU Code
                    </th>
                    <th className="px-6 py-4.5 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-1/4">
                      Approval Threshold Override
                    </th>
                    <th className="px-6 py-4.5 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">
                      Status
                    </th>
                    <th className="px-6 py-4.5 text-right font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[15%]">
                      Operations
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((s) => {
                    const isEditingThisSBU = editing === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5">
                          {isEditingThisSBU ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full max-w-sm px-3 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] font-semibold text-slate-850"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="font-bold text-slate-800 text-sm">{s.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {isEditingThisSBU ? (
                            <input
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                              maxLength={10}
                              className="w-24 px-3 py-1 border border-slate-200 rounded-lg text-xs text-center font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] font-semibold text-slate-850"
                            />
                          ) : (
                            <span className="font-mono bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                              {s.code}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {isEditingThisSBU ? (
                            <div className="relative max-w-xs flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">ZMW</span>
                              <input
                                type="number"
                                value={editThreshold}
                                onChange={(e) => setEditThreshold(e.target.value)}
                                placeholder="global threshold default"
                                className="w-32 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] font-semibold text-slate-850"
                              />
                            </div>
                          ) : s.finance_approval_threshold != null ? (
                            <span className="font-mono text-[#0D9488] font-bold">
                            K {s.finance_approval_threshold.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold italic text-[11px]">
                              Default (Global threshold)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              s.is_active 
                                ? "bg-teal-50 border border-teal-250 text-teal-800" 
                                : "bg-slate-100 border border-slate-200 text-slate-650"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? "bg-teal-600" : "bg-slate-400"}`}></span>
                            {s.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {isEditingThisSBU ? (
                              <>
                                <button
                                  onClick={() => saveEdit(s.id)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-850 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <Check className="w-3 h-3" /> Save
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(s)}
                                  className="p-1 px-2 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-100 rounded-md transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => toggleActive(s)}
                                  className={`p-1 px-2 border rounded-md transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
                                    s.is_active 
                                      ? "bg-rose-50/10 border-rose-200/50 text-rose-600 hover:bg-rose-50 hover:border-rose-300" 
                                      : "bg-teal-50/10 border-teal-200/50 text-teal-650 hover:bg-teal-50 hover:border-teal-300"
                                  }`}
                                >
                                  <Power className="w-3 h-3" />
                                  {s.is_active ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
