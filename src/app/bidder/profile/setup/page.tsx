"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2, CheckCircle2, ArrowLeft, Shield } from "lucide-react";

export default function OrgSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/bidder";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [hasOrg, setHasOrg] = useState(false);

  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    phone: "",
    pan: "",
    gstin: "",
    udyamNumber: "",
    registeredAddress: "",
    state: "",
    city: "",
    organizationType: "PRIVATE_LIMITED",
    businessCategory: "MANUFACTURER",
    isMsme: false,
    isStartup: false,
    isOem: false,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data) {
          if (d.data.organization) {
            setHasOrg(true);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (field: string, value: string | boolean) => setForm((p) => ({ ...p, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/bidder/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSuccess(true);
      setTimeout(() => { window.location.href = redirect; }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const input = "w-full px-3 py-2.5 border border-white/12 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const label = "block text-sm font-medium text-[#d6d6d7] mb-1";

  if (loading) {
    return (
      <div className="min-h-screen bg-white/[0.03] flex items-center justify-center">
        <div className="text-sm text-[#a1a1a6] animate-pulse">Loading...</div>
      </div>
    );
  }

  if (hasOrg) {
    return (
      <div className="min-h-screen bg-white/[0.03] flex items-center justify-center px-4">
        <div className="bg-[#161617] border border-white/10 rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
          <CheckCircle2 className="w-12 h-12 text-[#30d158] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Organization Already Set Up</h2>
          <p className="text-sm text-[#a1a1a6] mb-6">Your organization profile is already complete. You can start bidding on tenders.</p>
          <a href={redirect} className="inline-flex items-center gap-2 bg-[#0071e3] text-white font-medium px-6 py-3 rounded-lg hover:bg-[#2997ff] text-sm">
            Continue to Dashboard →
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white/[0.03] flex items-center justify-center px-4">
        <div className="bg-[#161617] border border-white/10 rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-[#30d158]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#30d158]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Profile Created!</h2>
          <p className="text-sm text-[#a1a1a6] mb-6">Your organization profile has been saved. Redirecting you to continue your bid...</p>
          <div className="flex items-center justify-center gap-2 text-sm text-[#86868b]">
            <Loader2 className="w-4 h-4 animate-spin" /> Redirecting...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white/[0.03] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={redirect} className="text-sm text-[#86868b] hover:text-[#c7c7cc] flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#0071e3] rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Complete Your Organization Profile</h1>
              <p className="text-sm text-[#a1a1a6] mt-1">Required to submit bids on government tenders</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-[#2997ff]/12 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#2997ff] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Why do we need this?</p>
              <p className="text-xs text-[#64b5ff] mt-1">
                Government procurement requires verified organization details for compliance. Your GST, PAN, and Udyam numbers will be verified against government databases before bid submission.
              </p>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 bg-[#ff453a]/10 border border-[#ff453a]/30 text-[#ff6961] text-sm rounded-lg px-4 py-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Organization Details */}
          <div className="bg-[#161617] border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2997ff]" /> Organization Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={label}>Legal Name *</label>
                <input className={input} required value={form.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="e.g., ABC Industries Pvt. Ltd." />
              </div>
              <div>
                <label className={label}>Trade / Brand Name</label>
                <input className={input} value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className={label}>Phone *</label>
                <input className={input} required value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Registered Address *</label>
                <input className={input} required value={form.registeredAddress} onChange={(e) => set("registeredAddress", e.target.value)} placeholder="Full registered address" />
              </div>
              <div>
                <label className={label}>State</label>
                <input className={input} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g., Maharashtra" />
              </div>
              <div>
                <label className={label}>City</label>
                <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g., Mumbai" />
              </div>
            </div>
          </div>

          {/* Tax & Registration */}
          <div className="bg-[#161617] border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4">Tax & Registration Numbers</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>PAN *</label>
                <input className={input} required value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
              </div>
              <div>
                <label className={label}>GSTIN *</label>
                <input className={input} required value={form.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
              </div>
              <div>
                <label className={label}>Udyam / MSME Number</label>
                <input className={input} value={form.udyamNumber} onChange={(e) => set("udyamNumber", e.target.value.toUpperCase())} placeholder="UDYAM-MH-01-0012345" />
              </div>
              <div>
                <label className={label}>Organization Type</label>
                <select className={input} value={form.organizationType} onChange={(e) => set("organizationType", e.target.value)}>
                  <option value="PRIVATE_LIMITED">Private Limited</option>
                  <option value="PUBLIC_LIMITED">Public Limited</option>
                  <option value="LLP">LLP</option>
                  <option value="PROPRIETORSHIP">Proprietorship</option>
                  <option value="PARTNERSHIP">Partnership</option>
                </select>
              </div>
              <div>
                <label className={label}>Business Category</label>
                <select className={input} value={form.businessCategory} onChange={(e) => set("businessCategory", e.target.value)}>
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="TRADER">Trader</option>
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                  <option value="CONSULTANT">Consultant</option>
                </select>
              </div>
            </div>
            <div className="flex gap-6 mt-4">
              <label className="flex items-center gap-2 text-sm text-[#d6d6d7]">
                <input type="checkbox" checked={form.isMsme} onChange={(e) => set("isMsme", e.target.checked)} className="rounded" />
                MSME Registered
              </label>
              <label className="flex items-center gap-2 text-sm text-[#d6d6d7]">
                <input type="checkbox" checked={form.isStartup} onChange={(e) => set("isStartup", e.target.checked)} className="rounded" />
                Startup (DPIIT)
              </label>
              <label className="flex items-center gap-2 text-sm text-[#d6d6d7]">
                <input type="checkbox" checked={form.isOem} onChange={(e) => set("isOem", e.target.checked)} className="rounded" />
                OEM
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-[#0071e3] text-white font-medium py-3 rounded-lg hover:bg-[#2997ff] text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Organization Profile & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
