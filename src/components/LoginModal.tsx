"use client";

import { useState } from "react";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import {
  X, Loader2, ArrowRight, ArrowLeft, Lock, Mail, AlertCircle,
  CircleCheck, ShieldCheck, UserRound, Building2, Check,
} from "lucide-react";
import { clearSessionCache } from "@/lib/session";

interface Props {
  open: boolean;
  onClose: () => void;
}

const input =
  "w-full rounded-[var(--radius)] border-[1.5px] border-[var(--border)] bg-white text-[14px] text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] px-3.5 py-3 outline-none transition-all focus:border-[var(--navy-600)] focus:ring-[3px] focus:ring-[var(--navy-600)]/14";
const label = "field-label";

export default function LoginModal({ open, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState<{ name: string; email: string } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [regForm, setRegForm] = useState({
    name: "", email: "", password: "",
    org: {
      legalName: "", tradeName: "", phone: "", pan: "", gstin: "", udyamNumber: "",
      registeredAddress: "", state: "", city: "",
    },
  });

  if (!open) return null;

  const setReg = (field: string, value: string) => {
    if (field.startsWith("org.")) {
      setRegForm((p) => ({ ...p, org: { ...p.org, [field.slice(4)]: value } }));
    } else {
      setRegForm((p) => ({ ...p, [field]: value }));
    }
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      clearSessionCache();
      window.location.href = data.data.redirect;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regForm.name,
          email: regForm.email,
          password: regForm.password,
          organization: regForm.org,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRegistered({ name: regForm.name, email: regForm.email });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  }

  const heading = registered
    ? "Registration successful"
    : mode === "login"
    ? "Sign in to BidGuard AI"
    : "Create your account";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[var(--navy-950)]/65 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div
        className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-[460px] overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-[var(--navy-800)] px-6 py-5 flex items-center gap-3.5">
          <Emblem height={40} variant="light" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold text-white leading-tight truncate">{heading}</h2>
            <p className="text-[11.5px] text-white/60 leading-tight mt-0.5">
              {registered
                ? "Your bidder account is ready"
                : mode === "login"
                ? "Access your compliance dashboard"
                : "Register to browse and bid on tenders"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/12 flex items-center justify-center text-white/70 hover:bg-white/22 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-7 pt-6">
          {error && (
            <div className="notice notice-danger mb-4" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Success ── */}
          {registered && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-[var(--green-100)] rounded-full flex items-center justify-center mx-auto mb-5">
                <CircleCheck className="w-8 h-8 text-[var(--green-600)]" aria-hidden="true" />
              </div>
              <h3 className="text-[17px] font-bold text-[var(--navy-800)] mb-1">
                Welcome, {registered.name}
              </h3>
              <p className="text-[13px] text-[var(--foreground-tertiary)] mb-6">{registered.email}</p>
              <a
                href="/bidder"
                onClick={() => clearSessionCache()}
                className="btn btn-navy w-full btn-lg"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          )}

          {/* ── Google ── */}
          {!registered && mode === "login" && (
            <>
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-3 w-full border-[1.5px] border-[var(--border)] bg-white text-[var(--foreground)] font-semibold py-3 rounded-[var(--radius)] hover:bg-[var(--surface-2)] hover:border-[var(--gray-300)] transition-colors text-[14px]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </a>

              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[11.5px] font-medium text-[var(--foreground-tertiary)]">
                  or sign in with email
                </span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </>
          )}

          {/* ── Login form ── */}
          {!registered && mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="lm-email" className={label}>Registered Email ID</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id="lm-email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${input} !pl-10`}
                    placeholder="you@organisation.com"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="lm-pass" className={`${label} !mb-0`}>Password</label>
                  <Link href="/forgot-password" className="text-[12px] font-semibold text-[var(--navy-600)] hover:underline">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id="lm-pass" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${input} !pl-10`}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-navy w-full cursor-pointer">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Signing in…</>
                ) : (
                  "Sign In"
                )}
              </button>

              <div className="notice notice-info !py-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-[12px]">
                  Demo password: <code className="mono font-semibold">password123</code>
                </span>
              </div>

              <div className="text-center pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); setStep(1); }}
                  className="text-[13.5px] font-semibold text-[var(--navy-700)] hover:underline cursor-pointer"
                >
                  Don&apos;t have an account? Register as a bidder
                </button>
              </div>
            </form>
          )}

          {/* ── Register form ── */}
          {!registered && mode === "register" && (
            <>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] mb-5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to sign in
              </button>

              <div className="flex items-center gap-3 mb-5">
                {[
                  { n: 1, label: "Account", icon: UserRound },
                  { n: 2, label: "Organisation", icon: Building2 },
                ].map((s, i) => (
                  <div key={s.n} className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${
                          step > s.n
                            ? "bg-[var(--green-600)] text-white"
                            : step === s.n
                            ? "bg-[var(--navy-800)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--foreground-tertiary)]"
                        }`}
                      >
                        {step > s.n ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <s.icon className="w-3.5 h-3.5" aria-hidden="true" />}
                      </span>
                      <span className={`text-[12.5px] font-bold ${step >= s.n ? "text-[var(--navy-800)]" : "text-[var(--foreground-tertiary)]"}`}>
                        {s.label}
                      </span>
                    </div>
                    {i === 0 && <span className={`flex-1 h-[2px] rounded ${step > 1 ? "bg-[var(--green-600)]" : "bg-[var(--border)]"}`} />}
                  </div>
                ))}
              </div>

              <form onSubmit={handleRegister}>
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={label}>Full Name *</label>
                      <input className={input} required value={regForm.name} onChange={(e) => setReg("name", e.target.value)} placeholder="As per PAN records" />
                    </div>
                    <div>
                      <label className={label}>Email ID *</label>
                      <input className={input} type="email" required value={regForm.email} onChange={(e) => setReg("email", e.target.value)} placeholder="you@organisation.com" />
                    </div>
                    <div>
                      <label className={label}>Password *</label>
                      <input className={input} type="password" required minLength={8} value={regForm.password} onChange={(e) => setReg("password", e.target.value)} placeholder="Minimum 8 characters" />
                    </div>
                    <button
                      type="button"
                      disabled={!(regForm.name && regForm.email && regForm.password.length >= 8)}
                      onClick={() => setStep(2)}
                      className="btn btn-navy w-full cursor-pointer"
                    >
                      Continue <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className={label}>Legal Name *</label>
                      <input className={input} required value={regForm.org.legalName} onChange={(e) => setReg("org.legalName", e.target.value)} placeholder="As per MCA / PAN" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={label}>PAN</label>
                        <input className={`${input} mono`} value={regForm.org.pan} onChange={(e) => setReg("org.pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                      </div>
                      <div>
                        <label className={label}>GSTIN</label>
                        <input className={`${input} mono`} value={regForm.org.gstin} onChange={(e) => setReg("org.gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={label}>Phone</label>
                        <input className={input} value={regForm.org.phone} onChange={(e) => setReg("org.phone", e.target.value)} placeholder="+91 98765 43210" />
                      </div>
                      <div>
                        <label className={label}>City</label>
                        <input className={input} value={regForm.org.city} onChange={(e) => setReg("org.city", e.target.value)} placeholder="City" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setStep(1)} className="btn btn-outline flex-1 cursor-pointer">
                        Back
                      </button>
                      <button type="submit" disabled={loading} className="btn btn-saffron flex-[1.4] cursor-pointer">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                        Create Account
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
