"use client";
import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { useSession } from "@/lib/useSession";
import {
  ArrowRight, Shield, FileText, CheckCircle, BarChart3,
  AlertTriangle, Users, Upload, Search, Zap, Eye,
  Building2, Globe, Lock, ChevronRight, Check, Star,
  TrendingUp, Clock, Award,
} from "lucide-react";

const ChatBot = lazy(() => import("@/components/ChatBot"));
const LoginModal = lazy(() => import("@/components/LoginModal"));

interface PlatformStats {
  totalTenders: number; activeTenders: number; registeredBidders: number;
  totalBids: number; totalRequirements: number;
}

const FEATURES = [
  { icon: Lock, title: "Entity Locker", badge: "NEW", desc: "Securely store, manage and reuse your verified business documents across multiple tenders.", cta: "Open Entity Locker", href: "/bidder/documents" },
  { icon: Search, title: "Verify a Bid", desc: "Check eligibility, technical and financial compliance for any tender.", cta: "Start Verification", href: "/bidder/applications" },
  { icon: Award, title: "Compliance Passport", desc: "Your verified compliance profile for faster participation.", cta: "View Passport", href: "/bidder" },
  { icon: BarChart3, title: "Tender Insights", desc: "Get AI-powered insights, risk analysis and gap identification before you submit.", cta: "Explore Insights", href: "/bidder/bids" },
];

const GOVT_PORTALS = [
  { name: "GeM", desc: "Government e-Marketplace" },
  { name: "GSTN", desc: "GST Network" },
  { name: "Udyam", desc: "MSME Registration" },
  { name: "Income Tax", desc: "PAN Verification" },
  { name: "EPFO", desc: "Provident Fund" },
  { name: "ESIC", desc: "Employee Insurance" },
  { name: "Startup India", desc: "DPIIT Recognition" },
  { name: "DigiLocker", desc: "Document Wallet" },
  { name: "MCA21", desc: "Company Affairs" },
  { name: "Make in India", desc: "Local Content" },
];

