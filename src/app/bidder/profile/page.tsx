"use client";
import { useEffect, useState } from "react";
import { Building2, Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { refreshSession } from "@/lib/session";

interface OrgForm {
  legalName: string; tradeName: string; phone: string;
  pan: string; gstin: string; udyamNumber: string; cin: string;
  registeredAddress: string; state: string; city: string; pincode: string;
  organizationType: string; businessCategory: string;
  annualTurnoverLakh: string; incorporationDate: string;
  isMsme: boolean; isStartup: boolean; isOem: boolean;
}

const EMPTY: OrgForm = {
  legalName: "", tradeName: "", phone: "", pan: "", gstin: "", udyamNumber: "",
  cin: "", registeredAddress: "", state: "", city: "", pincode: "",
  organizationType: "", businessCategory: "", annualTurnoverLakh: "",
  incorporationDate: "", isMsme: false, isStartup: false, isOem: false,
};

export default function BidderProfilePage() {
  const [form, setForm] = useState<OrgForm>(EMPTY);
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/bidder/organization").then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
    ]).then(([org, me]) => {
      if (me.ok && me.data) setAccount({ name: me.data.name, email: me.data.email });
      if (org.ok) {
        if (org.data.organization) {
          const o = org.data.organization;
          setForm({
            ...EMPTY,
            ...o,
            annualTurnoverLakh: o.annualTurnoverLakh != null ? String(o.annualTurnoverLakh) : "",
          });
        }
        setMissing(org.data.missingFields ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function set<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/bidder/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          annualTurnoverLakh: form.annualTurnoverLakh ? parseFloat(form.annualTurnoverLakh) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSaved(true);
      // Re-check completeness + refresh cached session so dashboard banner clears.
      const re = await fetch("/api/bidder/organization").then(r => r.json());
      if (re.ok) setMissing(re.data.missingFields ?? []);
      void refreshSession();
      setTimeout(() => setSaved(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:outline-none transition-colors";
  const label = "block text-[12px] font-medium text-[var(--foreground-secondary)] mb-1.5";

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>;

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Organization Profile</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">Used for every bid submission and compliance verification. You can edit and save anytime.</p>
        </div>
        {missing.length === 0 ? (
          <span className="badge badge-green shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Complete</span>
        ) : (
          <span className="badge badge-yellow shrink-0"><AlertTriangle className="w-3 h-3 mr-1" /> {missing.length} field{missing.length > 1 ? "s" : ""} missing</span>
        )}
      </div>

      {missing.length > 0 && (
        <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-xl p-4">
          <p className="text-sm text-[var(--warning)] font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Complete these to unlock full compliance scoring:
          </p>
          <p className="text-xs text-[var(--warning)]/80 mt-1">{missing.join(" · ")}</p>
        </div>
      )}

      {saved && (
        <div className="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
          <span className="text-sm text-[var(--success)] font-medium">Profile saved successfully.</span>
        </div>
      )}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4 text-sm text-[var(--danger)]">{error}</div>
      )}

      {/* Account (read-only) */}
      <section className="card-flat p-6">
        <h2 className="headline !text-[17px] mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-[var(--accent)]" /> Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[["Name", account?.name], ["Email", account?.email]].map(([l, v]) => (
            <div key={l as string} className="bg-[var(--surface-2)] rounded-lg p-3">
              <div className="text-xs text-[var(--foreground-tertiary)]">{l}</div>
              <div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{v || "—"}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Organization identity */}
      <section className="card-flat p-6 space-y-4">
        <h2 className="headline !text-[17px]">Identity & Registration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Legal Name *</label><input required className={input} value={form.legalName} onChange={e => set("legalName", e.target.value)} placeholder="As per incorporation documents" /></div>
          <div><label className={label}>Trade Name</label><input className={input} value={form.tradeName} onChange={e => set("tradeName", e.target.value)} /></div>
          <div><label className={label}>PAN *</label><input className={input} maxLength={10} value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></div>
          <div><label className={label}>GSTIN *</label><input className={input} maxLength={15} value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" /></div>
          <div><label className={label}>Udyam Number</label><input className={input} value={form.udyamNumber} onChange={e => set("udyamNumber", e.target.value.toUpperCase())} placeholder="UDYAM-MH-00-0000000" /></div>
          <div><label className={label}>CIN</label><input className={input} maxLength={21} value={form.cin} onChange={e => set("cin", e.target.value.toUpperCase())} /></div>
          <div><label className={label}>Organization Type</label>
            <select className={`${input} cursor-pointer`} value={form.organizationType} onChange={e => set("organizationType", e.target.value)}>
              <option value="">Select…</option>
              {["PRIVATE_LIMITED", "PUBLIC_LIMITED", "LLP", "PROPRIETORSHIP", "PARTNERSHIP"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><label className={label}>Business Category</label>
            <select className={`${input} cursor-pointer`} value={form.businessCategory} onChange={e => set("businessCategory", e.target.value)}>
              <option value="">Select…</option>
              {["MANUFACTURER", "TRADER", "SERVICE_PROVIDER", "CONSULTANT"].map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          {([["isMsme", "MSME registered"], ["isStartup", "DPIIT Startup"], ["isOem", "Original Equipment Manufacturer"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)] cursor-pointer">
              <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} className="accent-[var(--accent)] w-4 h-4" />
              {l}
            </label>
          ))}
        </div>
      </section>

      {/* Address */}
      <section className="card-flat p-6 space-y-4">
        <h2 className="headline !text-[17px]">Registered Address</h2>
        <div><label className={label}>Address *</label><textarea rows={2} className={input} value={form.registeredAddress} onChange={e => set("registeredAddress", e.target.value)} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={label}>State *</label><input className={input} value={form.state} onChange={e => set("state", e.target.value)} /></div>
          <div><label className={label}>City *</label><input className={input} value={form.city} onChange={e => set("city", e.target.value)} /></div>
          <div><label className={label}>PIN Code</label><input className={input} maxLength={6} value={form.pincode} onChange={e => set("pincode", e.target.value.replace(/\D/g, ""))} /></div>
        </div>
      </section>

      {/* Financial */}
      <section className="card-flat p-6 space-y-4">
        <h2 className="headline !text-[17px]">Financials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Annual Turnover (₹ Lakh)</label><input type="number" min={0} className={input} value={form.annualTurnoverLakh} onChange={e => set("annualTurnoverLakh", e.target.value)} /></div>
          <div><label className={label}>Incorporation Date</label><input type="date" className={input} value={form.incorporationDate} onChange={e => set("incorporationDate", e.target.value)} /></div>
        </div>
        <div><label className={label}>Phone *</label><input className={input} maxLength={15} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" /></div>
      </section>

      <button type="submit" disabled={saving} className="btn-apple disabled:opacity-50 cursor-pointer">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
