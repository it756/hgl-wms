"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import IconButton from "@/components/IconButton";
import HScrollArea from "@/components/HScrollArea";
import { TableHead, Th, Tr, Td } from "@/components/Table";
import type { UserRole } from "@/lib/models/user";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileClock,
  Filter,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";

interface LicenseProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  sbu_id: string | null;
  licensed: boolean;
  license_type: string | null;
  license_issued_at: string | null;
  license_expires_at: string | null;
}

interface LicenseAuditEntry {
  id: string;
  action: "ASSIGNED" | "UPDATED" | "REVOKED";
  license_type: string | null;
  issued_at: string | null;
  expires_at: string | null;
  performed_by: string;
  notes: string | null;
  created_at: string;
}

interface SBU {
  id: string;
  name: string;
  code: string;
}

type LicenseFilter = "all" | "licensed" | "unlicensed" | "expired" | "expiring";
type ModalMode = "assign" | "update" | "revoke";

const LICENSE_TYPES = ["PHARMACEUTICAL", "CONTROLLED_SUBSTANCES", "WAREHOUSE_OPERATIONS", "FINANCE_APPROVAL"];

function getToken(): string {
  return typeof window === "undefined" ? "" : (localStorage.getItem("access_token") ?? "");
}

function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function isExpired(profile: LicenseProfile): boolean {
  return Boolean(profile.license_expires_at && new Date(profile.license_expires_at) < new Date());
}

function isExpiringSoon(profile: LicenseProfile): boolean {
  if (!profile.license_expires_at || isExpired(profile)) return false;
  const days = (new Date(profile.license_expires_at).getTime() - Date.now()) / 86_400_000;
  return days <= 30;
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Request failed";
}

