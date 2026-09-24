"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Loader2 } from "lucide-react";
import { INDIAN_STATES } from "@/lib/constants";
import { clearSessionCache } from "@/lib/session";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [registered, setRegistered] = useState<{ name: string; email: string } | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", password: "",
    org: {
      legalName: "", tradeName: "", phone: "", pan: "", gstin: "", udyamNumber: "",
      cin: "", registeredAddress: "", state: "", city: "",
      organizationType: "", businessCategory: "",
      isMsme: false, isStartup: false, isOem: false,
    },
  });

  const set = (field: string, value: string | boolean) => {
    if (field.startsWith("org.")) {
      setForm((p) => ({ ...p, org: { ...p.org, [field.slice(4)]: value } }));
    } else {
      setForm((p) => ({ ...p, [field]: value }));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, organization: form.org }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRegistered({ name: form.name, email: form.email });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const input = "input-field";
  const label = "block text-sm font-medium mb-1";
  const col = "grid grid-cols-1 sm:grid-cols-2 gap-4";

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center"><Shield className="w-6 h-6 text-white" /></div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Create Bidder Account</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1"><Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">← Back to Home</Link></p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm p-6 sm:p-8">
          {/* Success State */}
          {registered && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[var(--success-light)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Successfully Registered!</h2>
              <p className="text-[var(--foreground-secondary)] mb-1">Welcome, <span className="font-semibold text-[var(--foreground)]">{registered.name}</span></p>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-6">{registered.email}</p>
              <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-lg px-4 py-3 text-sm text-[var(--success)] mb-6">
                Your bidder account has been created. You are now logged in!
              </div>
              <div className="flex flex-col gap-3">
                <a href="/bidder" onClick={() => clearSessionCache()} className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white font-medium px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm">
                  Go to Bidder Dashboard →
                </a>
                <Link href="/" className="inline-flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--foreground)] font-medium px-6 py-3 rounded-lg hover:bg-[var(--surface-2)] transition-colors text-sm">
                  ← Go to Home
                </Link>
              </div>
            </div>
          )}

          {/* Registration Form */}
          {!registered && (
          <>
          {error && <div className="mb-4 bg-[var(--danger-light)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-lg px-4 py-3">{error}</div>}

          {/* Google Sign-In */}
          <a href="/api/auth/google" className="flex items-center justify-center gap-3 w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] font-medium py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors text-sm mb-4">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign up with Google
          </a>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-[var(--surface)] px-3 text-[var(--foreground-tertiary)]">or continue with email</span></div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? "text-[var(--accent)]" : "text-[var(--foreground-tertiary)]"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? "bg-[var(--accent)] text-white" : "bg-[var(--border-light)] text-[var(--foreground-secondary)]"}`}>1</span>
              Account
            </div>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? "text-[var(--accent)]" : "text-[var(--foreground-tertiary)]"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-[var(--accent)] text-white" : "bg-[var(--border-light)] text-[var(--foreground-secondary)]"}`}>2</span>
              Organization
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={label}>Full Name</label>
                  <input className={input} required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className={label}>Email</label>
                  <input className={input} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className={label}>Password (min 8 chars)</label>
                  <input className={input} type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
                </div>
                <button type="button" onClick={() => { if (form.name && form.email && form.password.length >= 8) setStep(2); }} className="w-full bg-[var(--accent)] text-white font-medium py-2.5 rounded-lg hover:bg-[var(--accent-hover)] text-sm">Next →</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className={col}>
                  <div>
                    <label className={label}>Legal Name *</label>
                    <input className={input} required value={form.org.legalName} onChange={(e) => set("org.legalName", e.target.value)} placeholder="Company Legal Name" />
                  </div>
                  <div>
                    <label className={label}>Trade Name</label>
                    <input className={input} value={form.org.tradeName} onChange={(e) => set("org.tradeName", e.target.value)} placeholder="Brand/Trade Name" />
                  </div>
                </div>
                <div className={col}>
                  <div>
                    <label className={label}>PAN</label>
                    <input className={input} value={form.org.pan} onChange={(e) => set("org.pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                  </div>
                  <div>
                    <label className={label}>GSTIN</label>
                    <input className={input} value={form.org.gstin} onChange={(e) => set("org.gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
                  </div>
                </div>
                <div className={col}>
                  <div>
                    <label className={label}>Udyam / MSME Number</label>
                    <input className={input} value={form.org.udyamNumber} onChange={(e) => set("org.udyamNumber", e.target.value.toUpperCase())} placeholder="UDYAM-MH-01-0012345" />
                  </div>
                  <div>
                    <label className={label}>Phone</label>
                    <input className={input} value={form.org.phone} onChange={(e) => set("org.phone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div>
                  <label className={label}>Registered Address</label>
                  <input className={input} value={form.org.registeredAddress} onChange={(e) => set("org.registeredAddress", e.target.value)} placeholder="Full registered address" />
                </div>
                <div className={col}>
                  <div>
                    <label className={label}>State</label>
                    <select className={input} value={form.org.state} onChange={(e) => set("org.state", e.target.value)}>
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>City</label>
                    <input className={input} value={form.org.city} onChange={(e) => set("org.city", e.target.value)} placeholder="City" />
                  </div>
                </div>
                <div className={col}>
                  <div>
                    <label className={label}>Organization Type</label>
                    <select className={input} value={form.org.organizationType} onChange={(e) => set("org.organizationType", e.target.value)}>
                      <option value="">Select</option>
                      <option value="PRIVATE_LIMITED">Private Limited</option>
                      <option value="PUBLIC_LIMITED">Public Limited</option>
                      <option value="LLP">LLP</option>
                      <option value="PROPRIETORSHIP">Proprietorship</option>
                      <option value="PARTNERSHIP">Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Business Category</label>
                    <select className={input} value={form.org.businessCategory} onChange={(e) => set("org.businessCategory", e.target.value)}>
                      <option value="">Select</option>
                      <option value="MANUFACTURER">Manufacturer</option>
                      <option value="TRADER">Trader</option>
                      <option value="SERVICE_PROVIDER">Service Provider</option>
                      <option value="CONSULTANT">Consultant</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input type="checkbox" checked={form.org.isMsme} onChange={(e) => set("org.isMsme", e.target.checked)} className="rounded" />
                    MSME
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input type="checkbox" checked={form.org.isStartup} onChange={(e) => set("org.isStartup", e.target.checked)} className="rounded" />
                    Startup (DPIIT)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input type="checkbox" checked={form.org.isOem} onChange={(e) => set("org.isOem", e.target.checked)} className="rounded" />
                    OEM
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 border border-[var(--border)] text-[var(--foreground)] font-medium py-2.5 rounded-lg hover:bg-[var(--surface-2)] text-sm">← Back</button>
                  <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] text-white font-medium py-2.5 rounded-lg hover:bg-[var(--accent-hover)] text-sm disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Create Account
                  </button>
                </div>                </div>
              )}
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