const STEPS = [
  { num: "1", title: "Register", desc: "Create your bidder or officer account", icon: Users },
  { num: "2", title: "Upload", desc: "Submit tender & supporting documents", icon: Upload },
  { num: "3", title: "AI Verifies", desc: "Extracts, checks and matches requirements", icon: Zap },
  { num: "4", title: "Get Results", desc: "View compliance status, issues and recommendations", icon: CheckCircle },
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

      {/* ═══════ HERO ═══════ */}
      <section className="relative bg-gradient-to-br from-[#0B1D3A] via-[#0F2847] to-[#162D52] text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-saffron/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-medium text-blue-200 border border-white/10">
                  AI-POWERED • TRANSPARENT • COMPLIANT
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tight">
                Smarter Compliance for a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                  Stronger India
                </span>
              </h1>
              <p className="text-lg text-blue-100/80 mb-8 max-w-lg leading-relaxed">
                Bidguard AI helps verify, analyze and simplify bid compliance for Government Procurement — from document submission to decision support.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link href="/register" className="btn-saffron">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="btn-outline-white">
                  Watch Demo
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-blue-100/60">
                <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Trusted & Secure</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-300" /> Faster Evaluation</span>
                <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-300" /> Evidence-Backed Decisions</span>
              </div>
            </div>

            {/* Right — workflow diagram */}
            <div className="relative">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
                <h3 className="text-sm font-semibold text-blue-200 mb-6 uppercase tracking-wider">From Documents to Decisions</h3>
                <div className="flex items-center justify-between gap-2">
                  {["Upload", "Verify (AI)", "Ensure Compliance", "Decision Support"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${i === 1 ? "bg-saffron/20 border border-saffron/30" : "bg-white/10 border border-white/10"}`}>
                          {i === 0 && <Upload className="w-5 h-5 text-blue-200" />}
                          {i === 1 && <Zap className="w-5 h-5 text-saffron" />}
                          {i === 2 && <Shield className="w-5 h-5 text-green-400" />}
                          {i === 3 && <CheckCircle className="w-5 h-5 text-blue-200" />}
                        </div>
                        <span className="text-xs text-blue-200/70 text-center whitespace-nowrap">{step}</span>
                      </div>
                      {i < 3 && <ChevronRight className="w-4 h-4 text-white/20 mt-[-20px]" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trusted by Government */}
              <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5">
                <p className="text-xs text-blue-200/60 mb-3 uppercase tracking-wider font-medium">Trusted by Government Ecosystem</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-8 h-8 text-blue-300" />
                    <div>
                      <p className="text-sm font-bold text-white">GeM</p>
                      <p className="text-[10px] text-blue-200/50">Government e-Marketplace</p>
                    </div>
                  </div>
                  <span className="text-white/10">|</span>
                  <div className="flex items-center gap-2">
                    <Globe className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">Also supports</p>
                      <p className="text-[10px] text-blue-200/50">GSTN • Udyam • PAN • EPFO • ESIC • + More</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ GOVERNMENT PORTALS ═══════ */}
      <section className="bg-white border-y border-[var(--border)] py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider text-center mb-4">
            Integrated with Government Portals — Real-time verification. Trusted data sources.
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {GOVT_PORTALS.map(p => (
              <div key={p.name} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)] transition-colors">
                <Globe className="w-4 h-4 text-[var(--blue-accent)]" />
                <span className="font-medium">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURE CARDS ═══════ */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <Link key={f.title} href={f.href} className="card-feature group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-lighter)] flex items-center justify-center">
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  {f.badge && <span className="badge-new">{f.badge}</span>}
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{f.desc}</p>
                <span className="text-sm font-semibold text-[var(--saffron)] flex items-center gap-1 group-hover:gap-2 transition-all">
                  {f.cta} <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-4">How It Works</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">A simple, end-to-end process for compliant procurement</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 3 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-[var(--border)] to-transparent" />}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--navy)] to-[var(--navy-lighter)] flex items-center justify-center mx-auto mb-5 relative z-10">
                  <span className="text-xl font-bold text-white">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FOR OFFICERS / FOR BIDDERS ═══════ */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Officers */}
            <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="bg-gradient-to-r from-[var(--navy)] to-[var(--navy-lighter)] px-8 py-6">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">For Procurement Officers</p>
                <h3 className="text-2xl font-bold text-white">Faster, Evidence-Driven Evaluation</h3>
              </div>
              <div className="p-8">
                <ul className="space-y-3 mb-8">
                  {["Machine-readable tender requirements", "Automated document verification", "Cross-source government checks", "Risk & anomaly detection", "Complete audit trail", "Human-in-the-loop decision support"].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
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
            <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="bg-gradient-to-r from-[var(--saffron)] to-[var(--saffron-light)] px-8 py-6">
                <p className="text-xs font-semibold text-orange-100 uppercase tracking-wider mb-1">For Bidders</p>
                <h3 className="text-2xl font-bold text-white">Know Your Bid Before You Submit</h3>
              </div>
              <div className="p-8">
                <ul className="space-y-3 mb-8">
                  {["Check eligibility and document readiness", "Identify missing or expired documents", "Validate technical compliance", "Get AI-powered recommendations", "Track your compliance status", "Maintain reusable documents in Entity Locker"].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
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
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="stat-card">
              <div className="stat-number">{stats?.activeTenders ?? 0}</div>
              <div className="stat-label">Active Tenders</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.registeredBidders ?? 0}</div>
              <div className="stat-label">Registered Bidders</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.totalBids ?? 0}</div>
              <div className="stat-label">Bids Submitted</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.totalRequirements ?? 0}</div>
              <div className="stat-label">Requirements Verified</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CTA BANNER ═══════ */}
      <section className="py-16 bg-gradient-to-r from-[var(--saffron)] via-[var(--saffron-dark)] to-[var(--navy)] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Together for a Transparent, Efficient and Inclusive Procurement Ecosystem.
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Technology for Trust. Procurement for a Stronger India.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-saffron bg-white text-[var(--navy)] hover:bg-gray-100 shadow-lg">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-outline-white">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[var(--bg-darker)] text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-saffron to-orange-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">BIDGUARD AI</h3>
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
            <p className="text-xs text-blue-200/40">
              &copy; 2026 BIDGUARD AI. All rights reserved. A step towards Viksit Bharat.
            </p>
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
