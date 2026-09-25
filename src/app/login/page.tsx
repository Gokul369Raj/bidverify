"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import AuthPanel from "@/components/AuthPanel";
import {
  Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, LogIn, ArrowLeft,
  Lock, Mail,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      setError("");
      const redirectTo = data?.data?.redirect || "/bidder";
      setTimeout(() => { window.location.href = redirectTo; }, 250);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-[var(--radius)] border-[1.5px] border-[var(--border)] bg-white text-[14px] text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] outline-none transition-all focus:border-[var(--navy-600)] focus:ring-[3px] focus:ring-[var(--navy-600)]/14 disabled:bg-[var(--surface-2)]";

  return (
    <div className="min-h-screen flex bg-[var(--surface-2)]">
      <AuthPanel
        title="Evidence-backed procurement, from notice to decision."
        subtitle="Sign in to verify documents, evaluate bids and maintain a complete audit trail across every government tender."
        points={[
          "Cross-verification with GSTN, PAN, Udyam, EPFO & ESIC",
          "Automated 12-step document verification pipeline",
          "Immutable audit trail for every evaluation decision",
        ]}
      />

      {/* ── Form side ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="tricolor-bar lg:hidden" />

        {/* Compact masthead for mobile */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <Emblem height={34} />
            <span className="text-[15px] font-extrabold text-[var(--navy-800)] tracking-tight">
              BidGuard<span className="text-[var(--saffron-500)]"> AI</span>
            </span>
          </Link>
          <Link href="/" className="text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)]">
            Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:py-14">
          <div className="w-full max-w-[420px]">
            <Link
              href="/"
              className="hidden lg:inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] transition-colors mb-7"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to portal home
            </Link>

            <div className="mb-7">
              <span className="badge badge-navy mb-3">
                <Lock className="w-3 h-3" aria-hidden="true" /> Secure Sign-in
              </span>
              <h1 className="text-[27px] font-extrabold text-[var(--navy-800)] tracking-tight leading-tight">
                Welcome back
              </h1>
              <p className="text-[14px] text-[var(--foreground-secondary)] mt-2">
                Sign in to your BidGuard AI account to continue.
              </p>
            </div>

            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow)] p-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="notice notice-danger" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="field-label">
                    Registered Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputBase} pl-10 pr-4 py-3`}
                      placeholder="you@organisation.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="field-label !mb-0">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[12.5px] font-semibold text-[var(--navy-600)] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputBase} pl-10 pr-11 py-3`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-tertiary)] hover:text-[var(--navy-700)] cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-navy w-full btn-lg">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Verifying credentials…
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <span className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[12px] font-medium text-[var(--foreground-tertiary)]">New to the portal?</span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </div>

              <Link href="/register" className="btn btn-outline w-full">
                Create a Bidder Account
              </Link>
            </div>

            {/* Demo credentials — helpful during evaluation */}
            <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="w-full flex items-center justify-between px-4 py-3 text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                  Demo accounts for evaluation
                </span>
                <span className="text-[var(--foreground-tertiary)]">{showDemo ? "−" : "+"}</span>
              </button>
              {showDemo && (
                <div className="border-t border-[var(--border)] divide-y divide-[var(--border-light)]">
                  {[
                    { role: "Bidder", email: "sunil.kumar@abcindustries.example", pass: "password123" },
                    { role: "Procurement Officer", email: "rajesh.verma@procurement.gov.in", pass: "password123" },
                    { role: "Super Admin", email: "admin@bidverify.ai", pass: "admin@bidverify2026" },
                  ].map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => { setEmail(d.email); setPassword(d.pass); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--navy-50)] transition-colors cursor-pointer"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy-600)]">{d.role}</div>
                      <div className="text-[12px] text-[var(--foreground-secondary)] mt-0.5">{d.email}</div>
                      <div className="text-[11px] text-[var(--foreground-tertiary)] mono">{d.pass}</div>
                    </button>
                  ))}
                  <p className="px-4 py-2.5 text-[11px] text-[var(--foreground-tertiary)] bg-[var(--surface-2)]">
                    Click any account to auto-fill the form.
                  </p>
                </div>
              )}
            </div>

            <p className="text-center text-[11.5px] text-[var(--foreground-tertiary)] mt-6 leading-relaxed">
              Protected under the Information Technology Act, 2000.
              <br />
              Unauthorised access is prohibited and logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
