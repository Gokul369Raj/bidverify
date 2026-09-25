"use client";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import GovtFooter from "@/components/GovtFooter";
import { ArrowLeft, FileText, ScanLine, ShieldCheck, Scale } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: FileText,
    title: "Register & Profile",
    time: "~5 minutes",
    you: "Create your bidder account with legal name, PAN, GSTIN and Udyam number. Your organization profile becomes the identity anchor for every future bid.",
    system: "Identifiers are structurally validated at entry — GSTIN checksum, PAN format and Udyam pattern are verified instantly, so typos never reach a bid.",
  },
  {
    num: "02",
    icon: ScanLine,
    title: "Upload Documents",
    time: "Per certificate",
    you: "Upload certificates as PDF or images — scans are fine. Each document is classified automatically (GST, PAN, Udyam, OEM letter…) and key fields are extracted with confidence scores.",
    system: "Document forensics run in parallel: PDF structure analysis, digital-signature detection, QR decoding and duplicate detection against every previously uploaded file.",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Automated Verification",
    time: "Seconds per bid",
    you: "Nothing to do — the platform cross-checks your claims across GSTN, PAN, Udyam, EPFO, ESIC, MCA21, DigiLocker and Startup India registries.",
    system: "Evidence is fused layer by layer: field-level consensus across OCR, QR payloads and text layers; temporal validity at the tender's closing date; cross-document identity consistency.",
  },
  {
    num: "04",
    icon: Scale,
    title: "Officer Decision",
    time: "Same day review",
    you: "Track your compliance score and risk level live. If something is flagged, you'll know exactly which document to fix or re-upload.",
    system: "Officers see an explainable result — evidence chains, coverage matrix and AI findings — and record the final qualification decision. The AI never disqualifies anyone.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteNav onSignIn={() => {}} />

      <header className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 pt-16 pb-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="display-2">How it works.</h1>
          <p className="subhead mt-3 max-w-2xl">
            Four steps from registration to officer decision. Every stage produces
            structured evidence — nothing is verified on appearance alone.
          </p>
        </div>
      </header>

      {/* Pipeline strip */}
      <section aria-label="Verification pipeline" className="border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 overflow-x-auto">
          <div className="flex items-center gap-3 text-xs font-mono whitespace-nowrap min-w-max">
            {["Upload", "AI OCR", "Forensics", "QR Check", "Portal Verification", "Rules Engine", "Risk Score", "Officer"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-lg ${i === arr.length - 1 ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--foreground-secondary)]"}`}>{s}</span>
                {i < arr.length - 1 && <span className="text-[var(--foreground-tertiary)]">→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <main className="max-w-[1100px] mx-auto px-6 py-16 space-y-6">
        {STEPS.map((step, i) => (
          <article key={step.num} className={`card-flat p-8 md:p-10 ${i % 2 === 0 ? "" : ""}`}>
            <div className="grid md:grid-cols-[auto_1fr] gap-7">
              <div className="flex md:flex-col items-center md:items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center text-white font-semibold text-lg shrink-0">
                  {step.num}
                </div>
                <step.icon className="w-6 h-6 text-[var(--accent)] hidden md:block" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="headline !text-[24px]">{step.title}</h2>
                  <span className="badge badge-blue">{step.time}</span>
                </div>
                <div className="grid md:grid-cols-2 gap-6 mt-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--accent)] font-semibold mb-2">You do</div>
                    <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{step.you}</p>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--foreground-tertiary)] font-semibold mb-2">The system does</div>
                    <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{step.system}</p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}

        {/* Visual close */}
        <div className="relative rounded-[28px] overflow-hidden border border-[var(--border)] mt-10">
          <Image
            src="https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg?auto=compress&cs=tinysrgb&w=1600&h=500&fit=crop"
            alt="Industrial operations"
            width={1600}
            height={500}
            sizes="(max-width: 768px) 100vw, 1050px"
            loading="lazy"
            className="w-full h-56 object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/85 to-transparent" />
          <div className="absolute bottom-6 left-7 right-7 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-[var(--foreground)]/90">Every decision traceable to evidence.</p>
            <Link href="/tenders" className="btn-primary !py-2 !px-5 !text-sm">Explore Tenders</Link>
          </div>
        </div>
      </main>

      <GovtFooter />
    </div>
  );
}
