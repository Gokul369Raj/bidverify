"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Suspense, lazy } from "react";
import SiteNav from "@/components/SiteNav";
import HeroImage from "@/components/HeroImage";
import { Logo } from "@/components/Logo";
import { useSession } from "@/lib/useSession";
import {
  ArrowRight, Shield, FileText, CheckCircle, BarChart3,
  AlertTriangle, Users, ChevronDown,
} from "lucide-react";

const ChatBot = lazy(() => import("@/components/ChatBot"));
const LoginModal = lazy(() => import("@/components/LoginModal"));

interface PlatformStats {
  totalTenders: number; activeTenders: number; registeredBidders: number;
  totalBids: number; totalRequirements: number;
}

const FEATURES = [
  { icon: Shield, title: "Multi-Portal Verification", desc: "Automated cross-verification against GSTN, PAN, Udyam, EPFO, ESIC, MCA21 and other government databases." },
  { icon: FileText, title: "AI Document Intelligence", desc: "OCR extraction and classification from GST certificates, PAN cards, Udyam registrations, OEM authorizations." },
  { icon: CheckCircle, title: "Automated Compliance Engine", desc: "Tender-specific eligibility checks with deterministic rule evaluation — AI assists, officers decide." },
  { icon: BarChart3, title: "Risk & Compliance Scoring", desc: "Overall compliance score with bidder risk classification and verification coverage." },
  { icon: AlertTriangle, title: "AI Recommendation Engine", desc: "Identifies gaps, discrepancies, missing documents and recommends compliance status to officers." },
  { icon: Users, title: "Audit Trail & Dashboard", desc: "Centralized verification status, evidence documentation, and complete traceability of every decision." },
];

