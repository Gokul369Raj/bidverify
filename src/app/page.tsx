"use client";
import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { useSession } from "@/lib/useSession";
import {
  ArrowRight, Shield, FileText, CheckCircle, BarChart3,
  Upload, Search, Zap, Lock, Award, Building2, Globe,
  ChevronRight, Check, Star, TrendingUp, Clock,
} from "lucide-react";

const ChatBot = lazy(() => import("@/components/ChatBot"));
const LoginModal = lazy(() => import("@/components/LoginModal"));

interface PlatformStats { totalTenders: number; activeTenders: number; registeredBidders: number; totalBids: number; totalRequirements: number; }

const FEATURES = [
  { icon: Lock, title: "Entity Locker", badge: "NEW", desc: "Securely store, manage and reuse your verified business documents across multiple tenders.", cta: "Open Entity Locker", href: "/bidder/documents", color: "orange" },
  { icon: Search, title: "Verify a Bid", badge: null, desc: "Check eligibility, technical and financial compliance for any tender.", cta: "Start Verification", href: "/bidder/applications", color: "blue" },
  { icon: Award, title: "Compliance Passport", badge: null, desc: "Your verified compliance profile for faster participation.", cta: "View Passport", href: "/bidder", color: "green" },
  { icon: BarChart3, title: "Tender Insights", badge: null, desc: "Get AI-powered insights, risk analysis and gap identification before you submit.", cta: "Explore Insights", href: "/bidder/bids", color: "amber" },
];

const PORTALS = [
  { name: "GeM", color: "#1a5276", bg: "#eaf2f8" },
  { name: "GSTN", color: "#117a65", bg: "#e8f6f3" },
  { name: "Udyam", color: "#6c3483", bg: "#f4ecf7" },
  { name: "Income Tax", color: "#b9770e", bg: "#fef9e7" },
  { name: "PAN", color: "#2e86c1", bg: "#ebf5fb" },
  { name: "EPFO", color: "#e74c3c", bg: "#fdedec" },
  { name: "ESIC", color: "#27ae60", bg: "#eafaf1" },
  { name: "Startup India", color: "#2980b9", bg: "#ebf5fb" },
  { name: "DigiLocker", color: "#8e44ad", bg: "#f5eef8" },
  { name: "MCA21", color: "#16a085", bg: "#e8f8f5" },
  { name: "Make in India", color: "#2c3e50", bg: "#ebedef" },
  { name: "NSIC", color: "#d35400", bg: "#fbeee6" },
];

const STEPS = [
  { num: "1", title: "Register", desc: "Create your bidder or officer account" },
  { num: "2", title: "Upload", desc: "Submit tender & supporting documents" },
  { num: "3", title: "AI Verifies", desc: "Extracts, checks and matches requirements" },
  { num: "4", title: "Get Results", desc: "View compliance status, issues and recommendations" },
];

