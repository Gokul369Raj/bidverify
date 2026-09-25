"use client";

import Image from "next/image";
import { useLang } from "@/components/LanguageProvider";

/* ─────────────────────────────────────────────────────────────────────────
   PortalGrid — the "verified against" logo wall.

   Ten of these are the genuine marks taken from each authority's own portal.
   Five bodies do not publish a standalone logo asset (GSTN, PAN, EPFO, MCA21,
   Make in India), so they get a neutral abbreviation tile rather than an
   invented logo — the tile styling is shared, so the wall still reads as one
   consistent set.
   ───────────────────────────────────────────────────────────────────────── */

interface Portal {
  /** Abbreviation shown in the badge when no logo asset exists. */
  abbr: string;
  name: string;
  logo?: string;
  /** Intrinsic size of the logo file, for next/image. */
  w?: number;
  h?: number;
  /** Badge tint when `logo` is absent. */
  tint?: string;
}

const PORTALS: Portal[] = [
  { abbr: "GeM", name: "Government e-Marketplace", logo: "/images/portals/gem.png", w: 420, h: 158 },
  { abbr: "GST", name: "Goods & Services Tax Network", tint: "#0F6CB6" },
  { abbr: "Udyam", name: "Udyam / MSME Registration", logo: "/images/portals/udyam.png", w: 613, h: 120 },
  { abbr: "ITD", name: "Income Tax Department", logo: "/images/portals/income-tax.png", w: 420, h: 80 },
  { abbr: "PAN", name: "Permanent Account Number", tint: "#1B5DA8" },
  { abbr: "EPFO", name: "Employees' Provident Fund", tint: "#0D6606" },
  { abbr: "ESIC", name: "Employees' State Insurance", logo: "/images/portals/esic.png", w: 233, h: 120 },
  { abbr: "DL", name: "DigiLocker", logo: "/images/portals/digilocker.png", w: 420, h: 84 },
  { abbr: "MCA", name: "Ministry of Corporate Affairs", tint: "#6F42C1" },
  { abbr: "MII", name: "Make in India", tint: "#B03D0C" },
  { abbr: "BIS", name: "Bureau of Indian Standards", logo: "/images/portals/bis.png", w: 466, h: 120 },
  { abbr: "NIC", name: "National Informatics Centre", logo: "/images/portals/nic.png", w: 380, h: 108 },
  { abbr: "DI", name: "Digital India Programme", logo: "/images/portals/digital-india.png", w: 220, h: 108 },
  { abbr: "NPI", name: "National Portal of India", logo: "/images/portals/india-gov.png", w: 420, h: 101 },
  { abbr: "MeitY", name: "Ministry of Electronics & IT", logo: "/images/portals/meity.png", w: 220, h: 106 },
];

export default function PortalGrid() {
  const { t } = useLang();

  return (
    <section className="section bg-[var(--surface-2)] border-y border-[var(--border)]">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="heading-eyebrow">{t("portals.title")}</span>
          <h2 className="heading-lg mt-2.5 mb-3">{t("portals.subtitle")}</h2>
          <div className="section-rule mx-auto" />
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {PORTALS.map((p) => (
            <li
              key={p.abbr}
              className="group flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-5 text-center transition-all hover:border-[var(--navy-500)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
            >
              {/* Mark */}
              <div className="h-[46px] flex items-center justify-center w-full">
                {p.logo ? (
                  <Image
                    src={p.logo}
                    alt={p.name}
                    width={p.w ?? 400}
                    height={p.h ?? 120}
                    className="max-h-[46px] w-auto object-contain"
                    style={{ maxHeight: 46, width: "auto" }}
                  />
                ) : (
                  <span
                    className="inline-flex items-center justify-center rounded-[var(--radius)] px-3 py-2 text-[15px] font-extrabold tracking-tight text-white shadow-[var(--shadow-xs)]"
                    style={{ background: p.tint }}
                    aria-hidden="true"
                  >
                    {p.abbr}
                  </span>
                )}
              </div>

              {/* Name */}
              <span className="text-[11.5px] font-semibold leading-snug text-[var(--foreground-secondary)] group-hover:text-[var(--navy-800)] transition-colors">
                {p.name}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-center text-[11.5px] text-[var(--foreground-tertiary)] mt-7 max-w-2xl mx-auto leading-relaxed">
          {t("preamble.notice")}
        </p>
      </div>
    </section>
  );
}
