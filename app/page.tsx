"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Warehouse, Mail, Lock, Eye, EyeOff, Key } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Well-known credentials convenience helpers for testing/demo
  const demoUsers = [
    {
      email: "david.okuku@harvestgl.net",
      role: "WAREHOUSE_MANAGER",
      name: "David Okuku",
      sbu: "Central Warehousing Ops",
    },
    {
      email: "admin@harvestgl.net",
      role: "ADMIN",
      name: "Admin Lead",
      sbu: "System Administration",
    },
    {
      email: "bu.manager@harvestgl.net",
      role: "BU_MANAGER",
      name: "Alexander Wright",
      sbu: "Finance & Admin SBU",
    },
    {
      email: "finance@harvestgl.net",
      role: "FINANCE_MANAGER",
      name: "Sarah Miller",
      sbu: "Finance Global Hub",
    },
    {
      email: "staff@harvestgl.net",
      role: "UNIT_STAFF",
      name: "Lisa Chen",
      sbu: "Logistics Ops Center",
    },
  ];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Fallback for demo purposes if the specific supabase setup is not ready
        const demo = demoUsers.find((u) => u.email === email);
        if (demo && password === "password123") {
          localStorage.setItem("access_token", "demo-token-123456");
          localStorage.setItem("user_role", demo.role);
          localStorage.setItem("user_name", demo.name);
          localStorage.setItem("user_sbu", demo.sbu);

          if (demo.role === "ADMIN") {
            router.push("/admin");
          } else if (demo.role === "BU_MANAGER" || demo.role === "UNIT_STAFF") {
            router.push("/requests");
          } else if (demo.role === "WAREHOUSE_MANAGER") {
            router.push("/warehouse/queue");
          } else if (demo.role === "FINANCE_MANAGER") {
            router.push("/finance/queue");
          }
          return;
        }
        throw new Error(authError.message);
      }

      const session = data.session;
      if (!session) throw new Error("No session active after sign in");

      // Set items
      const user = data.user;
      const role = (user.user_metadata as any)?.role || "UNIT_STAFF";
      const name = user.user_metadata?.full_name || "User Account";
      const sbuName = user.user_metadata?.sbu_name || "Assigned SBU";

      const sbuId = (user.user_metadata as any)?.sbu_id || "";
      localStorage.setItem("access_token", session.access_token);
      localStorage.setItem("user_role", role);
      localStorage.setItem("user_name", name);
      localStorage.setItem("user_sbu", sbuName);
      localStorage.setItem("user_sbu_id", sbuId);

      // Routing
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "BU_MANAGER" || role === "UNIT_STAFF") {
        router.push("/requests");
      } else if (role === "WAREHOUSE_MANAGER") {
        router.push("/warehouse/queue");
      } else if (role === "FINANCE_MANAGER") {
        router.push("/finance/queue");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function applyDemoUser(u: (typeof demoUsers)[0]) {
    setEmail(u.email);
    setPassword("password123");
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-surface text-on-surface">
      <main className="flex-grow flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Subtle Atmospheric Background Detail */}
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-400 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full bg-amber-400 blur-[80px]"></div>
        </div>

        {/* Login Container */}
        <div className="w-full max-w-[440px] z-10">
          {/* Brand Identity Section */}
          <div className="flex flex-col items-center mb-8 text-center animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Warehouse className="text-primary w-10 h-10" />
              <span className="text-2xl font-extrabold tracking-tight text-on-background uppercase">
                Harvest WMS
              </span>
            </div>
            <h1 className="text-lg font-semibold text-slate-500">Sign in to your account</h1>
          </div>

          {/* Login Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Email Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                  htmlFor="email"
                >
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="text-outline w-5 h-5" />
                  </div>
                  <input
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline-variant"
                    id="email"
                    required
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label
                    className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    className="text-xs font-bold text-primary hover:underline"
                    href="/forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="text-outline w-5 h-5" />
                  </div>
                  <input
                    className="w-full pl-10 pr-12 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline-variant"
                    id="password"
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface-variant transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-2">
                <button
                  className="w-full bg-[#0F766E] text-white font-bold py-3 rounded-lg hover:bg-primary transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></span>
                  ) : (
                    <>
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Demo Pre-fills */}
              {/* <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-outline-variant"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-surface-container-lowest text-slate-400 font-bold uppercase">Quick Demo Login</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.role}
                    type="button"
                    onClick={() => applyDemoUser(u)}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-left transition-colors flex flex-col gap-0.5"
                  >
                    <span className="text-secondary tracking-tight font-extrabold">{u.role.replace("_", " ")}</span>
                    <span className="text-slate-500 font-mono text-[9px] truncate">{u.email}</span>
                  </button>
                ))}
              </div> */}
            </form>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center border-t border-outline-variant/30 bg-surface-container-lower">
        <p className="text-xs font-semibold text-slate-400">
          © 2026 Harvest WMS • Global Logistics Solutions
        </p>
      </footer>
    </div>
  );
}
