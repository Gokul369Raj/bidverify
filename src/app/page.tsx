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
  { name: "GeM", color: "#041E42", bg: "#F0F4F8" },
  { name: "GSTN", color: "#0D6EFD", bg: "#E7F1FF" },
  { name: "Udyam", color: "#6F42C1", bg: "#F3EEFF" },
  { name: "Income Tax", color: "#FF6B2B", bg: "#FFF3EC" },
  { name: "PAN", color: "#198754", bg: "#E8F5E9" },
  { name: "EPFO", color: "#DC3545", bg: "#FDE8EA" },
  { name: "ESIC", color: "#20C997", bg: "#E6FBF5" },
  { name: "DigiLocker", color: "#0D6EFD", bg: "#E7F1FF" },
  { name: "MCA21", color: "#6F42C1", bg: "#F3EEFF" },
  { name: "Make in India", color: "#041E42", bg: "#F0F4F8" },
];

export default function LandingPage() {
  const { user: loggedInUser } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.data); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* ═══════ HERO ═══════ */}
      <section className="bg-[var(--gray-50)]">
        <div className="container section-lg">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="badge badge-navy">AI-Powered Platform</span>
              </div>

              <h1 className="heading-xl mb-5">
                Smarter Compliance for a{" "}
                <span className="text-[var(--saffron)]">Stronger India</span>
              </h1>

              <p className="text-[var(--gray-500)] text-lg mb-8 max-w-lg leading-relaxed">
                Bidguard AI helps verify, analyze and simplify bid compliance for
                Government Procurement — from document submission to decision
                support.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link href="/register" className="btn btn-saffron">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/login" className="btn btn-navy">
                  View Dashboard
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-[var(--gray-500)]">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--green)]" /> Trusted &amp; Secure
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--blue)]" /> Faster Evaluation
                </span>
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--saffron)]" /> Evidence-Backed
                </span>
              </div>
            </div>

            {/* Right — Government Building Illustration */}
            <div className="hidden lg:block">
              <div className="relative bg-white rounded-lg border border-[var(--gray-200)] p-8 shadow-sm">
                {/* Government building SVG */}
                <svg viewBox="0 0 440 260" className="w-full h-auto" fill="none">
                  {/* Sky gradient */}
                  <defs>
                    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F0F4F8" />
                      <stop offset="100%" stopColor="#FFFFFF" />
                    </linearGradient>
                  </defs>
                  <rect width="440" height="260" fill="url(#sky)" rx="8" />

                  {/* Main building */}
                  <rect x="80" y="80" width="280" height="160" fill="#041E42" opacity="0.06" rx="4" />

                  {/* Dome */}
                  <ellipse cx="220" cy="80" rx="80" ry="40" fill="#041E42" opacity="0.05" />
                  <path d="M140 80 Q220 30 300 80" stroke="#041E42" strokeWidth="2" fill="none" opacity="0.12" />

                  {/* Dome top */}
                  <circle cx="220" cy="42" r="6" fill="#FF9933" opacity="0.4" />
                  <line x1="220" y1="36" x2="220" y2="28" stroke="#FF9933" strokeWidth="2" opacity="0.3" />

                  {/* Columns */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <rect key={i} x={110 + i * 44} y="100" width="12" height="140" fill="#041E42" opacity="0.07" rx="2" />
                  ))}

                  {/* Column capitals */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <rect key={`cap-${i}`} x={106 + i * 44} y="96" width="20" height="6" fill="#041E42" opacity="0.08" rx="1" />
                  ))}

                  {/* Windows */}
                  {[0, 1, 2].map((row) =>
                    [0, 1, 2, 3].map((col) => (
                      <rect key={`w-${row}-${col}`} x={130 + col * 60} y={120 + row * 40} width="24" height="16" rx="2"
                        fill={col === 1 && row === 0 ? "#FF6B2B" : "#041E42"} opacity={col === 1 && row === 0 ? 0.2 : 0.05} />
                    ))
                  )}

                  {/* Steps */}
                  <rect x="70" y="235" width="300" height="5" fill="#041E42" opacity="0.06" rx="1" />
                  <rect x="60" y="238" width="320" height="5" fill="#041E42" opacity="0.04" rx="1" />

                  {/* Flag */}
                  <line x1="220" y1="28" x2="220" y2="12" stroke="#041E42" strokeWidth="1.5" opacity="0.15" />
                  <rect x="220" y="12" width="24" height="5" fill="#FF9933" opacity="0.25" rx="1" />
                  <rect x="220" y="17" width="24" height="5" fill="#FFFFFF" opacity="0.15" rx="1" stroke="#041E42" strokeWidth="0.3" />
                  <rect x="220" y="22" width="24" height="5" fill="#138808" opacity="0.25" rx="1" />

                  {/* Right side: workflow steps */}
                  <g transform="translate(340, 100)">
                    <rect x="0" y="0" width="80" height="28" rx="4" fill="#FF6B2B" opacity="0.08" stroke="#FF6B2B" strokeWidth="0.5" />
                    <text x="40" y="18" textAnchor="middle" fontSize="8" fill="#041E42" fontWeight="600" opacity="0.5">Upload</text>

                    <line x1="40" y1="28" x2="40" y2="38" stroke="#041E42" strokeWidth="0.5" opacity="0.15" />

                    <rect x="0" y="38" width="80" height="28" rx="4" fill="#0D6EFD" opacity="0.08" stroke="#0D6EFD" strokeWidth="0.5" />
                    <text x="40" y="56" textAnchor="middle" fontSize="8" fill="#041E42" fontWeight="600" opacity="0.5">AI Verify</text>

                    <line x1="40" y1="66" x2="40" y2="76" stroke="#041E42" strokeWidth="0.5" opacity="0.15" />

                    <rect x="0" y="76" width="80" height="28" rx="4" fill="#198754" opacity="0.08" stroke="#198754" strokeWidth="0.5" />
                    <text x="40" y="94" textAnchor="middle" fontSize="8" fill="#041E42" fontWeight="600" opacity="0.5">Comply</text>

                    <line x1="40" y1="104" x2="40" y2="114" stroke="#041E42" strokeWidth="0.5" opacity="0.15" />

                    <rect x="0" y="114" width="80" height="28" rx="4" fill="#041E42" opacity="0.08" stroke="#041E42" strokeWidth="0.5" />
                    <text x="40" y="132" textAnchor="middle" fontSize="8" fill="#041E42" fontWeight="600" opacity="0.5">Decision</text>
                  </g>
                </svg>

                {/* Government ecosystem card */}
                <div className="mt-5 bg-[var(--gray-50)] rounded-lg border border-[var(--gray-200)] p-4">
                  <p className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider mb-2">
                    Trusted by Government Ecosystem
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[var(--navy)]" />
                      <div>
                        <p className="text-sm font-bold text-[var(--navy)]">GeM</p>
                        <p className="text-[10px] text-[var(--gray-400)]">Govt e-Marketplace</p>
                      </div>
                    </div>
                    <span className="text-[var(--gray-300)]">|</span>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--gray-400)]">
                      <span className="font-semibold text-[var(--gray-500)]">Also:</span>
                      GSTN · Udyam · PAN · EPFO · ESIC
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PORTALS ═══════ */}
      <section className="bg-white border-y border-[var(--gray-200)] section-sm">
        <div className="container">
          <p className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider text-center mb-4">
            Integrated with Government Portals — Real-time verification
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {PORTALS.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border transition-all hover:shadow-sm cursor-default"
                style={{ color: p.color, background: p.bg, borderColor: `${p.color}15` }}
              >
                <Globe className="w-3 h-3" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="bg-[var(--gray-50)]">
        <div className="container section-lg">
          <div className="text-center mb-12">
            <span className="badge badge-saffron mb-3">Platform Features</span>
            <h2 className="heading-lg">Powerful Tools for Government Procurement</h2>
            <p className="text-[var(--gray-500)] mt-2 max-w-xl mx-auto">
              Everything you need for compliant government procurement
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Lock, title: "Entity Locker", badge: "NEW", desc: "Securely store, manage and reuse your verified business documents across multiple tenders.", cta: "Open Locker", href: "/bidder/documents", color: "var(--saffron)" },
              { icon: Search, title: "Verify a Bid", badge: null, desc: "Check eligibility, technical and financial compliance for any tender before submission.", cta: "Start Verification", href: "/bidder/applications", color: "var(--blue)" },
              { icon: Award, title: "Compliance Passport", badge: null, desc: "Your verified compliance profile for faster participation in government tenders.", cta: "View Passport", href: "/bidder", color: "var(--green)" },
              { icon: BarChart3, title: "Tender Insights", badge: null, desc: "Get AI-powered insights, risk analysis and gap identification before you submit.", cta: "Explore Insights", href: "/bidder/bids", color: "var(--navy)" },
            ].map((f) => (
              <Link key={f.title} href={f.href} className="card group flex flex-col p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${f.color}10` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  {f.badge && <span className="badge badge-saffron">{f.badge}</span>}
                </div>
                <h3 className="heading-sm mb-1.5">{f.title}</h3>
                <p className="text-sm text-[var(--gray-500)] leading-relaxed mb-4 flex-1">{f.desc}</p>
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
        <div className="container section-lg">
          <div className="text-center mb-12">
            <span className="badge badge-navy mb-3">Process</span>
            <h2 className="heading-lg">How It Works</h2>
            <p className="text-[var(--gray-500)] mt-2">
              A simple, end-to-end process for compliant procurement
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { num: "1", title: "Register", desc: "Create your bidder or officer account" },
              { num: "2", title: "Upload", desc: "Submit tender and supporting documents" },
              { num: "3", title: "AI Verifies", desc: "Extracts, checks and matches requirements" },
              { num: "4", title: "Get Results", desc: "View compliance status and recommendations" },
            ].map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-[55%] w-[90%] h-px bg-[var(--gray-200)]" />
                )}
                <div className="w-14 h-14 rounded-full bg-[var(--navy)] flex items-center justify-center mx-auto mb-4 relative z-10">
                  <span className="text-lg font-bold text-white">{s.num}</span>
                </div>
                <h3 className="heading-sm mb-1">{s.title}</h3>
                <p className="text-sm text-[var(--gray-500)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ OFFICERS / BIDDERS ═══════ */}
      <section className="bg-[var(--gray-50)]">
        <div className="container section-lg">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Officers */}
            <div className="card overflow-hidden">
              <div className="bg-[var(--navy)] px-7 py-6">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-300" />
                  <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">For Procurement Officers</p>
                </div>
                <h3 className="text-xl font-bold text-white">Faster, Evidence-Driven Evaluation</h3>
              </div>
              <div className="p-7">
                <ul className="space-y-3 mb-6">
                  {[
                    "Machine-readable tender requirements",
                    "Automated document verification",
                    "Cross-source government checks",
                    "Risk and anomaly detection",
                    "Complete audit trail",
                    "Human-in-the-loop decision support",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--gray-600)]">
                      <CheckCircle className="w-4 h-4 text-[var(--green)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/admin" className="btn btn-navy btn-sm">
                  Explore Officer Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Bidders */}
            <div className="card overflow-hidden">
              <div className="bg-[var(--saffron)] px-7 py-6">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-orange-100" />
                  <p className="text-[11px] font-semibold text-orange-100 uppercase tracking-wider">For Bidders</p>
                </div>
                <h3 className="text-xl font-bold text-white">Know Your Bid Before You Submit</h3>
              </div>
              <div className="p-7">
                <ul className="space-y-3 mb-6">
                  {[
                    "Check eligibility and document readiness",
                    "Identify missing or expired documents",
                    "Validate technical compliance",
                    "Get AI-powered recommendations",
                    "Track your compliance status",
                    "Maintain reusable documents in Entity Locker",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--gray-600)]">
                      <CheckCircle className="w-4 h-4 text-[var(--green)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn btn-saffron btn-sm">
                  Start as a Bidder <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="bg-white border-y border-[var(--gray-200)]">
        <div className="container section">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: "60-80%", label: "Reduction in manual effort" },
              { num: "30-50%", label: "Faster tender evaluation" },
              { num: "Higher", label: "Transparency & accountability" },
              { num: "Fairer", label: "Procurement ecosystem" },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ QUOTE ═══════ */}
      <section className="bg-white">
        <div className="container section">
          <div className="max-w-2xl">
            <span className="text-5xl text-[var(--saffron)] font-serif leading-none select-none">&ldquo;</span>
            <p className="text-lg font-semibold text-[var(--navy)] italic mt-2 leading-relaxed">
              Technology for Trust. Procurement for a Stronger India.
            </p>
            <p className="text-sm text-[var(--gray-400)] mt-3">— Viksit Bharat</p>
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="bg-[var(--navy)]">
        <div className="container py-16 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3 max-w-2xl mx-auto leading-snug">
            Together for a Transparent, Efficient and Inclusive Procurement Ecosystem.
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/register" className="btn btn-saffron">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn btn-white">
              Contact Us
            </Link>
          </div>
        </div>
        {/* Tricolor accent */}
        <div className="tricolor-bar" />
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[var(--navy-dark)] text-white">
        <div className="container pt-12 pb-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-[var(--saffron)] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Bidguard AI</h3>
                  <p className="text-[10px] text-white/40">Government of India</p>
                </div>
              </div>
              <p className="text-[13px] text-white/40 leading-relaxed max-w-sm mb-4">
                AI-Powered Government Bid Compliance Verification Platform.
                Built for SIH 2026 by Team Anveshak 2.0.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-white/30">
                <Star className="w-3 h-3 text-amber-400" />
                Smart India Hackathon 2026
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-[13px] text-white/70 mb-3">Product</h4>
              <ul className="space-y-2 text-[13px] text-white/40">
                <li><Link href="/bidder/documents" className="hover:text-white transition-colors">Entity Locker</Link></li>
                <li><Link href="/bidder/applications" className="hover:text-white transition-colors">Bid Verification</Link></li>
                <li><Link href="/bidder" className="hover:text-white transition-colors">Compliance Passport</Link></li>
                <li><Link href="/bidder/bids" className="hover:text-white transition-colors">Tender Insights</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[13px] text-white/70 mb-3">Company</h4>
              <ul className="space-y-2 text-[13px] text-white/40">
                <li><span className="hover:text-white transition-colors cursor-pointer">About Us</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Careers</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Contact Us</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[13px] text-white/70 mb-3">Legal</h4>
              <ul className="space-y-2 text-[13px] text-white/40">
                <li><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Terms of Use</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Data Governance</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar with tricolor */}
          <div className="tricolor-bar mb-4 rounded-full" style={{ height: "2px" }} />
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/30">
              &copy; 2026 Bidguard AI. All rights reserved. A step towards Viksit Bharat.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-white/30">
              <span>Team Anveshak 2.0</span>
              <span className="text-white/15">|</span>
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
