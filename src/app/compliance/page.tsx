"use client";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import GovtFooter from "@/components/GovtFooter";
import { ArrowLeft, CheckCircle, CircleDashed, ShieldAlert } from "lucide-react";

const PORTALS = [
  { name: "GSTN", desc: "GST registration status, legal/trade name match and return-filing regularity.", method: "Authorized API · QR cross-check · Document structure" },
  { name: "PAN / NSDL", desc: "PAN existence, holder-class semantics (company, firm, individual) and active status.", method: "Authorized verification service · Structural validation" },
  { name: "Udyam", desc: "MSME registration, enterprise type (Micro/Small/Medium) and dynamic-QR consistency.", method: "Dynamic QR decode · Portal verify facility" },
  { name: "EPFO", desc: "Provident-fund establishment registration and compliance standing where applicable.", method: "Authorized integration point" },
  { name: "ESIC", desc: "Employee State Insurance registration for eligible establishments.", method: "Authorized integration point" },
  { name: "MCA21", desc: "Company master data — CIN, incorporation, status (Active / Strike-off).", method: "Public master data · Document cross-check" },
  { name: "DigiLocker", desc: "Government-issued documents pulled with user consent through the requester flow.", method: "OAuth requester integration" },
  { name: "Startup India", desc: "DPIIT recognition number and validity for startup-preference claims.", method: "Registry lookup" },
];

const LEVELS = [
  { l: "L0", name: "File exists", desc: "The document was received and hashed." },
  { l: "L1", name: "Structurally valid", desc: "PDF/image parses cleanly; no tamper indicators." },
  { l: "L2", name: "Fields extracted", desc: "Key identifiers recovered with confidence scores." },
  { l: "L3", name: "Internally consistent", desc: "Checksums pass; QR matches visible fields." },
  { l: "L4", name: "Cross-document consistent", desc: "Identity agrees across every submitted certificate." },
  { l: "L5", name: "Cryptographic / QR evidence", desc: "Signature detected or QR corroborates content." },
  { l: "L6", name: "Official verification", desc: "An authorized government source confirmed the record." },
  { l: "L7", name: "Tender compliant", desc: "All tender-specific rules evaluated and satisfied." },
];

const TIERS = [
  { tier: "Tier 1", label: "Official live government source", weight: "Highest authority" },
  { tier: "Tier 2", label: "Official circulars & documents", weight: "" },
  { tier: "Tier 3", label: "Official tender / procurement source", weight: "" },
  { tier: "Tier 4", label: "Authorized institutional source", weight: "" },
  { tier: "Tier 5", label: "Secondary source", weight: "Never overrides Tier 1–3" },
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteNav onSignIn={() => {}} />

      <header className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 pt-16 pb-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="display-2">Compliance, done honestly.</h1>
          <p className="subhead mt-3 max-w-2xl">
            Verification is layered. The system always tells you exactly how far
            the evidence goes — and never dresses an unknown as a pass.
          </p>
        </div>
      </header>

      {/* Portals */}
      <section aria-label="Government portals" className="max-w-[1100px] mx-auto px-6 py-16">
        <h2 className="display-3 mb-2">14+ portal integrations.</h2>
        <p className="subhead !text-[17px] mb-8 max-w-2xl">Each registry has a dedicated adapter with explicit capability states — verified, unavailable, or authorization required.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {PORTALS.map(p => (
            <div key={p.name} className="card-flat p-6 hover:border-[var(--border)] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-[18px]">{p.name}</span>
                <CheckCircle className="w-4 h-4 text-[var(--success)]" strokeWidth={2} />
              </div>
              <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{p.desc}</p>
              <p className="text-[11px] text-[var(--foreground-tertiary)] mt-3 font-mono">{p.method}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Verification levels */}
      <section aria-label="Verification levels" className="bg-[var(--surface-2)] border-y border-[var(--border-light)] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <h2 className="display-3 mb-2">Eight levels of evidence.</h2>
          <p className="subhead !text-[17px] mb-8 max-w-2xl">
            &ldquo;Looks valid&rdquo; and &ldquo;officially verified&rdquo; are different states. Every bid
            reports exactly which level its evidence reached.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {LEVELS.map(lv => (
              <div key={lv.l} className="flex gap-4 card-flat p-5">
                <span className="w-11 h-11 rounded-xl bg-[var(--accent-light)] flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">{lv.l}</span>
                <div>
                  <div className="font-medium text-[15px]">{lv.name}</div>
                  <p className="text-[13px] text-[var(--foreground-secondary)] mt-0.5 leading-relaxed">{lv.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Source hierarchy */}
      <section aria-label="Source hierarchy" className="max-w-[1100px] mx-auto px-6 py-16">
        <h2 className="display-3 mb-2">Source hierarchy.</h2>
        <p className="subhead !text-[17px] mb-8 max-w-2xl">
          When evidence conflicts, authority wins — not volume. A government
          registry outranks any secondary claim.
        </p>
        <div className="space-y-2">
          {TIERS.map((t, i) => (
            <div key={t.tier} className={`flex items-center gap-4 rounded-xl p-4 border ${i === 0 ? "border-[var(--accent)]/40 bg-[var(--accent-light)]" : "border-[var(--border)] bg-[var(--surface-2)]"}`}>
              <ShieldAlert className={`w-4 h-4 shrink-0 ${i === 0 ? "text-[var(--accent)]" : "text-[var(--foreground-tertiary)]"}`} strokeWidth={1.75} />
              <span className="font-mono text-xs font-semibold w-16 shrink-0">{t.tier}</span>
              <span className="text-sm flex-1">{t.label}</span>
              {t.weight && <span className="badge badge-blue hidden sm:inline-flex">{t.weight}</span>}
            </div>
          ))}
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-4">
          <div className="card-flat p-5"><CheckCircle className="w-5 h-5 text-[var(--success)] mb-3" strokeWidth={1.75} /><div className="font-medium text-sm">Verified</div><p className="text-xs text-[var(--foreground-secondary)] mt-1">Authoritative source confirmed the claim.</p></div>
          <div className="card-flat p-5"><CircleDashed className="w-5 h-5 text-[var(--warning)] mb-3" strokeWidth={1.75} /><div className="font-medium text-sm">Provisionally verified</div><p className="text-xs text-[var(--foreground-secondary)] mt-1">Strong documentary + forensic evidence; official source unavailable.</p></div>
          <div className="card-flat p-5"><ShieldAlert className="w-5 h-5 text-[var(--danger)] mb-3" strokeWidth={1.75} /><div className="font-medium text-sm">Conflicting evidence</div><p className="text-xs text-[var(--foreground-secondary)] mt-1">Sources disagree — officer resolution required before qualification.</p></div>
        </div>

        <div className="mt-12 flex items-center justify-between flex-wrap gap-3 rounded-2xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--foreground-secondary)]">See the coverage matrix live on any verified bid.</p>
          <Link href="/tenders" className="btn-primary !py-2 !px-5 !text-sm">Explore Tenders</Link>
        </div>
      </section>

      <GovtFooter />
    </div>
  );
}
