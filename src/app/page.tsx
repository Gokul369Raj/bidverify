"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import GovtFooter from "@/components/GovtFooter";
import PortalGrid from "@/components/PortalGrid";
import { BrandMark } from "@/components/BrandMark";
import { useSession } from "@/lib/useSession";
import { useLang } from "@/components/LanguageProvider";
import {
  ArrowRight, ShieldCheck, FileText, BarChart3, Upload, Search,
  Lock, Award, Clock, Scale, Landmark,
  FileSearch, BadgeCheck, ScrollText, Megaphone, ChevronRight, CalendarDays,
  Fingerprint, Database, CircleCheck, Info,
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

interface TenderRow {
  id: string;
  title: string;
  tenderNumber: string;
  buyerOrganization: string;
  closingDate: string;
  category?: string | null;
}

export default function LandingPage() {
  const { user: loggedInUser } = useSession();
  const { t } = useLang();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [showLogin, setShowLogin] = useState(false);

  /* "Go to Dashboard" routes to the role-correct dashboard. Officer-side roles
     land on /officer, everyone else on /bidder. */
  const OFFICER_ROLES = new Set([
    "SUPER_ADMIN", "PROCUREMENT_OFFICER", "BID_EVALUATION_OFFICER",
    "COMPLIANCE_REVIEWER", "AUDITOR", "SYSTEM_ADMIN",
  ]);
  const dashboardHref = loggedInUser
    ? OFFICER_ROLES.has(loggedInUser.role) ? "/officer" : "/bidder"
    : "/login";

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.data); })
      .catch(() => {});

    fetch("/api/public/tenders?limit=4")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTenders((d.data?.tenders ?? []).slice(0, 4)); })
      .catch(() => {});
  }, []);

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-IN") : "—");

  const PIPELINE = [
    { icon: Upload, t: t("pipeline.s1t"), d: t("pipeline.s1d") },
    { icon: Fingerprint, t: t("pipeline.s2t"), d: t("pipeline.s2d") },
    { icon: Database, t: t("pipeline.s3t"), d: t("pipeline.s3d") },
    { icon: FileSearch, t: t("pipeline.s4t"), d: t("pipeline.s4d") },
    { icon: Scale, t: t("pipeline.s5t"), d: t("pipeline.s5d") },
    { icon: BadgeCheck, t: t("pipeline.s6t"), d: t("pipeline.s6d") },
  ];

  const CAPABILITIES = [
    { icon: Upload, t: t("capability.c1t"), d: t("capability.c1d") },
    { icon: FileSearch, t: t("capability.c2t"), d: t("capability.c2d") },
    { icon: Fingerprint, t: t("capability.c3t"), d: t("capability.c3d") },
    { icon: Scale, t: t("capability.c4t"), d: t("capability.c4d") },
    { icon: BarChart3, t: t("capability.c5t"), d: t("capability.c5d") },
    { icon: ScrollText, t: t("capability.c6t"), d: t("capability.c6d") },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden bg-[var(--navy-900)]">
        <Image
          src="/images/photos/north-block.webp"
          alt="North Block, Secretariat Building, New Delhi"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Scrim strategy: a light overall wash plus a directional gradient that
            is dense behind the copy and fully clear over the right half, so the
            architecture stays legible instead of being flattened to navy. */}
        <div className="absolute inset-0 bg-[var(--navy-950)]/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--navy-950)]/88 via-[var(--navy-950)]/58 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy-950)]/60 via-transparent to-transparent" />

        <div className="relative container py-14 lg:py-20" id="main-content">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left — message */}
            <div className="lg:col-span-7 on-dark rise">
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11.5px] font-bold uppercase tracking-[0.1em] text-white">
                  <Landmark className="w-3.5 h-3.5 text-[var(--saffron-400)]" aria-hidden="true" />
                  {t("hero.badge")}
                </span>
              </div>

              <h1 className="heading-xl !text-white mb-5">
                {t("hero.titleA")}
                <br />
                {t("hero.titleB")}{" "}
                <span className="text-[var(--saffron-400)]">{t("hero.titleC")}</span>
              </h1>

              <p className="text-[16.5px] leading-relaxed text-white/75 max-w-2xl mb-8">
                {t("hero.body")}
              </p>

              <div className="flex flex-wrap gap-3 mb-9">
                {loggedInUser ? (
                  <Link href={dashboardHref} className="btn btn-saffron btn-lg">
                    {t("nav.dashboard")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link href="/register" className="btn btn-saffron btn-lg">
                    {t("hero.ctaBidder")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}
                <Link href="/admin" className="btn btn-white btn-lg">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  {t("nav.adminCenter")}
                </Link>
              </div>

              <ul className="grid sm:grid-cols-3 gap-x-6 gap-y-3 max-w-2xl">
                {[
                  { icon: ShieldCheck, text: t("hero.trust1") },
                  { icon: Clock, text: t("hero.trust2") },
                  { icon: ScrollText, text: t("hero.trust3") },
                ].map((x) => (
                  <li key={x.text} className="flex items-center gap-2.5 text-[13.5px] text-white/70">
                    <x.icon className="w-4 h-4 text-[var(--green-500)] shrink-0" aria-hidden="true" />
                    {x.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — notice board */}
            <div className="lg:col-span-5 rise rise-2">
              <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--navy-800)]">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <Megaphone className="w-4 h-4 text-[var(--saffron-400)]" aria-hidden="true" />
                    {t("hero.noticesTitle")}
                  </span>
                  <Link
                    href="/tenders"
                    className="text-[11.5px] font-semibold text-[var(--saffron-400)] hover:text-white transition-colors flex items-center gap-1"
                  >
                    {t("hero.viewAll")} <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </div>

                <div className="divide-y divide-[var(--border-light)]">
                  {tenders.length === 0 && (
                    <p className="px-5 py-7 text-center text-[13px] text-[var(--foreground-tertiary)]">
                      {t("hero.loading")}
                    </p>
                  )}
                  {tenders.map((row) => (
                    <Link
                      key={row.id}
                      href="/tenders"
                      className="block px-5 py-3.5 hover:bg-[var(--navy-50)] transition-colors group"
                    >
                      <div className="text-[13.5px] font-semibold text-[var(--foreground)] leading-snug line-clamp-2 group-hover:text-[var(--navy-700)] transition-colors">
                        {row.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-[var(--foreground-tertiary)]">
                        <span className="font-medium">{row.tenderNumber}</span>
                        <span className="text-[var(--gray-300)]">•</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" aria-hidden="true" />
                          {new Date(row.closingDate).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="grid grid-cols-3 border-t border-[var(--border)] bg-[var(--navy-50)]">
                  {[
                    { label: t("hero.statActive"), value: fmt(stats?.activeTenders) },
                    { label: t("hero.statBidders"), value: fmt(stats?.registeredBidders) },
                    { label: t("hero.statRequirements"), value: fmt(stats?.totalRequirements) },
                  ].map((s, i) => (
                    <div key={s.label} className={`px-3 py-4 text-center ${i < 2 ? "border-r border-[var(--border)]" : ""}`}>
                      <div className="text-[19px] font-extrabold text-[var(--navy-800)] leading-none tabular-nums">
                        {s.value}
                      </div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--foreground-tertiary)] mt-1.5 leading-tight">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ GOVT-STYLE PREAMBLE ══════════════════ */}
      <section className="bg-white border-b border-[var(--border)]">
        <div className="container py-10 lg:py-12">
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <span className="heading-eyebrow">{t("preamble.eyebrow")}</span>
              <h2 className="heading-md mt-2 mb-4 !text-[1.35rem]">{t("preamble.title")}</h2>
              <div className="section-rule mb-5" />
              <p className="text-[15px] leading-[1.85] text-[var(--foreground-secondary)]">
                {t("preamble.body")}
              </p>
            </div>

            <aside className="lg:col-span-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--navy-200)] bg-[var(--navy-50)] p-5">
                <p className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--navy-800)] mb-2.5">
                  <Info className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                  {t("footer.disclaimer")}
                </p>
                <p className="text-[12.5px] leading-relaxed text-[var(--navy-700)]">
                  {t("preamble.notice")}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ══════════════════ QUICK ACCESS ══════════════════ */}
      <section className="bg-white border-b border-[var(--border)]">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[var(--border-light)]">
            {[
              { icon: Search, title: t("quick.searchTitle"), desc: t("quick.searchDesc"), href: "/tenders" },
              { icon: Upload, title: t("quick.vaultTitle"), desc: t("quick.vaultDesc"), href: "/bidder/documents" },
              { icon: Award, title: t("quick.passportTitle"), desc: t("quick.passportDesc"), href: "/bidder" },
              { icon: BarChart3, title: t("quick.insightsTitle"), desc: t("quick.insightsDesc"), href: "/bidder/applications" },
            ].map((q) => (
              <Link
                key={q.title}
                href={q.href}
                className="group flex items-start gap-3.5 px-5 py-6 hover:bg-[var(--navy-50)] transition-colors"
              >
                <span className="w-10 h-10 rounded-[var(--radius)] bg-[var(--navy-100)] group-hover:bg-[var(--navy-800)] flex items-center justify-center shrink-0 transition-colors">
                  <q.icon className="w-5 h-5 text-[var(--navy-700)] group-hover:text-white transition-colors" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-[var(--navy-800)] leading-tight">{q.title}</span>
                  <span className="block text-[12px] text-[var(--foreground-tertiary)] mt-0.5">{q.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ PORTAL LOGO WALL ══════════════════ */}
      <PortalGrid />

      {/* ══════════════════ CHOOSE YOUR PATH ══════════════════ */}
      <section className="section-lg bg-white">
        <div className="container">
          <div className="max-w-2xl mb-11">
            <span className="heading-eyebrow">{t("paths.eyebrow")}</span>
            <h2 className="heading-lg mt-2.5 mb-3">{t("paths.title")}</h2>
            <div className="section-rule mb-4" />
            <p className="text-[15px] text-[var(--foreground-secondary)] leading-relaxed">
              {t("paths.body")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                img: "/images/photos/contract.webp",
                alt: "Signing a contract document",
                icon: FileText,
                eyebrow: t("paths.bidderEyebrow"),
                title: t("paths.bidderTitle"),
                desc: t("paths.bidderDesc"),
                href: "/register",
                cta: t("paths.bidderCta"),
                points: [t("paths.bidderPoint1"), t("paths.bidderPoint2"), t("paths.bidderPoint3")],
                tone: "saffron",
              },
              {
                img: "/images/photos/kartavya.webp",
                alt: "Kartavya Bhavan, New Delhi",
                icon: Scale,
                eyebrow: t("paths.officerEyebrow"),
                title: t("paths.officerTitle"),
                desc: t("paths.officerDesc"),
                href: "/login",
                cta: t("paths.officerCta"),
                points: [t("paths.officerPoint1"), t("paths.officerPoint2"), t("paths.officerPoint3")],
                tone: "navy",
              },
              {
                img: "/images/photos/refinery.webp",
                alt: "Industrial refinery plant",
                icon: Lock,
                eyebrow: t("paths.adminEyebrow"),
                title: t("paths.adminTitle"),
                desc: t("paths.adminDesc"),
                href: "/admin",
                cta: t("paths.adminCta"),
                points: [t("paths.adminPoint1"), t("paths.adminPoint2"), t("paths.adminPoint3")],
                tone: "green",
              },
            ].map((c) => (
              <article key={c.title} className="card overflow-hidden flex flex-col hover-lift">
                <div className="relative h-40 shrink-0">
                  <Image src={c.img} alt={c.alt} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy-950)]/85 via-[var(--navy-900)]/25 to-transparent" />
                  <span className="absolute top-3.5 left-3.5 w-9 h-9 rounded-[var(--radius)] bg-white/95 flex items-center justify-center shadow-[var(--shadow-sm)]">
                    <c.icon className="w-[18px] h-[18px] text-[var(--navy-800)]" aria-hidden="true" />
                  </span>
                  <span className="absolute bottom-3.5 left-4 text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--saffron-400)]">
                    {c.eyebrow}
                  </span>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="heading-md mb-2">{c.title}</h3>
                  <p className="text-[13.5px] text-[var(--foreground-secondary)] leading-relaxed mb-5">{c.desc}</p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {c.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[13px] text-[var(--foreground-secondary)]">
                        <CircleCheck className="w-4 h-4 text-[var(--green-500)] shrink-0 mt-0.5" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={c.href}
                    className={`btn w-full ${c.tone === "saffron" ? "btn-saffron" : c.tone === "navy" ? "btn-navy" : "btn-green"}`}
                  >
                    {c.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ VERIFICATION PIPELINE ══════════════════ */}
      <section className="section-lg bg-[var(--navy-900)] relative overflow-hidden">
        <Image
          src="/images/photos/india-gate.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.13]"
          aria-hidden="true"
        />
        <div className="relative container on-dark">
          <div className="max-w-2xl mb-11">
            <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--saffron-400)]">
              {t("pipeline.eyebrow")}
            </span>
            <h2 className="heading-lg !text-white mt-2.5 mb-3">{t("pipeline.title")}</h2>
            <div className="section-rule mb-4" />
            <p className="text-[15px] text-white/70 leading-relaxed">{t("pipeline.body")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PIPELINE.map((s, i) => (
              <div
                key={s.t}
                className="rounded-[var(--radius-lg)] border border-white/12 bg-white/[0.05] p-5 hover:bg-white/[0.09] transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-[var(--radius)] bg-[var(--saffron-500)]/18 border border-[var(--saffron-500)]/30 flex items-center justify-center shrink-0">
                    <s.icon className="w-[18px] h-[18px] text-[var(--saffron-400)]" aria-hidden="true" />
                  </span>
                  <span className="text-[10.5px] font-bold tracking-[0.1em] text-white/65 uppercase">
                    {t("pipeline.step")} {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-[14.5px] font-bold text-white mb-1.5">{s.t}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4">
            {[
              { range: "75–100", label: t("pipeline.bandVerified"), desc: t("pipeline.bandVerifiedDesc"), tone: "var(--green-500)" },
              { range: "45–74", label: t("pipeline.bandReview"), desc: t("pipeline.bandReviewDesc"), tone: "var(--amber-600)" },
              { range: "0–44", label: t("pipeline.bandFailed"), desc: t("pipeline.bandFailedDesc"), tone: "var(--red-600)" },
            ].map((b) => (
              <div key={b.label} className="rounded-[var(--radius-lg)] border border-white/12 bg-white/[0.04] p-5 flex items-start gap-4">
                <span className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: b.tone }}>
                  {b.range}
                </span>
                <div>
                  <div className="text-[13.5px] font-bold text-white">{b.label}</div>
                  <div className="text-[12px] text-white/55 mt-0.5 leading-relaxed">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ CAPABILITY GRID ══════════════════ */}
      <section id="features" className="section-lg bg-[var(--surface-2)]">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-11">
            <span className="heading-eyebrow">{t("capability.eyebrow")}</span>
            <h2 className="heading-lg mt-2.5 mb-3">{t("capability.title")}</h2>
            <div className="section-rule mx-auto mb-4" />
            <p className="text-[15px] text-[var(--foreground-secondary)]">{t("capability.body")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((f) => (
              <div key={f.t} className="card p-6">
                <span className="w-11 h-11 rounded-[var(--radius)] bg-[var(--navy-800)] flex items-center justify-center mb-4">
                  <f.icon className="w-[21px] h-[21px] text-white" aria-hidden="true" />
                </span>
                <h3 className="text-[15.5px] font-bold text-[var(--navy-800)] mb-2">{f.t}</h3>
                <p className="text-[13.5px] text-[var(--foreground-secondary)] leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how-it-works" className="section-lg bg-white">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <span className="heading-eyebrow">{t("process.eyebrow")}</span>
              <h2 className="heading-lg mt-2.5 mb-3">{t("process.title")}</h2>
              <div className="section-rule mb-5" />
              <p className="text-[15px] text-[var(--foreground-secondary)] leading-relaxed mb-7">
                {t("process.body")}
              </p>
              <Link href="/how-it-works" className="btn btn-navy">
                {t("process.cta")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="lg:col-span-7">
              <ol className="relative space-y-6 pl-12">
                <span className="absolute left-[19px] top-3 bottom-3 w-[2px] bg-[var(--border)]" aria-hidden="true" />
                {[
                  { icon: FileText, t: t("process.p1t"), d: t("process.p1d") },
                  { icon: Upload, t: t("process.p2t"), d: t("process.p2d") },
                  { icon: ShieldCheck, t: t("process.p3t"), d: t("process.p3d") },
                  { icon: BadgeCheck, t: t("process.p4t"), d: t("process.p4d") },
                ].map((s) => (
                  <li key={s.t} className="relative">
                    <span className="absolute -left-12 top-0.5 w-10 h-10 rounded-full bg-[var(--navy-800)] border-4 border-white shadow-[var(--shadow-sm)] flex items-center justify-center">
                      <s.icon className="w-[18px] h-[18px] text-white" aria-hidden="true" />
                    </span>
                    <h3 className="text-[15.5px] font-bold text-[var(--navy-800)] mb-1">{s.t}</h3>
                    <p className="text-[13.5px] text-[var(--foreground-secondary)] leading-relaxed">{s.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ IMPACT STATS ══════════════════ */}
      <section className="relative overflow-hidden bg-[var(--navy-800)]">
        <Image src="/images/photos/rashtrapati.webp" alt="" fill sizes="100vw" className="object-cover opacity-[0.14]" aria-hidden="true" />
        <div className="relative container py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: "60–80%", label: t("impact.i1") },
              { num: "30–50%", label: t("impact.i2") },
              { num: "12", label: t("impact.i3") },
              { num: "100%", label: t("impact.i4") },
            ].map((s) => (
              <div key={s.label} className="text-center on-dark">
                <div className="text-[clamp(1.7rem,1.2rem+1.6vw,2.4rem)] font-extrabold text-[var(--saffron-400)] leading-none tabular-nums">
                  {s.num}
                </div>
                <div className="text-[12.5px] text-white/65 mt-3 leading-relaxed">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ QUOTE ══════════════════ */}
      <section className="section bg-white">
        <div className="container">
          <div className="max-w-3xl">
            <span className="text-[52px] leading-[0.7] text-[var(--saffron-500)] font-serif select-none" aria-hidden="true">
              &ldquo;
            </span>
            <p className="text-[clamp(1.15rem,0.9rem+0.9vw,1.6rem)] font-bold text-[var(--navy-800)] italic leading-relaxed mt-3">
              {t("quote.text")}
            </p>
            <p className="text-[13px] text-[var(--foreground-tertiary)] mt-4 flex items-center gap-2">
              <span className="w-8 h-[2px] bg-[var(--saffron-500)] inline-block" aria-hidden="true" />
              {t("quote.attribution")}
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════ FINAL CTA ══════════════════ */}
      <section className="relative overflow-hidden bg-[var(--navy-900)]">
        <div className="container py-16 text-center on-dark">
          <span className="inline-flex items-center justify-center rounded-[var(--radius-lg)] bg-white p-2.5 shadow-[var(--shadow-md)] mb-6">
            <BrandMark size={44} />
          </span>
          <h2 className="text-[clamp(1.4rem,1rem+1.3vw,2rem)] font-extrabold text-white mb-4 max-w-3xl mx-auto leading-snug">
            {t("cta.title")}
          </h2>
          <p className="text-[15px] text-white/65 max-w-2xl mx-auto mb-9">{t("cta.body")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {loggedInUser ? (
              <Link href={dashboardHref} className="btn btn-saffron btn-lg">
                {t("nav.dashboard")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/register" className="btn btn-saffron btn-lg">
                {t("cta.primary")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
            <Link href="/admin" className="btn btn-white btn-lg">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              {t("nav.adminCenter")}
            </Link>
          </div>

          {!loggedInUser && (
            <p className="text-[12.5px] text-white/60 mt-7">
              {t("cta.alreadyRegistered")}{" "}
              <button onClick={() => setShowLogin(true)} className="text-[var(--saffron-500)] font-semibold hover:underline cursor-pointer">
                {t("cta.signIn")}
              </button>
            </p>
          )}
        </div>
        <div className="tricolor-bar" />
      </section>

      <GovtFooter />

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
