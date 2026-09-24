"use client";
import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { useSession } from "@/lib/useSession";
import {
  ArrowRight, Shield, FileText, CheckCircle, BarChart3,
  Upload, Search, Zap, Lock, Award, Building2, Globe,
  ChevronRight, Check, Star, TrendingUp, Clock, Users,
} from "lucide-react";

const ChatBot = lazy(() => import("@/components/ChatBot"));
const LoginModal = lazy(() => import("@/components/LoginModal"));

interface PlatformStats {
  totalTenders: number;
  activeTenders: number;
  registeredBidders: number;
  totalBids: number;
  totalRequirements: number;
}

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

export default function LandingPage() {
  const { user: loggedInUser } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStats(d.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* ═══════ HERO ═══════ */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white">
        <div className="container section-padding">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-6">
                AI-Powered • Transparent • Compliant
              </span>

              <h1 className="text-4xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight text-[var(--navy)] mb-6">
                Smarter Compliance for a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
                  Stronger India
                </span>
              </h1>

              <p className="text-lg text-gray-500 mb-10 max-w-lg leading-relaxed">
                Bidguard AI helps verify, analyze and simplify bid compliance for
                Government Procurement — from document submission to decision
                support.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link href="/register" className="btn btn-primary">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="btn btn-outline">
                  Watch Demo
                </button>
              </div>

              <div className="flex flex-wrap gap-8 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" /> Trusted &amp; Secure
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" /> Faster Evaluation
                </span>
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" /> Evidence-Backed
                </span>
              </div>
            </div>

            {/* Right — Illustration */}
            <div className="hidden lg:flex flex-col gap-5">
              {/* Building illustration */}
              <div className="relative bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <svg viewBox="0 0 400 200" className="w-full h-auto" fill="none">
                  {/* Building */}
                  <rect x="100" y="40" width="200" height="160" rx="4" fill="#0B1D3A" opacity="0.06" />
                  <rect x="100" y="30" width="200" height="14" rx="3" fill="#0B1D3A" opacity="0.1" />
                  {/* Windows */}
                  {[0, 1, 2].map((col) =>
                    [0, 1, 2, 3].map((row) => (
                      <rect
                        key={`${col}-${row}`}
                        x={130 + col * 60}
                        y={60 + row * 35}
                        width="30"
                        height="20"
                        rx="2"
                        fill={col === 1 && row === 0 ? "#FF6B2B" : "#0B1D3A"}
                        opacity={col === 1 && row === 0 ? 0.2 : 0.08}
                      />
                    ))
                  )}
                  {/* Door */}
                  <rect x="175" y="170" width="50" height="30" rx="3" fill="#0B1D3A" opacity="0.1" />
                  {/* Roof triangle */}
                  <path d="M80 30 L200 5 L320 30" stroke="#0B1D3A" strokeWidth="2" fill="none" opacity="0.12" />
                  {/* Flag */}
                  <line x1="200" y1="5" x2="200" y2="-10" stroke="#0B1D3A" strokeWidth="1.5" opacity="0.15" />
                  <rect x="200" y="-10" width="20" height="12" rx="1" fill="#FF6B2B" opacity="0.2" />
                  {/* Steps */}
                  <rect x="90" y="195" width="220" height="5" rx="2" fill="#0B1D3A" opacity="0.06" />
                  <rect x="80" y="198" width="240" height="5" rx="2" fill="#0B1D3A" opacity="0.04" />
                </svg>
              </div>

              {/* Workflow card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                  From Documents to Decisions
                </p>
                <div className="flex items-center justify-between gap-2">
                  {[
                    { icon: Upload, label: "Upload", highlight: false },
                    { icon: Zap, label: "Verify\n(AI)", highlight: true },
                    { icon: Shield, label: "Ensure\nCompliance", highlight: false },
                    { icon: CheckCircle, label: "Decision\nSupport", highlight: false },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            step.highlight
                              ? "bg-orange-50 border-2 border-orange-200"
                              : "bg-gray-50 border border-gray-200"
                          }`}
                        >
                          <step.icon
                            className={`w-5 h-5 ${
                              step.highlight ? "text-[var(--saffron)]" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 text-center whitespace-pre-line leading-tight">
                          {step.label}
                        </span>
                      </div>
                      {i < 3 && (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 -mt-5" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trusted by */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Trusted by Government Ecosystem
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-6 h-6 text-[var(--navy)]" />
                    <div>
                      <p className="text-sm font-bold text-[var(--navy)]">GeM</p>
                      <p className="text-[10px] text-gray-400">Govt e-Marketplace</p>
                    </div>
                  </div>
                  <span className="text-gray-200">|</span>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">Also:</span>
                    GSTN • Udyam • Income Tax • PAN • EPFO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PORTALS BAR ═══════ */}
      <section className="bg-white border-y border-gray-100 py-6">
        <div className="container">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-center mb-5">
            Integrated with Government Portals — Real-time verification
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PORTALS.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-all hover:shadow-sm"
                style={{
                  color: p.color,
                  background: p.bg,
                  borderColor: `${p.color}15`,
                }}
              >
                <Globe className="w-3 h-3" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="bg-gray-50">
        <div className="container section-padding">
          <div className="text-center mb-14">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle max-w-xl mx-auto">
              Everything you need for compliant government procurement
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: "Entity Locker", badge: "NEW", desc: "Securely store, manage and reuse your verified business documents across multiple tenders.", cta: "Open Locker", href: "/bidder/documents", border: "border-l-4 border-l-[var(--saffron)]" },
              { icon: Search, title: "Verify a Bid", badge: null, desc: "Check eligibility, technical and financial compliance for any tender before submission.", cta: "Start Verification", href: "/bidder/applications", border: "border-l-4 border-l-[var(--blue)]" },
              { icon: Award, title: "Compliance Passport", badge: null, desc: "Your verified compliance profile for faster participation in government tenders.", cta: "View Passport", href: "/bidder", border: "border-l-4 border-l-[var(--green)]" },
              { icon: BarChart3, title: "Tender Insights", badge: null, desc: "Get AI-powered insights, risk analysis and gap identification before you submit.", cta: "Explore Insights", href: "/bidder/bids", border: "border-l-4 border-l-[var(--amber)]" },
            ].map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className={`card group flex flex-col p-6 ${f.border}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-lg bg-[var(--navy)] flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  {f.badge && (
                    <span className="inline-flex items-center bg-[var(--saffron)] text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[var(--navy)] mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5 flex-1">{f.desc}</p>
                <span className="text-sm font-semibold text-[var(--saffron)] flex items-center gap-1 group-hover:gap-2 transition-all">
                  {f.cta} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="bg-white">
        <div className="container section-padding">
          <div className="text-center mb-16">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              A simple, end-to-end process for compliant procurement
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-10 max-w-4xl mx-auto">
            {[
              { num: "1", title: "Register", desc: "Create your bidder or officer account" },
              { num: "2", title: "Upload", desc: "Submit tender and supporting documents" },
              { num: "3", title: "AI Verifies", desc: "Extracts, checks and matches requirements" },
              { num: "4", title: "Get Results", desc: "View compliance status and recommendations" },
            ].map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[55%] w-[90%] h-px bg-gradient-to-r from-gray-200 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-full bg-[var(--navy)] flex items-center justify-center mx-auto mb-5 relative z-10 shadow-lg">
                  <span className="text-xl font-bold text-white">{s.num}</span>
                </div>
                <h3 className="text-base font-bold text-[var(--navy)] mb-1.5">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ OFFICERS / BIDDERS ═══════ */}
      <section className="bg-gray-50">
        <div className="container section-padding">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Officers */}
            <div className="card overflow-hidden">
              <div className="bg-[var(--navy)] px-8 py-7">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-300" />
                  <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-widest">
                    For Procurement Officers
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  Faster, Evidence-Driven Evaluation
                </h3>
              </div>
              <div className="p-8">
                <ul className="space-y-4 mb-8">
                  {[
                    "Machine-readable tender requirements",
                    "Automated document verification",
                    "Cross-source government checks",
                    "Risk and anomaly detection",
                    "Complete audit trail",
                    "Human-in-the-loop decision support",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/admin" className="btn btn-primary text-sm">
                  Explore Officer Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Bidders */}
            <div className="card overflow-hidden">
              <div className="bg-[var(--saffron)] px-8 py-7">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-orange-100" />
                  <p className="text-[11px] font-semibold text-orange-100 uppercase tracking-widest">
                    For Bidders
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  Know Your Bid Before You Submit
                </h3>
              </div>
              <div className="p-8">
                <ul className="space-y-4 mb-8">
                  {[
                    "Check eligibility and document readiness",
                    "Identify missing or expired documents",
                    "Validate technical compliance",
                    "Get AI-powered recommendations",
                    "Track your compliance status",
                    "Maintain reusable documents in Entity Locker",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn btn-accent text-sm">
                  Start as a Bidder <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="bg-white border-y border-gray-100">
        <div className="container section-padding">
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
              <div className="stat-label">Transparency &amp; accountability</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">Fairer</div>
              <div className="stat-label">Procurement ecosystem</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ QUOTE ═══════ */}
      <section className="bg-white">
        <div className="container section-padding">
          <div className="max-w-2xl">
            <span className="text-6xl text-[var(--saffron)] font-serif leading-none select-none">
              &ldquo;
            </span>
            <p className="text-xl font-semibold text-[var(--navy)] italic mt-2 leading-relaxed">
              Technology for Trust. Procurement for a Stronger India.
            </p>
            <p className="text-sm text-gray-400 mt-3">— Viksit Bharat</p>
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="bg-[var(--navy)]">
        <div className="container py-20 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 max-w-2xl mx-auto leading-tight">
            Together for a Transparent, Efficient and Inclusive Procurement Ecosystem.
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link href="/register" className="btn btn-accent">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn btn-white">
              Contact Us
            </Link>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-[var(--saffron)] to-[var(--navy)]" />
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[#071428] text-white">
        <div className="container pt-16 pb-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--saffron)] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Bidguard AI</h3>
                  <p className="text-[11px] text-blue-300/40">Secure Procurement. Stronger India.</p>
                </div>
              </div>
              <p className="text-sm text-blue-200/50 leading-relaxed max-w-sm mb-5">
                AI-Powered Government Bid Compliance Verification Platform.
                Built for SIH 2026 by Team Anveshak 2.0.
              </p>
              <div className="flex items-center gap-2 text-xs text-blue-200/30">
                <Star className="w-3 h-3 text-amber-400" />
                Smart India Hackathon 2026
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-sm text-white/80 mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-blue-200/50">
                <li><Link href="/bidder/documents" className="hover:text-white transition-colors">Entity Locker</Link></li>
                <li><Link href="/bidder/applications" className="hover:text-white transition-colors">Bid Verification</Link></li>
                <li><Link href="/bidder" className="hover:text-white transition-colors">Compliance Passport</Link></li>
                <li><Link href="/bidder/bids" className="hover:text-white transition-colors">Tender Insights</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white/80 mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-blue-200/50">
                <li><span className="hover:text-white transition-colors cursor-pointer">About Us</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Careers</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Contact Us</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white/80 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-blue-200/50">
                <li><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Terms of Use</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Data Governance</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-blue-200/30">
              &copy; 2026 Bidguard AI. All rights reserved. A step towards Viksit Bharat.
            </p>
            <div className="flex items-center gap-4 text-xs text-blue-200/30">
              <span>Team Anveshak 2.0</span>
              <span className="text-blue-200/15">|</span>
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
