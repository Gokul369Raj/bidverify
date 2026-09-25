"use client";

import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";
import { Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { useLang } from "@/components/LanguageProvider";

/* ─────────────────────────────────────────────────────────────────────────
   GovtFooter — GIGW-style footer: sitemap columns, official partner
   logos, contact block, disclaimer and "last updated" line.
   ───────────────────────────────────────────────────────────────────────── */

const COLUMNS = [
  {
    titleKey: "footer.colPlatform",
    links: [
      { key: "nav.home", href: "/" },
      { key: "nav.howItWorks", href: "/how-it-works" },
      { key: "nav.compliance", href: "/compliance" },
      { key: "nav.about", href: "/about" },
    ],
  },
  {
    titleKey: "footer.colBidder",
    links: [
      { key: "nav.register", href: "/register" },
      { key: "nav.tenders", href: "/bidder/tenders" },
      { key: "quick.vaultTitle", href: "/bidder/documents" },
      { key: "nav.login", href: "/login" },
    ],
  },
  {
    titleKey: "footer.colOfficer",
    links: [
      { key: "nav.login", href: "/officer" },
      { key: "quick.passportTitle", href: "/officer/compliance" },
      { key: "quick.insightsTitle", href: "/officer/reports" },
      { key: "nav.compliance", href: "/officer/verification" },
    ],
  },
  {
    titleKey: "footer.colPolicies",
    links: [
      { key: "footer.disclaimer", href: "/about" },
      { key: "nav.about", href: "/about" },
      { key: "footer.sitemap", href: "/" },
      { key: "footer.help", href: "/about" },
    ],
  },
];

/* Real marks from each authority's own portal — no invented logos. */
const PARTNERS = [
  { src: "/images/portals/gem.png", alt: "Government e-Marketplace (GeM)", w: 132, h: 50 },
  { src: "/images/portals/digital-india.png", alt: "Digital India", w: 74, h: 36 },
  { src: "/images/portals/india-gov.png", alt: "National Portal of India", w: 110, h: 26 },
  { src: "/images/portals/nic.png", alt: "National Informatics Centre", w: 96, h: 27 },
  { src: "/images/portals/meity.png", alt: "Ministry of Electronics and IT", w: 76, h: 37 },
];

export default function GovtFooter() {
  const { t } = useLang();

  const updated = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <footer className="bg-[var(--navy-900)] text-white">
      {/* ── Official partner strip ── */}
      <div className="border-b border-white/10">
        <div className="container py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60 text-center mb-5">
            {t("footer.integratedTitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {PARTNERS.map((p) => (
              <span key={p.src} className="inline-flex items-center rounded-[var(--radius-sm)] bg-white px-3.5 py-2">
                <Image
                  src={p.src}
                  alt={p.alt}
                  width={p.w}
                  height={p.h}
                  className="h-7 w-auto object-contain"
                  style={{ height: 28, width: "auto" }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sitemap + contact ── */}
      <div className="container pt-12 pb-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Identity */}
          <div className="lg:col-span-4">
            <div className="mb-4">
              <BrandLogo size="md" tone="inverse" href={null} />
            </div>
            <p className="text-[13px] text-white/65 leading-relaxed max-w-sm mb-5">
              {t("footer.blurb")}
            </p>
            <ul className="space-y-2.5 text-[13px] text-white/60">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--saffron-400)]" aria-hidden="true" />
                <span>{t("footer.address")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 shrink-0 text-[var(--saffron-400)]" aria-hidden="true" />
                <span>{t("footer.tollFree")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 shrink-0 text-[var(--saffron-400)]" aria-hidden="true" />
                <span>{t("footer.email")}</span>
              </li>
            </ul>
          </div>

          {/* Sitemap */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.titleKey}>
                <h4 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--saffron-400)] mb-4">
                  {t(col.titleKey)}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((l, i) => (
                    <li key={`${l.href}-${i}`}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-white/60 hover:text-white hover:underline transition-colors"
                      >
                        {t(l.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── SIH credit ── */}
        <div className="mt-10 rounded-[var(--radius-lg)] border border-white/12 bg-white/[0.04] p-5 flex flex-col sm:flex-row items-center gap-5">
          <Image
            src="/images/govt/sih-logo.png"
            alt="Smart India Hackathon 2026"
            width={120}
            height={61}
            className="h-12 w-auto shrink-0"
            style={{ height: 48, width: "auto" }}
          />
          <div className="text-center sm:text-left">
            <p className="text-[13px] font-semibold text-white/85">{t("footer.sihTitle")}</p>
            <p className="text-[12px] text-white/65 mt-1 leading-relaxed">{t("footer.sihBody")}</p>
          </div>
          <a
            href="https://sih.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="sm:ml-auto shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--saffron-400)] hover:text-white transition-colors"
          >
            sih.gov.in <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="tricolor-bar" />
      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/60 text-center md:text-left">
            © {new Date().getFullYear()} BidGuard AI. {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-white/60">
            <span>
              {t("footer.lastUpdated")}: {updated}
            </span>
            <span className="govt-divider">|</span>
            <Link href="/" className="hover:text-white hover:underline">{t("footer.sitemap")}</Link>
            <span className="govt-divider">|</span>
            <Link href="/about" className="hover:text-white hover:underline">{t("footer.disclaimer")}</Link>
            <span className="govt-divider">|</span>
            <Link href="/about" className="hover:text-white hover:underline">{t("footer.help")}</Link>
          </div>
        </div>
        <div className="container pb-6">
          <p className="text-[11px] leading-relaxed text-white/65 text-center md:text-left max-w-4xl">
            <strong className="font-semibold text-white/65">{t("footer.disclaimerLabel")}</strong>{" "}
            {t("footer.disclaimerBody")}
          </p>
        </div>
      </div>
    </footer>
  );
}
