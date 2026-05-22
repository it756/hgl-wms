"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Building2,
  Users,
  Plus,
  Search,
  Edit3,
  Power,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Activity,
  Loader2,
  UserPlus,
  Lock,
} from "lucide-react";

interface SBUUnit {
  id: string;
  name: string;
  code: string;
  sbu_id: string;
  is_active: boolean;
}

interface StaffRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  unit_id: string | null;
  is_active: boolean;
  sbu_units: { id: string; name: string; code: string } | null;
}

type Tab = "units" | "staff";

export default function BUUnitsPage() {
  const [tab, setTab] = useState<Tab>("units");

  // ── Units state ─────────────────────────────────────────────────────────────
  const [units, setUnits] = useState<SBUUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");

  const [showUnitForm, setShowUnitForm] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [unitFormError, setUnitFormError] = useState<string | null>(null);
  const [unitFormLoading, setUnitFormLoading] = useState(false);

  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [editUnitCode, setEditUnitCode] = useState("");

  // ── Staff state ──────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffUnitId, setNewStaffUnitId] = useState("");
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [staffFormLoading, setStaffFormLoading] = useState(false);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState("");

  const token = () => localStorage.getItem("access_token") ?? "";

  async function loadUnits() {
    setUnitsLoading(true);
    setUnitsError(null);
    try {
      const res = await fetch("/api/bu/units", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUnits(data);
    } catch (e: any) {
      setUnitsError(e.message);
    } finally {
      setUnitsLoading(false);
    }
  }

  async function loadStaff() {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const res = await fetch("/api/bu/staff", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStaff(data);
    } catch (e: any) {
      setStaffError(e.message);
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (tab === "staff" && staff.length === 0 && !staffLoading) {
      loadStaff();
    }
  }, [tab]);

  // ── Unit actions ─────────────────────────────────────────────────────────────
  async function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault();
    setUnitFormLoading(true);
    setUnitFormError(null);
    try {
      const res = await fetch("/api/bu/units", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: newUnitName, code: newUnitCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowUnitForm(false);
      setNewUnitName("");
      setNewUnitCode("");
      await loadUnits();
    } catch (e: any) {
      setUnitFormError(e.message);
    } finally {
      setUnitFormLoading(false);
    }
  }

  async function handleSaveUnitEdit(unitId: string) {
    try {
      const res = await fetch(`/api/bu/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: editUnitName, code: editUnitCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingUnit(null);
      await loadUnits();
    } catch (e: any) {
      setUnitsError(e.message);
    }
  }

  async function handleToggleUnit(unit: SBUUnit) {
    try {
      const res = await fetch(`/api/bu/units/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ is_active: !unit.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadUnits();
    } catch (e: any) {
      setUnitsError(e.message);
    }
  }

  // ── Staff actions ─────────────────────────────────────────────────────────────
  async function handleAssignUnit(userId: string, unitId: string | null) {
    try {
      const res = await fetch("/api/bu/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: userId, unit_id: unitId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadStaff();
    } catch (e: any) {
      setStaffError(e.message);
    }
  }

  async function handleToggleStaff(userId: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/bu/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: userId, is_active: !currentActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadStaff();
    } catch (e: any) {
      setStaffError(e.message);
    }
  }

  async function handleInviteStaff(e: React.FormEvent) {
    e.preventDefault();
    setStaffFormLoading(true);
    setStaffFormError(null);
    try {
      const res = await fetch("/api/bu/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          full_name: newStaffName.trim() || undefined,
          email: newStaffEmail.trim(),
          password: newStaffPassword,
          unit_id: newStaffUnitId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowStaffForm(false);
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffPassword("");
      setNewStaffUnitId("");
      await loadStaff();
    } catch (e: any) {
      setStaffFormError(e.message);
    } finally {
      setStaffFormLoading(false);
    }
  }

  async function handleSaveStaffName(userId: string) {
    try {
      const res = await fetch("/api/bu/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: userId, full_name: editStaffName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingStaffId(null);
      await loadStaff();
    } catch (e: any) {
      setStaffError(e.message);
    }
  }

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.code.toLowerCase().includes(unitSearch.toLowerCase()),
  );

  const filteredStaff = staff.filter(
    (s) =>
      (s.full_name?.toLowerCase() ?? "").includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>My BU</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-[#005c55]">Units &amp; Staff</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">
              Units &amp; Staff
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Manage your business unit's sub-units and assign staff members.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200">
          <button
            onClick={() => setTab("units")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === "units"
                ? "border-[#005c55] text-[#005c55]"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Units
          </button>
          <button
            onClick={() => setTab("staff")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === "staff"
                ? "border-[#005c55] text-[#005c55]"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="w-4 h-4" />
            Staff
          </button>
        </div>

        {/* ── Units Tab ──────────────────────────────────────────────────── */}
        {tab === "units" && (
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search units..."
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <button
                onClick={() => setShowUnitForm(!showUnitForm)}
                className="flex items-center gap-2 px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Unit
              </button>
            </div>

            {/* Create form */}
            {showUnitForm && (
              <form
                onSubmit={handleCreateUnit}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm"
              >
                <h3 className="text-sm font-bold text-[#1E293B]">New Unit</h3>
                {unitFormError && (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {unitFormError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">Unit Name</label>
                    <input
                      required
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="e.g. Sales Floor"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#005c55]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">Code</label>
                    <input
                      required
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SF"
                      maxLength={10}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#005c55] font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={unitFormLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {unitFormLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Create Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnitForm(false);
                      setUnitFormError(null);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Error */}
            {unitsError && (
              <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {unitsError}
              </div>
            )}

            {/* List */}
            {unitsLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading units...
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                {unitSearch
                  ? "No units match your search."
                  : "No units yet. Add your first unit above."}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          {editingUnit === unit.id ? (
                            <input
                              value={editUnitName}
                              onChange={(e) => setEditUnitName(e.target.value)}
                              className="px-2 py-1 text-sm border border-[#005c55] rounded-lg outline-none w-40"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-[#1E293B]">{unit.name}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {editingUnit === unit.id ? (
                            <input
                              value={editUnitCode}
                              onChange={(e) => setEditUnitCode(e.target.value.toUpperCase())}
                              className="px-2 py-1 text-sm border border-[#005c55] rounded-lg outline-none w-24 font-mono"
                              maxLength={10}
                            />
                          ) : (
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                              {unit.code}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                              unit.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            <Activity className="w-3 h-3" />
                            {unit.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {editingUnit === unit.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSaveUnitEdit(unit.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUnit(null)}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUnit(unit.id);
                                  setEditUnitName(unit.name);
                                  setEditUnitCode(unit.code);
                                }}
                                className="p-1.5 text-slate-400 hover:text-[#005c55] hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUnit(unit)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  unit.is_active
                                    ? "text-rose-400 hover:bg-rose-50"
                                    : "text-emerald-500 hover:bg-emerald-50"
                                }`}
                                title={unit.is_active ? "Deactivate" : "Activate"}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Staff Tab ──────────────────────────────────────────────────── */}
        {tab === "staff" && (
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <button
                onClick={() => {
                  setShowStaffForm((v) => !v);
                  setStaffFormError(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff
              </button>
            </div>

            {/* Add Staff Form */}
            {showStaffForm && (
              <form
                onSubmit={handleInviteStaff}
                className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4"
              >
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  New Staff Account
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">Full Name</label>
                    <input
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#005c55]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#005c55]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        placeholder="Min 8 chars, 1 number, 1 special"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#005c55]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">Assign Unit</label>
                    <select
                      value={newStaffUnitId}
                      onChange={(e) => setNewStaffUnitId(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#005c55]"
                    >
                      <option value="">— Unassigned —</option>
                      {units
                        .filter((u) => u.is_active)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                {staffFormError && (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {staffFormError}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={staffFormLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {staffFormLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffForm(false);
                      setStaffFormError(null);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {staffError && (
              <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {staffError}
              </div>
            )}

            {staffLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading staff...
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                {staffSearch ? "No staff match your search." : "No staff found in your SBU."}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                        Email
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((person) => (
                      <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          {editingStaffId === person.id ? (
                            <input
                              value={editStaffName}
                              onChange={(e) => setEditStaffName(e.target.value)}
                              className="px-2 py-1 text-sm border border-[#005c55] rounded-lg outline-none w-40"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-[#1E293B]">
                              {person.full_name ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">
                          {person.email}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {person.role === "BU_MANAGER" ? "BU Manager" : "Unit Staff"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {person.role === "BU_MANAGER" ? (
                            <span className="text-xs text-slate-400 italic">—</span>
                          ) : (
                            <select
                              value={person.unit_id ?? ""}
                              onChange={(e) => handleAssignUnit(person.id, e.target.value || null)}
                              className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#005c55] max-w-[160px]"
                            >
                              <option value="">— Unassigned —</option>
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.code})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                              person.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            <Activity className="w-3 h-3" />
                            {person.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {editingStaffId === person.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSaveStaffName(person.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingStaffId(null)}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {person.role !== "BU_MANAGER" && (
                                <button
                                  onClick={() => {
                                    setEditingStaffId(person.id);
                                    setEditStaffName(person.full_name ?? "");
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-[#005c55] hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit name"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {person.role !== "BU_MANAGER" && (
                                <button
                                  onClick={() => handleToggleStaff(person.id, person.is_active)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    person.is_active
                                      ? "text-rose-400 hover:bg-rose-50"
                                      : "text-emerald-500 hover:bg-emerald-50"
                                  }`}
                                  title={person.is_active ? "Deactivate" : "Activate"}
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
