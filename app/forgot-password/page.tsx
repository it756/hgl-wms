"use client";

import { useState } from "react";
import { Warehouse, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (resetError) throw new Error(resetError.message);

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-surface text-on-surface">
      <main className="flex-grow flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Subtle Atmospheric Background Detail */}
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-400 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full bg-amber-400 blur-[80px]"></div>
        </div>

        {/* Forgot Password Container */}
        <div className="w-full max-w-[440px] z-10">
          {/* Brand Identity Section */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="flex items-center gap-2 mb-2">
              <Warehouse className="text-primary w-10 h-10" />
              <span className="text-2xl font-extrabold tracking-tight text-on-background uppercase animate-pulse">
                Harvest WMS
              </span>
            </div>
            <h1 className="text-lg font-semibold text-slate-500">Reset your password</h1>
          </div>

          {/* Reset password Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            {submitted ? (
              <div className="flex flex-col gap-4 text-center">
                <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-lg p-4 text-sm font-semibold">
                  We have sent a reset password link to{" "}
                  <strong className="break-all">{email}</strong> if it exists. Please check your
                  inbox.
                </div>
                <Link
                  href="/"
                  className="mt-2 text-sm font-bold text-primary hover:underline flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your email address associated with your Harvest WMS account, and we will
                  send you a secure password reset link.
                </p>

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
                      <span>Send Reset Link</span>
                    )}
                  </button>
                </div>

                <div className="border-t border-outline-variant/50 pt-4 flex justify-center">
                  <Link
                    href="/"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
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
