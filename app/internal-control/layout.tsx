"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function InternalControlLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role !== "INTERNAL_CONTROL_OFFICER") {
      router.replace("/");
    }
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.clear();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-slate-800 text-sm tracking-tight">
            Internal Control Portal
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
