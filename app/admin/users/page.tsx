"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import type { UserRole } from "../../../lib/models/user";
import {
  Users,
  UserPlus,
  Search,
  SlidersHorizontal,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Shield,
  Power,
  Check,
  X,
  ShieldAlert,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Pencil,
  KeyRound,
  Send,
} from "lucide-react";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  sbu_id: string | null;
  is_active: boolean;
  whatsapp_number: string | null;
}

interface SBU {
  id: string;
  name: string;
  code: string;
}

const ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
  "ADMIN",
];

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  BU_MANAGER: "Business Unit Manager",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  UNIT_STAFF: "Unit Staff Personnel",
  FINANCE_MANAGER: "Finance Manager",
  ADMIN: "System Administrator",
};

const ROLE_COLORS: Record<UserRole, string> = {
  BU_MANAGER: "bg-blue-50 border border-blue-200 text-blue-800",
  WAREHOUSE_MANAGER: "bg-teal-50 border border-teal-200 text-teal-800",
  UNIT_STAFF: "bg-slate-50 border border-slate-200 text-slate-700",
  FINANCE_MANAGER: "bg-purple-50 border border-purple-200 text-purple-800",
  ADMIN: "bg-rose-50 border border-rose-200 text-rose-800",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Request-new-user form (sends an email request instead of creating an account directly)
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestRole, setRequestRole] = useState<UserRole>("UNIT_STAFF");
  const [requestSbu, setRequestSbu] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  // Edit user state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("UNIT_STAFF");
  const [editSbu, setEditSbu] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [uRes, sRes] = await Promise.all([
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      const [uData, sData] = await Promise.all([uRes.json(), sRes.json()]);
      if (!uRes.ok) throw new Error(uData.error);
      setUsers(uData);
      setSbus(sData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(userId: string, role: UserRole) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update role");
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDeactivate(userId: string) {
    try {
      const res = await fetch("/api/auth/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to deactivate user");
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openEditModal(u: UserRow) {
    setEditUser(u);
    setEditName(u.full_name ?? "");
    setEditEmail(u.email);
    setEditWhatsapp(u.whatsapp_number ?? "");
    setEditRole(u.role);
    setEditSbu(u.sbu_id ?? "");
    setEditActive(u.is_active);
    setEditPassword("");
    setShowEditPassword(false);
    setEditError(null);
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        full_name: editName,
        email: editEmail,
        whatsapp_number: editWhatsapp || null,
        role: editRole,
        sbu_id: editSbu || null,
        is_active: editActive,
      };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setEditUser(null);
      load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleRequestUser(e: React.FormEvent) {
    e.preventDefault();
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const sbuLabel = requestSbu
        ? (() => {
            const s = sbus.find((sb) => sb.id === requestSbu);
            return s ? `${s.name} (${s.code})` : "";
          })()
        : "";
      const res = await fetch("/api/admin/users/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          full_name: requestName,
          email: requestEmail,
          role: requestRole,
          sbu_id: requestSbu || undefined,
          sbu_label: sbuLabel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequestSuccess("Request sent. The operations team will create and license this account.");
      setRequestName("");
      setRequestEmail("");
      setRequestRole("UNIT_STAFF");
      setRequestSbu("");
    } catch (e: any) {
      setRequestError(e.message);
    } finally {
      setRequestLoading(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      (u.full_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const startIndex = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(filtered.length, page * pageSize);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full font-sans">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Admin</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#005c55]">User Management</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">Corporate Users</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Provision accounts, adjust operational permissions, and associate users with SBUs.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                setShowRequestForm(!showRequestForm);
                setRequestError(null);
                setRequestSuccess(null);
              }}
              className="px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm font-sans"
            >
              <UserPlus className="w-4 h-4" />
              Request New User
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-250 text-rose-700 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPI Segment */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Total Staff
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-[#1E293B] font-mono">
                {String(users.length).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-teal-605 bg-teal-50 border border-teal-100 rounded-full px-1.5 py-0.5 font-bold">
                ACTIVE BASE
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Active Users
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-[#0D9488] font-mono">
                {String(users.filter((u) => u.is_active).length).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">ONLINE ELIGIBLE</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Deactivated Users
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-rose-600 font-mono">
                {String(users.filter((u) => !u.is_active).length).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-rose-650 bg-rose-50 border border-rose-100 rounded-full px-1.5 py-0.5 font-bold">
                RESTRICTED
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Departments/SBUs
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-blue-600 font-mono">
                {String(sbus.length).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-blue-600 font-bold">ORGANISATION</span>
            </div>
          </div>
        </section>

        {/* Request New User panel — sends an email request instead of creating an account directly */}
        {showRequestForm && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-5 h-5 text-teal-650 shrink-0" />
              <h2 className="font-extrabold text-[#1E293B] text-sm">Request New User Account</h2>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mb-4">
              Submit the proposed user&apos;s details. This sends a request to the operations team
              to create and license the account — it does not create the account directly.
            </p>
            {requestError && (
              <div className="mb-4 bg-rose-50 text-rose-750 border border-rose-100 px-3.5 py-2 rounded-lg text-xs font-bold font-mono uppercase">
                {requestError}
              </div>
            )}
            {requestSuccess && (
              <div className="mb-4 bg-teal-50 text-teal-800 border border-teal-100 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {requestSuccess}
              </div>
            )}

            <form
              onSubmit={handleRequestUser}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    placeholder="e.g. Jane Doe"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="e.g. staff@harvest.co.ke"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Proposed Access Scope Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={requestRole}
                    onChange={(e) => setRequestRole(e.target.value as UserRole)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DISPLAY_NAMES[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Strategic Business Unit Association
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={requestSbu}
                    onChange={(e) => setRequestSbu(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-850 cursor-pointer appearance-none"
                  >
                    <option value="">— Independent / Cross-cutting Node —</option>
                    {sbus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2 flex gap-2 justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-55 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {requestLoading ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></span>
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Request
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Master User Grid / Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Action header bar */}
          <div className="p-4 border-b border-slate-100/50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff full name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold font-mono">
              <Activity className="w-3.5 h-3.5 text-[#005c55]" />
              <span>ACTIVE USER NODES: {users.filter((u) => u.is_active).length}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
              <p className="text-xs font-bold font-mono">PROVISIONING DIGITAL DIRECTORY...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-semibold text-xs font-mono uppercase">
              No matching team members found in registry.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="text-[12px] text-slate-500">
                  Showing {startIndex} - {endIndex} of {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                  >
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                  </select>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 text-xs border border-slate-200 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="text-[12px] text-slate-600 font-bold">
                    Page {page} of {totalPages}
                  </div>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 text-xs border border-slate-200 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto text-[#1E293B]">
                <table className="min-w-full divide-y divide-slate-100 text-xs font-medium">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[30%]">
                        Team Member Info
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[20%]">
                        Email Address
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[20%]">
                        Operational Role Role
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">
                        SBU Node
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">
                        State
                      </th>
                      <th className="px-6 py-4 text-right font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">
                        Operations
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-[#005c55] font-mono shrink-0">
                              {(u.full_name ?? u.email).substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-800 text-sm block">
                                {u.full_name ?? "Unprovisioned Name"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                ID: {u.id.substring(0, 8)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 font-semibold font-mono">
                          {u.email}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="relative inline-block">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer uppercase appearance-none focus:outline-none focus:ring-1 focus:ring-[#005c55] ${ROLE_COLORS[u.role]}`}
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          {sbus.find((s) => s.id === u.sbu_id) ? (
                            <span className="font-mono bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                              {sbus.find((s) => s.id === u.sbu_id)?.code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-semibold">
                              Independent
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              u.is_active
                                ? "bg-teal-50 border border-teal-200 text-teal-800"
                                : "bg-rose-50 border border-rose-200 text-rose-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-teal-600" : "bg-rose-500"}`}
                            ></span>
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(u)}
                              className="px-2 py-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 text-[11px]"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            {u.is_active ? (
                              <button
                                onClick={() => handleDeactivate(u.id)}
                                className="px-2 py-1 border border-rose-100 hover:bg-rose-50 text-rose-600 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 text-[11px]"
                              >
                                <Power className="w-3 h-3" /> Deactivate
                              </button>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                                Suspended
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Staff Modal ── */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditUser(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200/80 flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#005c55]" />
                <h2 className="font-extrabold text-[#1E293B] text-sm">Edit Staff Account</h2>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 flex flex-col gap-4">
              {editError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3.5 py-2 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {editError}
                </div>
              )}

              {/* Name + WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      required
                      placeholder="Full name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    WhatsApp Number
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="+260977000000"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="staff@harvest.co.ke"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Role + SBU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    Access Role
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_DISPLAY_NAMES[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    SBU Association
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={editSbu}
                      onChange={(e) => setEditSbu(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
                    >
                      <option value="">— Independent —</option>
                      {sbus.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Active status toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Account Status
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditActive(true)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                      editActive
                        ? "bg-teal-50 border-teal-300 text-teal-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditActive(false)}
                    disabled={editUser?.id === undefined}
                    className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                      !editActive
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Deactivated
                  </button>
                </div>
              </div>

              {/* Password reset section */}
              <div className="flex flex-col gap-1 border-t border-slate-100 pt-4">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  Reset Password{" "}
                  <span className="text-slate-300 font-normal normal-case tracking-normal">
                    (leave blank to keep unchanged)
                  </span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="New password (min 8 chars, 1 number, 1 special)"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 font-medium text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((s) => !s)}
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-55 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {editLoading ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
