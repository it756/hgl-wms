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
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  sbu_id: string | null;
  is_active: boolean;
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

  // New-user form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("UNIT_STAFF");
  const [formSbu, setFormSbu] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvRows, setCsvRows] = useState<{
    full_name: string;
    email: string;
    password: string;
    role: string;
    sbu_code: string;
    _error?: string;
  }[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  const [csvResults, setCsvResults] = useState<
    { email: string; success: boolean; id?: string; error?: string }[]
  >([]);

  const token = () => localStorage.getItem("access_token") ?? "";

  function downloadCsvTemplate() {
    const a = document.createElement("a");
    a.href = "/bulk_users_template.csv";
    a.download = "bulk_users_template.csv";
    a.click();
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvParseError(null);
    setCsvResults([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) {
        setCsvParseError("CSV must have a header row and at least one data row.");
        setCsvRows([]);
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const required = ["email", "password", "role"];
      const missing = required.filter((r) => !headers.includes(r));
      if (missing.length > 0) {
        setCsvParseError(`CSV is missing required columns: ${missing.join(", ")}`);
        setCsvRows([]);
        return;
      }
      const idx = (col: string) => headers.indexOf(col);
      const parsed = lines.slice(1).map((line) => {
        // Handle quoted fields
        const cols = line.match(/(?:"[^"]*"|[^,])+/g)?.map((c) =>
          c.replace(/^"|"$/g, "").trim()
        ) ?? [];
        const role = (cols[idx("role")] ?? "").toUpperCase();
        const validRoles = ["BU_MANAGER", "WAREHOUSE_MANAGER", "UNIT_STAFF", "FINANCE_MANAGER", "ADMIN"];
        let _error: string | undefined;
        if (!cols[idx("email")]) _error = "Missing email";
        else if (!cols[idx("password")]) _error = "Missing password";
        else if (!validRoles.includes(role)) _error = `Invalid role: ${cols[idx("role")]}`;
        return {
          full_name: cols[idx("full_name")] ?? "",
          email: cols[idx("email")] ?? "",
          password: cols[idx("password")] ?? "",
          role,
          sbu_code: cols[idx("sbu_code")] ?? "",
          _error,
        };
      });
      setCsvRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleCsvImport() {
    setCsvImportLoading(true);
    setCsvResults([]);
    try {
      const users = csvRows.filter((r) => !r._error).map(({ full_name, email, password, role, sbu_code }) => ({
        full_name: full_name || undefined,
        email,
        password,
        role,
        sbu_code: sbu_code || undefined,
      }));
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      if (!res.ok && !data.results) throw new Error(data.error);
      setCsvResults(data.results ?? []);
      load();
    } catch (e: any) {
      setCsvParseError(e.message);
    } finally {
      setCsvImportLoading(false);
    }
  }

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

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          email: formEmail,
          password: formPassword,
          full_name: formName,
          role: formRole,
          sbu_id: formSbu || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setFormEmail("");
      setFormPassword("");
      setFormName("");
      setFormRole("UNIT_STAFF");
      setFormSbu("");
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  }

  const filtered = users.filter(u => 
    (u.full_name?.toLowerCase() || "").includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
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
              <span className="text-[#005c55]">User Management</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">Corporate Users</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Provision accounts, adjust operational permissions, and associate users with SBUs.</p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => { setShowCsvImport(!showCsvImport); setShowForm(false); }}
              className="px-4 py-2.5 border border-[#005c55] text-[#005c55] hover:bg-[#005c55]/5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-sans"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setShowCsvImport(false); }}
              className="px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm font-sans"
            >
              <UserPlus className="w-4 h-4" />
              Invite New Staff
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
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total Staff</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-[#1E293B] font-mono">{String(users.length).padStart(2, '0')}</span>
              <span className="text-[10px] text-teal-605 bg-teal-50 border border-teal-100 rounded-full px-1.5 py-0.5 font-bold">ACTIVE BASE</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Users</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-[#0D9488] font-mono">{String(users.filter(u => u.is_active).length).padStart(2, '0')}</span>
              <span className="text-[10px] text-slate-400 font-bold">ONLINE ELIGIBLE</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Deactivated Users</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-rose-600 font-mono">{String(users.filter(u => !u.is_active).length).padStart(2, '0')}</span>
              <span className="text-[10px] text-rose-650 bg-rose-50 border border-rose-100 rounded-full px-1.5 py-0.5 font-bold">RESTRICTED</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Departments/SBUs</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-blue-600 font-mono">{String(sbus.length).padStart(2, '0')}</span>
              <span className="text-[10px] text-blue-600 font-bold">ORGANISATION</span>
            </div>
          </div>
        </section>

        {/* CSV Bulk Import Panel */}
        {showCsvImport && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                <h2 className="font-extrabold text-[#1E293B] text-sm">Bulk Import Staff via CSV</h2>
              </div>
              <button
                onClick={downloadCsvTemplate}
                className="flex items-center gap-1 text-[11px] text-[#005c55] font-bold hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-medium -mt-2">
              Upload a CSV with columns: <span className="font-mono text-slate-600">full_name, email, password, role, sbu_code</span>.
              &nbsp;Roles: BU_MANAGER, WAREHOUSE_MANAGER, UNIT_STAFF, FINANCE_MANAGER, ADMIN.
            </p>

            {csvParseError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3.5 py-2 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {csvParseError}
              </div>
            )}

            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-[#005c55] rounded-xl py-8 cursor-pointer transition-colors bg-slate-50/40">
              <Upload className="w-7 h-7 text-slate-300" />
              <span className="text-xs font-bold text-slate-400">Click to upload CSV file</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
            </label>

            {/* Preview table */}
            {csvRows.length > 0 && csvResults.length === 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Preview — {csvRows.length} row{csvRows.length !== 1 ? "s" : ""}
                    {csvRows.some((r) => r._error) && (
                      <span className="ml-2 text-rose-600">
                        ({csvRows.filter((r) => r._error).length} invalid, will be skipped)
                      </span>
                    )}
                  </span>
                  <button
                    disabled={csvImportLoading || csvRows.filter((r) => !r._error).length === 0}
                    onClick={handleCsvImport}
                    className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-55 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {csvImportLoading ? (
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Import {csvRows.filter((r) => !r._error).length} Users
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-[11px] font-medium">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">#</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Email</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Role</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">SBU Code</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {csvRows.map((row, i) => (
                        <tr key={i} className={row._error ? "bg-rose-50/40" : "hover:bg-slate-50/40"}>
                          <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-700 font-semibold">{row.full_name || <span className="italic text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{row.email}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{row.role}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono">{row.sbu_code || "—"}</td>
                          <td className="px-3 py-2">
                            {row._error ? (
                              <span className="text-rose-600 font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {row._error}
                              </span>
                            ) : (
                              <span className="text-teal-600 font-bold text-[10px]">Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import results */}
            {csvResults.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Results — {csvResults.filter((r) => r.success).length} created,&nbsp;
                  {csvResults.filter((r) => !r.success).length} failed
                </span>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-[11px] font-medium">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Email</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-bold uppercase text-[9px] tracking-wider">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {csvResults.map((r, i) => (
                        <tr key={i} className={r.success ? "hover:bg-slate-50/40" : "bg-rose-50/40"}>
                          <td className="px-3 py-2 text-slate-600 font-mono">{r.email}</td>
                          <td className="px-3 py-2">
                            {r.success ? (
                              <span className="text-teal-600 font-bold text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Created
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {r.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => { setShowCsvImport(false); setCsvRows([]); setCsvResults([]); setCsvParseError(null); }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create user wizard inside an advanced form panel */}
        {showForm && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-5 h-5 text-teal-650 shrink-0" />
              <h2 className="font-extrabold text-[#1E293B] text-sm">Provision New Account Node</h2>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mb-4">Provide credential defaults and business unit mapping configuration for the team member.</p>
            {formError && <div className="mb-4 bg-rose-50 text-rose-750 border border-rose-100 px-3.5 py-2 rounded-lg text-xs font-bold font-mono uppercase">{formError}</div>}
            
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    placeholder="e.g. Jane Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="e.g. staff@harvest.co.ke"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Temporary Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="password"
                    placeholder="Set temporary login password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Access Scope Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
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

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Strategic Business Unit Association</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formSbu}
                    onChange={(e) => setFormSbu(e.target.value)}
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
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-55 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {formLoading ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></span>
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Create Node
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
              <span>ACTIVE USER NODES: {users.filter(u => u.is_active).length}</span>
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
            <div className="overflow-x-auto text-[#1E293B]">
              <table className="min-w-full divide-y divide-slate-100 text-xs font-medium">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[30%]">Team Member Info</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[20%]">Email Address</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[20%]">Operational Role Role</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">SBU Node</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">State</th>
                    <th className="px-6 py-4 text-right font-bold text-slate-400 uppercase tracking-widest text-[9px] w-[10%]">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-[#005c55] font-mono shrink-0">
                            {(u.full_name ?? u.email).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 text-sm block">{u.full_name ?? "Unprovisioned Name"}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">ID: {u.id.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 font-semibold font-mono">{u.email}</td>
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
                          <span className="text-slate-400 italic text-[11px] font-semibold">Independent</span>
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
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-teal-600" : "bg-rose-500"}`}></span>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {u.is_active ? (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="px-2 py-1 border border-rose-100 hover:bg-rose-50 text-rose-600 font-bold rounded-lg cursor-pointer transition-all flex items-center justify-end gap-1 text-[11px] ml-auto"
                          >
                            <Power className="w-3 h-3" /> Deactivate
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Suspended</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
