"use client";
import { useState } from "react";
import { X, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { clearSessionCache } from "@/lib/session";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState<{ name: string; email: string } | null>(null);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register state
  const [regForm, setRegForm] = useState({
    name: "", email: "", password: "",
    org: { legalName: "", tradeName: "", phone: "", pan: "", gstin: "", udyamNumber: "", registeredAddress: "", state: "", city: "" },
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
      clearSessionCache(); // drop stale cached session before the redirect
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
        body: JSON.stringify({ name: regForm.name, email: regForm.email, password: regForm.password, organization: regForm.org }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRegistered({ name: regForm.name, email: regForm.email });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  }

  const input = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-[#86868b] focus:bg-white/10 focus:border-[#2997ff] focus:outline-none focus:ring-0 transition-colors";
  const label = "block text-[13px] font-medium text-[#d6d6d7] mb-1.5";

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4" onClick={onClose}>
      <div
        className="bg-[#1C1C1E] border border-white/12 rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glass-nav px-8 pt-8 pb-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <h2 className="display-3 !text-[28px] !text-white">
              {registered ? "Welcome aboard." : mode === "login" ? "Login to BIDGUARD AI." : "Create your account."}
            </h2>
            {!registered && (
              <p className="text-sm text-[#a1a1a6] mt-1.5">
                {mode === "login" ? "Access your compliance dashboard." : "Register to browse and bid on tenders."}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#a1a1a6] hover:bg-white/20 hover:text-white transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-8 pb-8 pt-6">
          {error && (
            <div className="mb-4 bg-[#ff453a]/15 text-[#ff6961] text-sm rounded-xl px-4 py-3 border border-[#ff453a]/30">{error}</div>
          )}

          {/* Success State */}
          {registered && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-[#30d158]/15 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-[#30d158]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="headline mb-1">Welcome, {registered.name}.</h3>
              <p className="text-sm text-[#a1a1a6] mb-6">{registered.email}</p>
              <a
                href="/bidder"
                onClick={() => clearSessionCache()}
                className="btn-apple !text-base"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Google Sign-In */}
          {!registered && mode === "login" && (
            <>
              <a href="/api/auth/google" className="flex items-center justify-center gap-3 w-full bg-white text-black font-medium py-3 rounded-full hover:bg-white/90 transition-colors text-[15px]">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </a>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-transparent px-4 text-[#86868b]">or sign in with email</span></div>
              </div>
            </>
          )}

          {/* ═══ LOGIN FORM ═══ */}
          {!registered && mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={label}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@example.com" />
              </div>
              <div>
                <label className={label}>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="Password" />
              </div>
              <button type="submit" disabled={loading} className="btn-apple w-full disabled:opacity-50 cursor-pointer">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Logging in…" : "Login"}
              </button>
              <p className="text-center text-xs text-[#86868b]">
                Demo password: <code className="bg-white/10 px-1.5 py-0.5 rounded-md">password123</code>
              </p>
              <div className="text-center pt-4 border-t border-[#f5f5f7]">
                <button type="button" onClick={() => { setMode("register"); setError(""); setStep(1); }} className="link-apple text-[15px] cursor-pointer">
                  Don&apos;t have an account? <span className="font-medium">Register as a bidder</span>
                </button>
              </div>
            </form>
          )}

          {/* ═══ REGISTER FORM ═══ */}
          {!registered && mode === "register" && (
            <>
              <button type="button" onClick={() => { setMode("login"); setError(""); }} className="flex items-center gap-1 text-xs text-[#a1a1a6] hover:text-white mb-5 cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>

              {/* Step Indicator */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`flex items-center gap-2 text-[13px] font-medium ${step === 1 ? "text-[#0071e3]" : "text-[#86868b]"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step === 1 ? "bg-[#0071e3] text-white" : "bg-white/10 text-[#86868b]"}`}>1</span>
                  Account
                </div>
                <div className="flex-1 h-px bg-white/10" />
                <div className={`flex items-center gap-2 text-[13px] font-medium ${step === 2 ? "text-[#0071e3]" : "text-[#86868b]"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 2 ? "bg-[#0071e3] text-white" : "bg-white/10 text-[#86868b]"}`}>2</span>
                  Organization
                </div>
              </div>

              <form onSubmit={handleRegister}>
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={label}>Full Name *</label>
                      <input className={input} required value={regForm.name} onChange={(e) => setReg("name", e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <label className={label}>Email *</label>
                      <input className={input} type="email" required value={regForm.email} onChange={(e) => setReg("email", e.target.value)} placeholder="you@company.com" />
                    </div>
                    <div>
                      <label className={label}>Password (min 8 chars) *</label>
                      <input className={input} type="password" required minLength={8} value={regForm.password} onChange={(e) => setReg("password", e.target.value)} placeholder="••••••••" />
                    </div>
                    <button type="button" onClick={() => { if (regForm.name && regForm.email && regForm.password.length >= 8) setStep(2); }} className="btn-apple w-full cursor-pointer">
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className={label}>Legal Name *</label>
                      <input className={input} required value={regForm.org.legalName} onChange={(e) => setReg("org.legalName", e.target.value)} placeholder="Company Legal Name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={label}>PAN</label>
                        <input className={input} value={regForm.org.pan} onChange={(e) => setReg("org.pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                      </div>
                      <div>
                        <label className={label}>GSTIN</label>
                        <input className={input} value={regForm.org.gstin} onChange={(e) => setReg("org.gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={label}>Phone</label>
                        <input className={input} value={regForm.org.phone} onChange={(e) => setReg("org.phone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
                      </div>
                      <div>
                        <label className={label}>City</label>
                        <input className={input} value={regForm.org.city} onChange={(e) => setReg("org.city", e.target.value)} placeholder="City" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setStep(1)} className="btn-apple-secondary flex-1 !py-3 cursor-pointer">Back</button>
                      <button type="submit" disabled={loading} className="btn-apple flex-1 !py-3 disabled:opacity-50 cursor-pointer">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