export default function LandingPage() {
  const { user: loggedInUser } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/public/stats").then(r => r.json()).then(d => { if (d.ok) setStats(d.data); }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* ═══════ HERO — White background, dark text, building illustration ═══════ */}
      <section className="relative bg-gradient-to-br from-gray-50 via-white to-blue-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  AI-Powered • Transparent • Compliant
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-[56px] font-extrabold leading-[1.08] mb-6 tracking-tight text-[var(--navy)]">
                Smarter Compliance for a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
                  Stronger India
                </span>
              </h1>
              <p className="text-lg text-gray-500 mb-8 max-w-lg leading-relaxed">
                Bidguard AI helps verify, analyze and simplify bid compliance for Government Procurement — from document submission to decision support.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link href="/register" className="btn-navy">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="btn-outline-dark">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
                  Watch Demo
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Trusted & Secure</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /> Faster Evaluation</span>
                <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Evidence-Backed Decisions</span>
              </div>
            </div>

            {/* Right — Building illustration + workflow */}
            <div className="relative hidden lg:block">
              {/* Building SVG illustration */}
              <div className="absolute -top-8 -right-4 w-[420px] h-[340px] opacity-20">
                <svg viewBox="0 0 420 340" fill="none" className="w-full h-full">
                  <rect x="80" y="60" width="260" height="260" rx="8" fill="#0B1D3A" opacity="0.15"/>
                  <rect x="100" y="80" width="220" height="30" rx="4" fill="#0B1D3A" opacity="0.2"/>
                  <rect x="120" y="120" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="190" y="120" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="260" y="120" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="120" y="185" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="190" y="185" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="260" y="185" width="40" height="50" rx="2" fill="#0B1D3A" opacity="0.1"/>
                  <rect x="170" y="250" width="80" height="70" rx="4" fill="#0B1D3A" opacity="0.15"/>
                  <path d="M80 60 L210 10 L340 60" stroke="#0B1D3A" strokeWidth="3" opacity="0.2"/>
                  <circle cx="210" cy="15" r="8" fill="#0B1D3A" opacity="0.2"/>
                </svg>
              </div>

              {/* Workflow card */}
              <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 p-7 mb-5 z-10">
                <h3 className="text-sm font-bold text-gray-400 mb-5 uppercase tracking-wider">From Documents to Decisions</h3>
                <div className="flex items-center justify-between gap-1">
                  {["Upload", "Verify (AI)", "Ensure\nCompliance", "Decision\nSupport"].map((step, i) => (
                    <div key={step} className="flex items-center gap-1">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${i === 1 ? "bg-orange-50 border-2 border-orange-200" : "bg-gray-50 border border-gray-200"}`}>
                          {i === 0 && <Upload className="w-5 h-5 text-gray-500" />}
                          {i === 1 && <Zap className="w-5 h-5 text-[var(--saffron)]" />}
                          {i === 2 && <Shield className="w-5 h-5 text-green-500" />}
                          {i === 3 && <CheckCircle className="w-5 h-5 text-gray-500" />}
                        </div>
                        <span className="text-[11px] text-gray-400 text-center whitespace-pre-line leading-tight">{step}</span>
                      </div>
                      {i < 3 && <ChevronRight className="w-4 h-4 text-gray-300 mt-[-18px]" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Transparent Procurement text */}
              <div className="absolute -top-2 right-0 text-right z-20">
                <p className="text-sm font-bold text-[var(--navy)] italic leading-tight">Transparent<br/>Procurement<br/><span className="text-[var(--saffron)]">A Stronger India</span></p>
              </div>

              {/* Trusted by Government */}
              <div className="relative bg-white rounded-xl shadow-lg border border-gray-100 p-5 z-10">
                <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Trusted by Government Ecosystem</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-7 h-7 text-[var(--navy)]" />
                    <div>
                      <p className="text-sm font-bold text-[var(--navy)]">GeM</p>
                      <p className="text-[10px] text-gray-400">Government e-Marketplace</p>
                    </div>
                  </div>
                  <span className="text-gray-200">|</span>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500">Also supports</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                      <span className="font-medium">GSTN</span> • <span className="font-medium">Udyam</span> • <span className="font-medium">Income Tax</span> • <span className="font-medium">UAM</span> • + More
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ GOVERNMENT PORTALS — Badge style ═══════ */}
      <section className="bg-white border-y border-gray-100 py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-4">
            Integrated with Government Portals — Real-time verification. Trusted data sources.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PORTALS.map(p => (
              <span key={p.name} className="portal-badge" style={{ color: p.color, background: p.bg, borderColor: `${p.color}20` }}>
                <Globe className="w-3.5 h-3.5" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURE CARDS — Colored left borders ═══════ */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <Link key={f.title} href={f.href}
                className={`card-feature group card-feature-${f.color}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-lighter)] flex items-center justify-center">
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  {f.badge && <span className="badge-new">{f.badge}</span>}
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{f.desc}</p>
                <span className="text-sm font-semibold text-[var(--saffron)] flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                  {f.cta} <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-14">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-[var(--navy)] mb-3">How It Works</h2>
              <p className="text-gray-500">A simple, end-to-end process for compliant procurement</p>
            </div>
            <Link href="/bidder" className="hidden md:inline-flex btn-navy text-sm">
              See Detailed Process <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 3 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-gray-200 to-transparent" />}
                <div className="w-16 h-16 rounded-full bg-[var(--navy)] flex items-center justify-center mx-auto mb-5 relative z-10 shadow-lg shadow-navy/20">
                  <span className="text-xl font-bold text-white">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold text-[var(--navy)] mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FOR OFFICERS / FOR BIDDERS ═══════ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Officers */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-[var(--navy)] px-8 py-6">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">For Procurement Officers</p>
                <h3 className="text-2xl font-bold text-white">Faster, Evidence-Driven Evaluation</h3>
              </div>
              <div className="p-8">
                <ul className="space-y-3 mb-8">
                  {["Machine-readable tender requirements", "Automated document verification", "Cross-source government checks", "Risk & anomaly detection", "Complete audit trail", "Human-in-the-loop decision support"].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/admin" className="btn-navy text-sm">
                  Explore Officer Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Bidders */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-[var(--saffron)] px-8 py-6">
                <p className="text-xs font-semibold text-orange-100 uppercase tracking-wider mb-1">For Bidders</p>
                <h3 className="text-2xl font-bold text-white">Know Your Bid Before You Submit</h3>
              </div>
              <div className="p-8">
                <ul className="space-y-3 mb-8">
                  {["Check eligibility and document readiness", "Identify missing or expired documents", "Validate technical compliance", "Get AI-powered recommendations", "Track your compliance status", "Maintain reusable documents in Entity Locker"].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn-saffron text-sm">
                  Start as a Bidder <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="stat-card">
              <div className="stat-number">60-80%</div>
              <div className="stat-label">Reduction in manual effort (target)</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">30-50%</div>
              <div className="stat-label">Faster tender evaluation (target)</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">Higher</div>
              <div className="stat-label">Transparency & accountability</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">Fairer</div>
              <div className="stat-label">Procurement Ecosystem</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ QUOTE ═══════ */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-start gap-4 max-w-xl">
            <span className="text-5xl text-[var(--saffron)] font-serif leading-none">&ldquo;</span>
            <div>
              <p className="text-lg font-semibold text-[var(--navy)] italic">Technology for Trust. Procurement for a Stronger India.</p>
              <p className="text-sm text-gray-400 mt-2">— Viksit Bharat</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CTA BANNER ═══════ */}
      <section className="relative overflow-hidden">
        <div className="bg-[var(--navy)] py-16">
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-8">
              Together for a Transparent, Efficient<br/>and Inclusive Procurement Ecosystem.
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register" className="btn-saffron">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="btn-outline-white">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
        {/* Saffron accent bar */}
        <div className="h-1 bg-gradient-to-r from-orange-400 via-[var(--saffron)] to-[var(--navy)]" />
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[var(--bg-darker)] text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--saffron)] to-orange-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Bidguard AI</h3>
                  <p className="text-xs text-blue-200/50">Secure Procurement. Stronger India.</p>
                </div>
              </div>
              <p className="text-sm text-blue-200/60 leading-relaxed max-w-sm mb-4">
                AI-Powered Government Bid Compliance Verification Platform. Built for SIH 2026 by Team Anveshak 2.0.
              </p>
              <div className="flex items-center gap-2 text-xs text-blue-200/40">
                <Star className="w-3 h-3 text-amber-400" />
                Smart India Hackathon 2026
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-blue-200/60">
                <li><Link href="/bidder/documents" className="hover:text-white transition-colors">Entity Locker</Link></li>
                <li><Link href="/bidder/applications" className="hover:text-white transition-colors">Bid Verification</Link></li>
                <li><Link href="/bidder" className="hover:text-white transition-colors">Compliance Passport</Link></li>
                <li><Link href="/bidder/bids" className="hover:text-white transition-colors">Tender Insights</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-blue-200/60">
                <li><span className="hover:text-white transition-colors cursor-pointer">About Us</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Careers</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Contact Us</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-blue-200/60">
                <li><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Terms of Use</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Data Governance</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-blue-200/40">&copy; 2026 Bidguard AI. All rights reserved. A step towards Viksit Bharat.</p>
            <div className="flex items-center gap-4 text-xs text-blue-200/40">
              <span>Team Anveshak 2.0</span>
              <span>|</span>
              <span>Smart India Hackathon 2026</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Modals ── */}
      {showLogin && (
        <Suspense fallback={null}>
          <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ChatBot />
      </Suspense>
    </div>
  );
}