export default function LicenseManagementPage() {
  const [staff, setStaff] = useState<LicenseProfile[]>([]);
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LicenseFilter>("all");
  const [selected, setSelected] = useState<LicenseProfile | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("assign");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPES[0]);
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [auditTarget, setAuditTarget] = useState<LicenseProfile | null>(null);
  const [audit, setAudit] = useState<LicenseAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [staffResponse, sbusResponse] = await Promise.all([
        fetch("/api/admin/licenses", { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      if (!staffResponse.ok) throw new Error(await readError(staffResponse));
      if (!sbusResponse.ok) throw new Error(await readError(sbusResponse));

      const staffData = (await staffResponse.json()) as LicenseProfile[];
      const sbuData = (await sbusResponse.json()) as SBU[];
      setStaff(staffData);
      setSbus(sbuData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load licence records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const [staffResponse, sbusResponse] = await Promise.all([
          fetch("/api/admin/licenses", { headers: { Authorization: `Bearer ${getToken()}` } }),
          fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${getToken()}` } }),
        ]);
        if (!staffResponse.ok) throw new Error(await readError(staffResponse));
        if (!sbusResponse.ok) throw new Error(await readError(sbusResponse));
        const staffData = (await staffResponse.json()) as LicenseProfile[];
        const sbuData = (await sbusResponse.json()) as SBU[];
        if (!active) return;
        setStaff(staffData);
        setSbus(sbuData);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not load licence records");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      active = false;
    };
  }, []);

  function openModal(profile: LicenseProfile, mode: ModalMode) {
    setSelected(profile);
    setModalMode(mode);
    setLicenseType(profile.license_type ?? LICENSE_TYPES[0]);
    setIssuedAt(dateInputValue(profile.license_issued_at));
    setExpiresAt(dateInputValue(profile.license_expires_at));
    setNotes("");
    setError(null);
    setSuccess(null);
  }

  async function openAudit(profile: LicenseProfile) {
    setAuditTarget(profile);
    setAudit([]);
    setAuditLoading(true);
    try {
      const response = await fetch(`/api/admin/licenses/${profile.id}/audit`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error(await readError(response));
      setAudit((await response.json()) as LicenseAuditEntry[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load licence audit history");
    } finally {
      setAuditLoading(false);
    }
  }

  async function submitLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const url = modalMode === "assign" ? "/api/admin/licenses" : `/api/admin/licenses/${selected.id}`;
      const method = modalMode === "assign" ? "POST" : modalMode === "update" ? "PUT" : "DELETE";
      const body =
        modalMode === "revoke"
          ? { notes }
          : {
              profile_id: selected.id,
              license_type: licenseType,
              license_issued_at: issuedAt || undefined,
              license_expires_at: expiresAt || undefined,
              notes,
            };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readError(response));

      setSelected(null);
      setSuccess(
        modalMode === "revoke" ? "Licence revoked." : `Licence ${modalMode === "assign" ? "assigned" : "updated"}.`,
      );
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save licence change");
    } finally {
      setSaving(false);
    }
  }

  const filtered = staff.filter((profile) => {
    const query = search.toLowerCase();
    const matchesSearch =
      (profile.full_name ?? "").toLowerCase().includes(query) ||
      profile.role.toLowerCase().includes(query) ||
      (profile.license_type ?? "").toLowerCase().includes(query) ||
      (sbus.find((sbu) => sbu.id === profile.sbu_id)?.name ?? "").toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (filter === "licensed") return profile.licensed && !isExpired(profile);
    if (filter === "unlicensed") return !profile.licensed;
    if (filter === "expired") return isExpired(profile);
    if (filter === "expiring") return isExpiringSoon(profile);
    return true;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full font-sans text-slate-850">
        <PageHeader
          title="Staff Licences"
          description="Assign, renew, revoke, and audit operational access licences."
          actions={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">Total: {staff.length}</span>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2">
                Active: {staff.filter((profile) => profile.licensed && !isExpired(profile)).length}
              </span>
              <span className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
                Unlicensed: {staff.filter((profile) => !profile.licensed).length}
              </span>
              <span className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2">
                Expired: {staff.filter(isExpired).length}
              </span>
            </div>
          }
        />

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff, role, SBU, or licence type"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:border-[#005c55] focus:outline-none focus:ring-1 focus:ring-[#005c55]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              {(["all", "licensed", "unlicensed", "expired", "expiring"] as LicenseFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase ${
                    filter === option
                      ? "border-[#005c55] bg-[#005c55] text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs font-bold uppercase text-slate-400">Loading licence register...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold uppercase text-slate-400">No matching licence records.</div>
          ) : (
            <HScrollArea>
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <TableHead>
                    <Th pinned>Staff</Th>
                    <Th>Role</Th>
                    <Th>SBU</Th>
                    <Th>Status</Th>
                    <Th>Issued</Th>
                    <Th>Expires</Th>
                    <Th align="right">Actions</Th>
                </TableHead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((profile) => {
                    const sbu = sbus.find((item) => item.id === profile.sbu_id);
                    const expired = isExpired(profile);
                    return (
                      <Tr key={profile.id}>
                        <Td pinned className="max-w-50">
                          <div className="font-extrabold text-slate-800 truncate" title={profile.full_name ?? "Unnamed Staff"}>
                            {profile.full_name ?? "Unnamed Staff"}
                          </div>
                          <div className="font-mono text-[10px] uppercase text-slate-400">{profile.id.slice(0, 8)}</div>
                        </Td>
                        <td className="px-6 py-3.5 font-bold text-slate-600">{profile.role.replace("_", " ")}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-500">{sbu ? `${sbu.name} (${sbu.code})` : "Independent"}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                              !profile.licensed
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : expired
                                  ? "border-rose-200 bg-rose-50 text-rose-800"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {profile.licensed && !expired ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                            {!profile.licensed ? "Unlicensed" : expired ? "Expired" : profile.license_type ?? "Licensed"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-500">{formatDate(profile.license_issued_at)}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-500">{formatDate(profile.license_expires_at)}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end gap-1.5">
                            <IconButton
                              icon={<Pencil className="h-3.5 w-3.5" />}
                              label={profile.licensed ? "Update licence" : "Assign licence"}
                              onClick={() => openModal(profile, profile.licensed ? "update" : "assign")}
                            />
                            {profile.licensed && (
                              <IconButton
                                icon={<RotateCcw className="h-3.5 w-3.5" />}
                                label="Revoke licence"
                                variant="danger"
                                onClick={() => openModal(profile, "revoke")}
                              />
                            )}
                            <IconButton
                              icon={<FileClock className="h-3.5 w-3.5" />}
                              label="View audit history"
                              onClick={() => void openAudit(profile)}
                            />
                          </div>
                        </td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </HScrollArea>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={submitLicense} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 capitalize">{modalMode} Licence</h2>
                <p className="text-xs font-semibold text-slate-500">{selected.full_name ?? selected.id}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-4">
              {modalMode !== "revoke" && (
                <>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Licence Type
                    <select
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800 focus:border-[#005c55] focus:outline-none focus:ring-1 focus:ring-[#005c55]"
                    >
                      {LICENSE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Issued At
                      <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Expires At
                      <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800" />
                    </label>
                  </div>
                </>
              )}
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder={modalMode === "revoke" ? "Reason for revocation" : "Optional licence note"}
                  className="resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800 focus:border-[#005c55] focus:outline-none focus:ring-1 focus:ring-[#005c55]"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button disabled={saving} type="submit" className="rounded-lg bg-[#005c55] px-4 py-2 text-xs font-bold text-white hover:bg-[#004740] disabled:opacity-60">
                {saving ? "Saving..." : modalMode === "revoke" ? "Revoke Licence" : "Save Licence"}
              </button>
            </div>
          </form>
        </div>
      )}

      {auditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Licence Audit Trail</h2>
                <p className="text-xs font-semibold text-slate-500">{auditTarget.full_name ?? auditTarget.id}</p>
              </div>
              <button type="button" onClick={() => setAuditTarget(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {auditLoading ? (
                <div className="py-10 text-center text-xs font-bold uppercase text-slate-400">Loading audit trail...</div>
              ) : audit.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold uppercase text-slate-400">No licence audit records.</div>
              ) : (
                <div className="grid gap-3">
                  {audit.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold uppercase text-slate-800">{entry.action}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <CalendarClock className="h-3.5 w-3.5" /> {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-600">
                        {entry.license_type ?? "No licence type"} | issued {formatDate(entry.issued_at)} | expires {formatDate(entry.expires_at)}
                      </div>
                      {entry.notes && <div className="mt-2 text-xs text-slate-500">{entry.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}