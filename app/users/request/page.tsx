"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { User, Mail, Shield, Building2, CheckCircle2, ShieldAlert, Send } from "lucide-react";
import type { UserRole } from "@/lib/models/user";

interface SBU {
  id: string;
  name: string;
  code: string;
}

interface SbuUnit {
  id: string;
  name: string;
  code: string;
  sbu_id: string;
}

const REQUESTABLE_ROLES: UserRole[] = [
  "BU_MANAGER",
  "WAREHOUSE_MANAGER",
  "UNIT_STAFF",
  "FINANCE_MANAGER",
];

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  BU_MANAGER: "Business Unit Manager",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  UNIT_STAFF: "Unit Staff Personnel",
  FINANCE_MANAGER: "Finance Manager",
  ADMIN: "System Administrator",
  INTERNAL_CONTROL_OFFICER: "Internal Control Officer",
};

export default function RequestUserPage() {
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [units, setUnits] = useState<SbuUnit[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("UNIT_STAFF");
  const [sbu, setSbu] = useState("");
  const [unit, setUnit] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } }),
      fetch("/api/admin/sbu-units", { headers: { Authorization: `Bearer ${token()}` } }),
    ]).then(async ([sRes, uRes]) => {
      const [sData, uData] = await Promise.all([sRes.json(), uRes.json()]);
      if (sRes.ok) setSbus(sData);
      if (uRes.ok) setUnits(uData);
    });
  }, []);

  function handleRoleChange(r: UserRole) {
    setRole(r);
    if (r !== "UNIT_STAFF") setUnit("");
  }

  function handleSbuChange(sbuId: string) {
    setSbu(sbuId);
    setUnit("");
  }

  const filteredUnits = units.filter((u) => u.sbu_id === sbu);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const sbuLabel = sbu
        ? (() => {
            const s = sbus.find((sb) => sb.id === sbu);
            return s ? `${s.name} (${s.code})` : "";
          })()
        : "";
      const unitLabel = unit
        ? (() => {
            const u = units.find((un) => un.id === unit);
            return u ? `${u.name} (${u.code})` : "";
          })()
        : "";

      const res = await fetch("/api/admin/users/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          full_name: name,
          email,
          role,
          sbu_id: sbu || undefined,
          unit_id: role === "UNIT_STAFF" ? unit || undefined : undefined,
          sbu_label: sbuLabel || undefined,
          unit_label: unitLabel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      setSuccess("Request sent. The operations team will create and license this account.");
      setName("");
      setEmail("");
      setRole("UNIT_STAFF");
      setSbu("");
      setUnit("");
      setWhatsapp("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      <PageHeader
        title="Request New User"
        description="Submit the proposed user's details. The operations team will create and license the account."
      />

      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm max-w-2xl">
        {error && (
          <div className="mb-4 bg-rose-50 text-rose-700 border border-rose-100 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-teal-50 text-teal-800 border border-teal-100 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                required
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              Proposed Role
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
              >
                {REQUESTABLE_ROLES.map((r) => (
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
                value={sbu}
                onChange={(e) => handleSbuChange(e.target.value)}
                required={role === "UNIT_STAFF"}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
              >
                <option value="">— Independent / Cross-cutting —</option>
                {sbus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {role === "UNIT_STAFF" && (
            <div className="flex flex-col gap-1">
              <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                Unit Assignment
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                  disabled={!sbu}
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-bold text-slate-800 cursor-pointer appearance-none"
                >
                  <option value="">— Select unit —</option>
                  {filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              WhatsApp Number{" "}
              <span className="text-slate-300 font-normal normal-case tracking-normal">
                optional
              </span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                placeholder="+260977000000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] disabled:opacity-55 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></span>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
