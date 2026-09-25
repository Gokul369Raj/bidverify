"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import AuthPanel from "@/components/AuthPanel";
import { INDIAN_STATES } from "@/lib/constants";
import { clearSessionCache } from "@/lib/session";
import {
  Loader2, Building2, AlertCircle, ArrowLeft, ArrowRight, Check,
  UserRound, Landmark, CircleCheck, FileText,
} from "lucide-react";

const ORG_TYPES = [
  { value: "PRIVATE_LIMITED", label: "Private Limited" },
  { value: "PUBLIC_LIMITED", label: "Public Limited" },
  { value: "LLP", label: "LLP" },
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
];

const BIZ_CATEGORIES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "TRADER", label: "Trader" },
  { value: "SERVICE_PROVIDER", label: "Service Provider" },
  { value: "CONSULTANT", label: "Consultant" },
];

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

  const input = "input-field";
  const col = "grid grid-cols-1 sm:grid-cols-2 gap-4";
  const step1Valid = form.name.trim() && form.email.trim() && form.password.length >= 8;

  return (
    <div className="min-h-screen flex bg-[var(--surface-2)]">
      <AuthPanel
        title="Register once. Bid with confidence across every tender."
        subtitle="Create your organisation profile and build a verified document locker that you can reuse for every future government tender."
        points={[
          "One-time KYC — PAN, GSTIN, Udyam & CIN verified",
          "Reusable Entity Locker for all future submissions",
          "Pre-submission compliance check before you bid",
        ]}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="tricolor-bar lg:hidden" />

        <div className="lg:hidden flex items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo size="sm" href={null} />
          </Link>
          <Link href="/login" className="text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)]">
            Sign in
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-5 py-10 sm:py-12 overflow-y-auto">
          <div className="w-full max-w-[660px]">
            <Link
              href="/"
              className="hidden lg:inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to portal home
            </Link>

            {/* ═══════ Success state ═══════ */}
            {registered ? (
              <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow)] p-8 sm:p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--green-100)] flex items-center justify-center mx-auto mb-5">
                  <CircleCheck className="w-9 h-9 text-[var(--green-600)]" aria-hidden="true" />
                </div>
                <h2 className="text-[24px] font-extrabold text-[var(--navy-800)] mb-2">
                  Registration successful
                </h2>
                <p className="text-[14px] text-[var(--foreground-secondary)] mb-1">
                  Welcome aboard, <span className="font-bold text-[var(--foreground)]">{registered.name}</span>
                </p>
                <p className="text-[13px] text-[var(--foreground-tertiary)] mb-7">{registered.email}</p>

                <div className="notice notice-success text-left mb-7">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Your bidder account is active and you are now signed in. Complete your
                    organisation profile and upload documents to build your compliance passport.
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  <a
                    href="/bidder"
                    onClick={() => clearSessionCache()}
                    className="btn btn-navy btn-lg w-full"
                  >
                    Go to Dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                  <Link href="/" className="btn btn-outline w-full">
                    Return to Portal Home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <span className="badge badge-saffron mb-3">Bidder Registration</span>
                  <h1 className="text-[27px] font-extrabold text-[var(--navy-800)] tracking-tight leading-tight">
                    Create your account
                  </h1>
                  <p className="text-[14px] text-[var(--foreground-secondary)] mt-2">
                    Two quick steps — account credentials, then your organisation details.
                  </p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-3 mb-6">
                  {[
                    { n: 1, label: "Account", icon: UserRound },
                    { n: 2, label: "Organisation", icon: Building2 },
                  ].map((s, i) => {
                    const active = step === s.n;
                    const done = step > s.n;
                    return (
                      <div key={s.n} className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                              done
                                ? "bg-[var(--green-600)] text-white"
                                : active
                                ? "bg-[var(--navy-800)] text-white"
                                : "bg-[var(--surface-3)] text-[var(--foreground-tertiary)]"
                            }`}
                          >
                            {done ? <Check className="w-4 h-4" aria-hidden="true" /> : <s.icon className="w-4 h-4" aria-hidden="true" />}
                          </span>
                          <span
                            className={`text-[13.5px] font-bold ${
                              active || done ? "text-[var(--navy-800)]" : "text-[var(--foreground-tertiary)]"
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                        {i === 0 && (
                          <span className={`flex-1 h-[2px] rounded ${step > 1 ? "bg-[var(--green-600)]" : "bg-[var(--border)]"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow)] p-6 sm:p-8">
                  {error && (
                    <div className="notice notice-danger mb-5" role="alert">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* ═══ Step 1 — Account ═══ */}
                    {step === 1 && (
                      <div className="space-y-5">
                        <div>
                          <label htmlFor="name" className="field-label">Full Name <span className="text-[var(--danger)]">*</span></label>
                          <input
                            id="name" className={input} required
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="As per PAN records"
                            autoComplete="name"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-email" className="field-label">Email ID <span className="text-[var(--danger)]">*</span></label>
                          <input
                            id="reg-email" className={input} type="email" required
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            placeholder="you@organisation.com"
                            autoComplete="email"
                          />
                          <p className="field-hint">All tender alerts and verification results are sent here.</p>
                        </div>
                        <div>
                          <label htmlFor="reg-password" className="field-label">Password <span className="text-[var(--danger)]">*</span></label>
                          <input
                            id="reg-password" className={input} type="password" required minLength={8}
                            value={form.password}
                            onChange={(e) => set("password", e.target.value)}
                            placeholder="Minimum 8 characters"
                            autoComplete="new-password"
                          />
                          <p className="field-hint">Use at least 8 characters with a mix of letters and numbers.</p>
                        </div>
                        <button
                          type="button"
                          disabled={!step1Valid}
                          onClick={() => step1Valid && setStep(2)}
                          className="btn btn-navy btn-lg w-full"
                        >
                          Continue to Organisation <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    {/* ═══ Step 2 — Organisation ═══ */}
                    {step === 2 && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-[15px] font-bold text-[var(--navy-800)] mb-1 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                            Organisation Identity
                          </h2>
                          <p className="text-[12.5px] text-[var(--foreground-tertiary)] mb-4">
                            Details are matched against MCA21, GSTN and Udyam records during verification.
                          </p>
                          <div className={col}>
                            <div>
                              <label className="field-label">Legal Name <span className="text-[var(--danger)]">*</span></label>
                              <input className={input} required value={form.org.legalName} onChange={(e) => set("org.legalName", e.target.value)} placeholder="As per MCA / PAN" />
                            </div>
                            <div>
                              <label className="field-label">Trade Name</label>
                              <input className={input} value={form.org.tradeName} onChange={(e) => set("org.tradeName", e.target.value)} placeholder="Brand / trade name" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-[15px] font-bold text-[var(--navy-800)] mb-1 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                            Statutory Registrations
                          </h2>
                          <p className="text-[12.5px] text-[var(--foreground-tertiary)] mb-4">
                            Enter these exactly as printed on your certificates.
                          </p>
                          <div className={col}>
                            <div>
                              <label className="field-label">PAN</label>
                              <input className={`${input} mono`} value={form.org.pan} onChange={(e) => set("org.pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                            </div>
                            <div>
                              <label className="field-label">GSTIN</label>
                              <input className={`${input} mono`} value={form.org.gstin} onChange={(e) => set("org.gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
                            </div>
                            <div>
                              <label className="field-label">Udyam / MSME Number</label>
                              <input className={`${input} mono`} value={form.org.udyamNumber} onChange={(e) => set("org.udyamNumber", e.target.value.toUpperCase())} placeholder="UDYAM-MH-01-0012345" />
                            </div>
                            <div>
                              <label className="field-label">CIN</label>
                              <input className={`${input} mono`} value={form.org.cin} onChange={(e) => set("org.cin", e.target.value.toUpperCase())} placeholder="L12345MH2000PLC000000" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="field-label">Contact Phone</label>
                              <input className={input} value={form.org.phone} onChange={(e) => set("org.phone", e.target.value)} placeholder="+91 98765 43210" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-[15px] font-bold text-[var(--navy-800)] mb-1 flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                            Registered Address
                          </h2>
                          <p className="text-[12.5px] text-[var(--foreground-tertiary)] mb-4">
                            Used for local-content and state-specific eligibility rules.
                          </p>
                          <div className="space-y-4">
                            <div>
                              <label className="field-label">Address</label>
                              <input className={input} value={form.org.registeredAddress} onChange={(e) => set("org.registeredAddress", e.target.value)} placeholder="Building, street, locality" />
                            </div>
                            <div className={col}>
                              <div>
                                <label className="field-label">State / UT</label>
                                <select className={input} value={form.org.state} onChange={(e) => set("org.state", e.target.value)}>
                                  <option value="">Select state</option>
                                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="field-label">City / District</label>
                                <input className={input} value={form.org.city} onChange={(e) => set("org.city", e.target.value)} placeholder="City" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-[15px] font-bold text-[var(--navy-800)] mb-1">Classification</h2>
                          <p className="text-[12.5px] text-[var(--foreground-tertiary)] mb-4">
                            Determines exemptions and preference policies applied to your bids.
                          </p>
                          <div className={col}>
                            <div>
                              <label className="field-label">Organisation Type</label>
                              <select className={input} value={form.org.organizationType} onChange={(e) => set("org.organizationType", e.target.value)}>
                                <option value="">Select type</option>
                                {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="field-label">Business Category</label>
                              <select className={input} value={form.org.businessCategory} onChange={(e) => set("org.businessCategory", e.target.value)}>
                                <option value="">Select category</option>
                                {BIZ_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>

                          <fieldset className="mt-4">
                            <legend className="field-label mb-2.5">Applicable Status</legend>
                            <div className="flex flex-wrap gap-2.5">
                              {[
                                { key: "isMsme", label: "MSME / Udyam Registered" },
                                { key: "isStartup", label: "Startup (DPIIT)" },
                                { key: "isOem", label: "OEM" },
                              ].map((c) => {
                                const checked = form.org[c.key as "isMsme" | "isStartup" | "isOem"];
                                return (
                                  <label
                                    key={c.key}
                                    className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-[var(--radius)] border-[1.5px] cursor-pointer text-[13px] font-semibold transition-colors ${
                                      checked
                                        ? "bg-[var(--navy-100)] border-[var(--navy-600)] text-[var(--navy-700)]"
                                        : "bg-white border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--navy-500)]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={checked}
                                      onChange={(e) => set("org." + c.key, e.target.checked)}
                                    />
                                    <span className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 ${checked ? "bg-[var(--navy-800)] border-[var(--navy-800)]" : "border-[var(--gray-300)]"}`}>
                                      {checked && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                                    </span>
                                    {c.label}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                          <button type="button" onClick={() => setStep(1)} className="btn btn-outline sm:flex-1">
                            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
                          </button>
                          <button type="submit" disabled={loading} className="btn btn-saffron sm:flex-[2]">
                            {loading ? (
                              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Creating account…</>
                            ) : (
                              <><Building2 className="w-4 h-4" aria-hidden="true" /> Create Account</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                <p className="text-center text-[13px] text-[var(--foreground-secondary)] mt-5">
                  Already registered?{" "}
                  <Link href="/login" className="font-semibold text-[var(--navy-700)] hover:underline">
                    Sign in to your account
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