export default function LandingPage() {
  const { user: loggedInUser, loading: authLoading } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/public/stats").then(r => r.json()).then(d => { if (d.ok) setStats(d.data); }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ── Frosted navigation ── */}
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* ── Hero — fullscreen image, text above ── */}
      <section className="relative h-screen flex items-center overflow-hidden">
        <HeroImage />
        <div className="relative z-10 max-w-[1024px] mx-auto px-6 w-full text-center">
          <h1 className="display-1 mb-5 !text-white !font-extrabold !text-[clamp(36px,6vw,64px)] text-shadow-hero">
            {!authLoading && loggedInUser ? (
              <>Welcome back,<br /><span className="text-[#60a5fa]">{loggedInUser.name.split(" ")[0]}.</span></>
            ) : (
              <>Bid compliance.<br /><span className="text-[#60a5fa]">Verified in minutes.</span></>
            )}
          </h1>
          <p className="subhead max-w-2xl mx-auto !text-white/80 text-lg md:text-xl mb-9 text-shadow-hero">
            Automated verification of bidder eligibility across GSTN, PAN, Udyam,
            EPFO, ESIC and 14+ government portals — with evidence-backed scoring
            that keeps the final decision with your officers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!authLoading && loggedInUser ? (
              <>
                <Link href={loggedInUser.role === "BIDDER" ? "/bidder" : "/officer"} className="btn-primary !bg-white !text-gray-900 hover:!bg-white/90">
                  Go to Dashboard
                </Link>
                <Link href="/tenders" className="text-white/80 hover:text-white text-base inline-flex items-center gap-1 transition-colors">
                  Explore tenders <ChevronDown className="w-4 h-4 -rotate-90" />
                </Link>
              </>
            ) : (
              <>
                <button onClick={() => setShowLogin(true)} className="btn-primary !px-10 !py-3.5 !text-[16px] cursor-pointer shadow-[0_8px_30px_rgba(0,113,227,0.45)]">
                  Get Started Free
                </button>
                <Link href="/tenders" className="text-white/80 hover:text-white text-base inline-flex items-center gap-1 transition-colors">
                  Browse tenders <ChevronDown className="w-4 h-4 -rotate-90" />
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <ChevronDown className="w-5 h-5 text-white/60 animate-bounce" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="bg-[var(--surface)] border-y border-[var(--border)]">
        <div className="max-w-[1024px] mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {[
              { label: "Active Tenders", value: stats?.activeTenders ?? "—" },
              { label: "Registered Bidders", value: stats?.registeredBidders ?? "—" },
              { label: "Total Bids", value: stats?.totalBids ?? "—" },
              { label: "Portal Integrations", value: "14+" },
            ].map(s => (
              <div key={s.label}>
                <div className="display-3 !text-[32px] md:!text-[44px] !font-bold text-[var(--accent)]">{s.value}</div>
                <div className="caption mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Visual band — where verification happens ── */}
      <section aria-label="Sectors served" className="grid grid-cols-3 gap-px bg-[var(--border)]">
        {[
          { src: "https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Industrial manufacturing plant", label: "Manufacturing" },
          { src: "https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Government office building", label: "Public Infrastructure" },
          { src: "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Technology corridor", label: "Technology & Energy" },
        ].map(img => (
          <figure key={img.label} className="relative aspect-[4/3] overflow-hidden group m-0">
            <Image
              src={img.src}
              alt={img.alt}
              width={800}
              height={600}
              sizes="(max-width: 768px) 33vw, 380px"
              loading="lazy"
              className="w-full h-full object-cover opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
            />
            <figcaption className="absolute bottom-3 left-4 text-xs font-medium text-[var(--foreground)] drop-shadow-lg tracking-wide">{img.label}</figcaption>
          </figure>
        ))}
      </section>

      {/* ── How It Works ── */}
      <section id="features" className="py-20 bg-[var(--surface)] border-b border-[var(--border)] scroll-mt-16">
        <div className="max-w-[1024px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-2">How it works.</h2>
            <p className="subhead mt-2">From upload to officer decision — fully automated.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { step: "01", title: "Register", desc: "Create an account with PAN, GST and Udyam details.", gradient: "from-blue-900/20 to-transparent" },
              { step: "02", title: "Upload", desc: "GST, PAN, Udyam certificates via AI-powered OCR.", gradient: "from-indigo-900/20 to-transparent" },
              { step: "03", title: "Verify", desc: "Cross-checked against 14+ government portals automatically.", gradient: "from-violet-900/20 to-transparent" },
              { step: "04", title: "Decide", desc: "Officers review compliance score, risk level and evidence.", gradient: "from-purple-900/20 to-transparent" },
            ].map((s, i) => (
              <div key={s.step} className={`card-flat p-6 relative hover:-translate-y-1 transition-transform duration-300 bg-gradient-to-b ${s.gradient}`}>
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white font-semibold text-sm mb-4">
                  {s.step.replace("0", "")}
                </div>
                <h3 className="headline !text-[19px] mb-1.5">{s.title}</h3>
                <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{s.desc}</p>
                {i < 3 && <div className="hidden md:block absolute top-12 -right-3 w-6 h-px bg-[var(--border)]" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Integrations ── */}
      <section id="compliance" className="py-20 scroll-mt-16">
        <div className="max-w-[1024px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-2">Integrated with government.</h2>
            <p className="subhead mt-2">Automated verification against official databases.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "GSTN", desc: "GST Registration & Returns", accent: "bg-emerald-900/30 text-emerald-400" },
              { name: "PAN / NSDL", desc: "PAN Verification", accent: "bg-blue-900/30 text-blue-400" },
              { name: "Udyam", desc: "MSME Registration", accent: "bg-orange-900/30 text-orange-400" },
              { name: "EPFO", desc: "PF Compliance", accent: "bg-indigo-900/30 text-indigo-400" },
              { name: "ESIC", desc: "Insurance Compliance", accent: "bg-pink-900/30 text-pink-400" },
              { name: "MCA21", desc: "Company Filings", accent: "bg-violet-900/30 text-violet-400" },
              { name: "DigiLocker", desc: "Document Verification", accent: "bg-cyan-900/30 text-cyan-400" },
              { name: "Startup India", desc: "DPIIT Recognition", accent: "bg-amber-900/30 text-amber-400" },
            ].map(p => (
              <div key={p.name} className="card-flat p-5 hover:border-[var(--border)] hover:shadow-sm transition-all duration-200 group cursor-default">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${p.accent}`}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-semibold text-[16px] group-hover:text-[var(--accent)] transition-colors">{p.name}</span>
                </div>
                <p className="text-[13px] text-[var(--foreground-tertiary)]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-[var(--surface)] border-y border-[var(--border)]">
        <div className="max-w-[1024px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-2">Platform capabilities.</h2>
            <p className="subhead mt-2">AI-powered decision support for procurement officers.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="card-flat p-7 hover:-translate-y-1 hover:border-[var(--border)] hover:bg-[var(--surface-2)] transition-all duration-300 cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mb-5 group-hover:bg-[var(--accent-light)] transition-colors">
                  <f.icon className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.75} />
                </div>
                <h3 className="headline !text-[19px] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      {!authLoading && !loggedInUser && (
        <section className="py-24 border-t border-[var(--border)] bg-gradient-to-br from-[var(--accent)] via-[#3b82f6] to-[#6366f1] text-white">
          <div className="max-w-[720px] mx-auto px-6 text-center">
            <h2 className="display-2 !text-[36px] mb-3 !text-white">Ready to bid with confidence?</h2>
            <p className="subhead mb-8 !text-white/80">Explore live tenders or create your bidder account in minutes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/tenders" className="inline-flex items-center justify-center gap-2 bg-white text-[var(--accent)] font-semibold px-8 py-3.5 rounded-xl text-[15px] hover:bg-white/90 transition-colors shadow-lg">
                Explore Tenders <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => setShowLogin(true)} className="inline-flex items-center justify-center gap-2 text-white font-semibold px-8 py-3.5 rounded-xl text-[15px] border border-white/30 hover:bg-white/10 transition-colors cursor-pointer">
                Create an account
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-[1024px] mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 pb-8">
            <div>
              <Logo />
              <p className="text-xs text-[var(--foreground-tertiary)] mt-3 leading-relaxed max-w-[240px]">AI-Powered Bid Compliance Verification Platform for Government e-Marketplace (GeM) procurement.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--foreground)] mb-3">Explore</h4>
              <div className="space-y-2">
                <Link href="/tenders" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">Active Tenders</Link>
                <a href="/how-it-works" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">How It Works</a>
                <a href="/compliance" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">Compliance</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--foreground)] mb-3">For Bidders</h4>
              <div className="space-y-2">
                <Link href="/register" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">Register</Link>
                <Link href="/tenders" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">Browse Tenders</Link>
                <a href="/how-it-works" className="block text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:underline">Compliance Guide</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--foreground)] mb-3">Contact</h4>
              <div className="space-y-2 text-xs text-[var(--foreground-secondary)]">
                <p>Helpline: 1800-11-0031</p>
                <p>Email: support@absar.gov.in</p>
                <p>Mon–Sat: 9:00 AM – 6:00 PM</p>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--border)] pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="caption">© 2026 BIDGUARD AI — AI-Powered Bid Compliance Platform.</div>
            <div className="flex items-center gap-5 caption divide-x divide-[var(--border)]">
              <a href="#" className="hover:underline pr-5">Terms of Use</a>
              <a href="#" className="hover:underline pr-5">Privacy Policy</a>
              <a href="#" className="hover:underline">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <ChatBot context="landing" />
      </Suspense>
    </div>
  );
}
