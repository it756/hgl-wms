"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";

interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  sbu_name: string | null;
  whatsapp_number: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  BU_MANAGER: "Business Unit Manager",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  UNIT_STAFF: "Unit Staff Personnel",
  FINANCE_MANAGER: "Finance Manager",
  ADMIN: "System Administrator",
};

const ROLE_COLORS: Record<string, string> = {
  BU_MANAGER: "bg-blue-50 border border-blue-200 text-blue-800",
  WAREHOUSE_MANAGER: "bg-teal-50 border border-teal-200 text-teal-800",
  UNIT_STAFF: "bg-slate-50 border border-slate-200 text-slate-700",
  FINANCE_MANAGER: "bg-purple-50 border border-purple-200 text-purple-800",
  ADMIN: "bg-rose-50 border border-rose-200 text-rose-800",
};

const PW_POLICY = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?])(.{8,})$/;

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Personal info form
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSuccess, setInfoSuccess] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const token = () => localStorage.getItem("access_token") ?? "";

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (!res.ok) {
          const d = await res.json();
          setFetchError(d.error || "Failed to load profile");
          return;
        }
        const data: ProfileData = await res.json();
        setProfile(data);
        setFullName(data.full_name ?? "");
        setWhatsapp(data.whatsapp_number ?? "");
      } catch {
        setFetchError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(null);
    setInfoSuccess(false);
    if (!fullName.trim()) {
      setInfoError("Full name is required");
      return;
    }
    setInfoSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          whatsapp_number: whatsapp.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInfoError(data.error || "Failed to save changes");
        return;
      }
      setInfoSuccess(true);
      // Sync localStorage so the navbar greeting reflects the new name
      localStorage.setItem("user_name", fullName.trim());
      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim(), whatsapp_number: whatsapp.trim() || null } : prev);
    } catch {
      setInfoError("Failed to save changes");
    } finally {
      setInfoSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (!currentPw) { setPwError("Current password is required"); return; }
    if (!newPw) { setPwError("New password is required"); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    if (!PW_POLICY.test(newPw)) {
      setPwError("New password must be at least 8 characters with at least one number and one special character");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "Failed to change password");
        return;
      }
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      setPwError("Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (fetchError) {
    return (
      <DashboardLayout>
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {fetchError}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-2xl w-full font-sans">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Account</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#005c55]">My Profile</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">My Profile</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Manage your personal information and account security.
          </p>
        </div>

        {/* Personal Information Card */}
        <section className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <User className="w-4 h-4 text-[#005c55]" />
            <h2 className="font-bold text-sm text-[#1E293B]">Personal Information</h2>
          </div>
          <form onSubmit={handleSaveInfo} className="p-6 flex flex-col gap-5">
            {/* Read-only chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  Email Address
                </span>
                <span className="text-sm text-slate-700 font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg truncate">
                  {profile?.email ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Role
                </span>
                <span
                  className={`text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center ${ROLE_COLORS[profile?.role ?? "UNIT_STAFF"] ?? "bg-slate-50 text-slate-700 border border-slate-200"}`}
                >
                  {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3 h-3" />
                  SBU
                </span>
                <span className="text-sm text-slate-700 font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg truncate">
                  {profile?.sbu_name ?? "—"}
                </span>
              </div>
            </div>

            {/* Editable fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setInfoSuccess(false); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#005c55]/30 focus:border-[#005c55] transition-colors"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="whatsapp">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    WhatsApp Number
                    <span className="text-slate-400 font-normal normal-case">— optional</span>
                  </span>
                </label>
                <input
                  id="whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => { setWhatsapp(e.target.value); setInfoSuccess(false); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#005c55]/30 focus:border-[#005c55] transition-colors"
                  placeholder="+260977000000"
                />
                <p className="text-[11px] text-slate-400">E.164 format required, e.g. +260977000000</p>
              </div>
            </div>

            {/* Feedback */}
            {infoError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {infoError}
              </div>
            )}
            {infoSuccess && (
              <div className="bg-teal-50 border border-teal-200 text-teal-700 rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Profile updated successfully.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={infoSaving}
                className="px-5 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {infoSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password Card */}
        <section className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#005c55]" />
            <h2 className="font-bold text-sm text-[#1E293B]">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="currentPw">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="currentPw"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => { setCurrentPw(e.target.value); setPwSuccess(false); }}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#005c55]/30 focus:border-[#005c55] transition-colors"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="newPw">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPw"
                  type={showNewPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => { setNewPw(e.target.value); setPwSuccess(false); }}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#005c55]/30 focus:border-[#005c55] transition-colors"
                  placeholder="Min 8 chars, one number, one special char"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Must be ≥8 characters with at least one number and one special character</p>
            </div>

            {/* Confirm new password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="confirmPw">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPw"
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => { setConfirmPw(e.target.value); setPwSuccess(false); }}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#005c55]/30 focus:border-[#005c55] transition-colors"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Feedback */}
            {pwError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="bg-teal-50 border border-teal-200 text-teal-700 rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Password changed successfully.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwSaving}
                className="px-5 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                {pwSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
