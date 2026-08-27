"use client";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { Logo } from "@/components/Logo";
import { ArrowLeft, ArrowRight } from "lucide-react";

const IMPACT = [
  { value: "60–80%", label: "Reduction in verification effort" },
  { value: "14+", label: "Government portal integrations" },
  { value: "100%", label: "Audit trail on every decision" },
  { value: "24/7", label: "Automated verification" },
];

const PRINCIPLES = [
  {
    title: "Evidence-first",
    desc: "Every conclusion traces to evidence — document forensics, QR payloads, registry responses, cross-document consistency. If the evidence stops, the claim stops.",
  },
  {
    title: "AI assists, officers decide",
    desc: "The system produces explainable recommendations with coverage and confidence — but qualification and disqualification always remain with the procurement officer.",
  },
  {
    title: "Honest about unknowns",
    desc: "When an official source is unavailable or evidence conflicts, the system says so. Unknown is a first-class result — never silently converted to pass or fail.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteNav onSignIn={() => {}} />

      {/* Fullscreen opening */}
      <section className="relative h-[70vh] flex items-center overflow-hidden border-b border-[var(--border)]">
        <Image
          src="https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=2400"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--background)]/50 via-transparent to-[var(--background)]" />
        <div className="relative z-10 max-w-[1100px] mx-auto px-6 w-full">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="display-1 !text-[clamp(36px,6vw,72px)]">
            Procurement,<br />built on <span className="text-gradient-blue">trust.</span>
          </h1>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <p className="display-3 !text-[26px] md:!text-[34px] !leading-snug max-w-3xl">
          BIDGUARD AI is an AI-powered bid compliance verification platform for
          Government e-Marketplace procurement. It replaces weeks of manual
          certificate checking with layered, evidence-based verification —
          while keeping every final decision in human hands.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mt-14">
          {PRINCIPLES.map(p => (
            <div key={p.title} className="card-flat p-7">
              <h2 className="headline !text-[19px] mb-3">{p.title}</h2>
              <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section aria-label="Expected impact" className="bg-[var(--surface-2)] border-y border-[var(--border-light)] py-16">
        <div className="max-w-[1024px] mx-auto px-6">
          <h2 className="display-3 mb-8">Expected impact.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
            {IMPACT.map(s => (
              <div key={s.label}>
                <div className="display-3 !text-[30px] md:!text-[42px]">{s.value}</div>
                <div className="text-xs text-[var(--foreground-tertiary)] mt-1 max-w-[160px] mx-auto leading-relaxed">{s.label}</div>
              </div>
            ))}
          </div>
          <ul className="max-w-3xl mx-auto space-y-3">
            {[
              "Faster tender evaluation and award cycles",
              "Improved compliance and transparency",
              "Reduced human errors and inconsistencies",
              "Better bidder screening and risk identification",
              "Standardized verification across CPSEs",
            ].map(item => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] text-[var(--foreground-secondary)] card-flat !rounded-xl px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Built for */}
      <section className="max-w-[1100px] mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="display-3 mb-4">Built for the entire procurement chain.</h2>
          <p className="subhead !text-[17px] leading-relaxed">
            Bidders get instant feedback on exactly what to fix. Evaluation
            officers get explainable evidence instead of stacks of paper.
            Auditors get a complete, append-only trail of every check,
            override and decision.
          </p>
          <Link href="/tenders" className="btn-primary mt-7 inline-flex">
            Explore Tenders <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="relative rounded-[28px] overflow-hidden border border-[var(--border)] aspect-[4/3]">
          <Image
            src="https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Professional reviewing infrastructure plans"
            width={1200}
            height={900}
            sizes="(max-width: 768px) 100vw, 520px"
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      <footer className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6">
            <Logo />
            <Link href="/tenders" className="btn-secondary !py-2.5 !px-6 !text-sm">Explore Tenders</Link>
          </div>
          <div className="border-t border-[var(--border)] pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="caption">© 2026 BIDGUARD AI — AI-Powered Bid Compliance Platform.</div>
            <Link href="/" className="caption hover:text-[var(--foreground)] transition-colors">Back to home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
