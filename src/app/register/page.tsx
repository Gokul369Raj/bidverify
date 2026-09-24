"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Loader2, Building2 } from "lucide-react";
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
        method: "POST", credentials: "include",
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

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm px-4 py-3 outline-none focus:border-[var(--saffron)] focus:ring-1 focus:ring-[var(--saffron)]/30 placeholder-blue-200/30 transition-all";
  const labelClass = "block text-sm font-medium text-blue-200/80 mb-1.5";
  const col = "grid grid-cols-1 sm:grid-cols-2 gap-4";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1D3A] via-[#0F2847] to-[#162D52] py-12 px-4">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <div className="relative max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[var(--saffron)] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-2xl leading-none">BIDGUARD <span className="text-[var(--saffron)]">AI</span></div>
              <div className="text-blue-200/40 text-xs mt-0.5">Secure Procurement. Stronger India.</div>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create Bidder Account</h1>
          <p className="text-sm text-blue-200/60 mt-1"><Link href="/" className="text-[var(--saffron)] hover:text-[var(--saffron-light)]">← Back to Home</Link></p>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8">
          {registered && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Successfully Registered!</h2>
              <p className="text-blue-200/60 mb-1">Welcome, <span className="font-semibold text-white">{registered.name}</span></p>
              <p className="text-sm text-blue-200/40 mb-6">{registered.email}</p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300 mb-6">
                Your bidder account has been created. You are now logged in!
              </div>
              <div className="flex flex-col gap-3">
                <a href="/bidder" onClick={() => clearSessionCache()} className="inline-flex items-center justify-center gap-2 bg-[var(--saffron)] text-white font-medium px-6 py-3 rounded-xl hover:bg-[var(--saffron-dark)] transition-colors text-sm shadow-lg">
                  Go to Dashboard →
                </a>
                <Link href="/" className="inline-flex items-center justify-center gap-2 border border-white/10 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/5 transition-colors text-sm">
                  ← Go to Home
                </Link>
              </div>
            </div>
          )}

          {!registered && (
            <>
              {error && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>}

              {/* Step Indicator */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? "text-[var(--saffron)]" : "text-blue-200/40"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? "bg-[var(--saffron)] text-white" : "bg-white/10 text-blue-200/40"}`}>1</span>
                  Account
                </div>
                <div className="flex-1 h-px bg-white/10" />
                <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? "text-[var(--saffron)]" : "text-blue-200/40"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-[var(--saffron)] text-white" : "bg-white/10 text-blue-200/40"}`}>2</span>
                  Organization
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input className={inputClass} required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <label className={labelClass}>Email</label>
                      <input className={inputClass} type="email" required value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@company.com" />
                    </div>
                    <div>
                      <label className={labelClass}>Password (min 8 chars)</label>
                      <input className={inputClass} type="password" required minLength={8} value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" />
                    </div>
                    <button type="button" onClick={() => { if (form.name && form.email && form.password.length >= 8) setStep(2); }} className="w-full bg-[var(--saffron)] text-white font-semibold py-3 rounded-xl hover:bg-[var(--saffron-dark)] transition-all shadow-lg shadow-saffron/20">
                      Next →
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className={col}>
                      <div><label className={labelClass}>Legal Name *</label><input className={inputClass} required value={form.org.legalName} onChange={e => set("org.legalName", e.target.value)} placeholder="Company Legal Name" /></div>
                      <div><label className={labelClass}>Trade Name</label><input className={inputClass} value={form.org.tradeName} onChange={e => set("org.tradeName", e.target.value)} placeholder="Brand/Trade Name" /></div>
                    </div>
                    <div className={col}>
                      <div><label className={labelClass}>PAN</label><input className={inputClass} value={form.org.pan} onChange={e => set("org.pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} /></div>
                      <div><label className={labelClass}>GSTIN</label><input className={inputClass} value={form.org.gstin} onChange={e => set("org.gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} /></div>
                    </div>
                    <div className={col}>
                      <div><label className={labelClass}>Udyam / MSME Number</label><input className={inputClass} value={form.org.udyamNumber} onChange={e => set("org.udyamNumber", e.target.value.toUpperCase())} placeholder="UDYAM-MH-01-0012345" /></div>
                      <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.org.phone} onChange={e => set("org.phone", e.target.value)} placeholder="+91 XXXXX XXXXX" /></div>
                    </div>
                    <div><label className={labelClass}>Registered Address</label><input className={inputClass} value={form.org.registeredAddress} onChange={e => set("org.registeredAddress", e.target.value)} placeholder="Full registered address" /></div>
                    <div className={col}>
                      <div>
                        <label className={labelClass}>State</label>
                        <select className={inputClass} value={form.org.state} onChange={e => set("org.state", e.target.value)}>
                          <option value="">Select state</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label className={labelClass}>City</label><input className={inputClass} value={form.org.city} onChange={e => set("org.city", e.target.value)} placeholder="City" /></div>
                    </div>
                    <div className={col}>
                      <div>
                        <label className={labelClass}>Organization Type</label>
                        <select className={inputClass} value={form.org.organizationType} onChange={e => set("org.organizationType", e.target.value)}>
                          <option value="">Select</option>
                          <option value="PRIVATE_LIMITED">Private Limited</option>
                          <option value="PUBLIC_LIMITED">Public Limited</option>
                          <option value="LLP">LLP</option>
                          <option value="PROPRIETORSHIP">Proprietorship</option>
                          <option value="PARTNERSHIP">Partnership</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Business Category</label>
                        <select className={inputClass} value={form.org.businessCategory} onChange={e => set("org.businessCategory", e.target.value)}>
                          <option value="">Select</option>
                          <option value="MANUFACTURER">Manufacturer</option>
                          <option value="TRADER">Trader</option>
                          <option value="SERVICE_PROVIDER">Service Provider</option>
                          <option value="CONSULTANT">Consultant</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.org.isMsme} onChange={e => set("org.isMsme", e.target.checked)} className="rounded" /> MSME</label>
                      <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.org.isStartup} onChange={e => set("org.isStartup", e.target.checked)} className="rounded" /> Startup (DPIIT)</label>
                      <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.org.isOem} onChange={e => set("org.isOem", e.target.checked)} className="rounded" /> OEM</label>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setStep(1)} className="flex-1 border border-white/10 text-white font-medium py-3 rounded-xl hover:bg-white/5 text-sm transition-colors">← Back</button>
                      <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[var(--saffron)] text-white font-semibold py-3 rounded-xl hover:bg-[var(--saffron-dark)] text-sm disabled:opacity-50 shadow-lg shadow-saffron/20">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                        Create Account
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-blue-200/25 mt-6">
          Smart India Hackathon 2026 • Team Anveshak 2.0
        </p>
      </div>
    </div>
  );
}
