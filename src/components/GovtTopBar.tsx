"use client";

import { useEffect, useState } from "react";
import { Volume2, Languages, Type } from "lucide-react";
import { useLang } from "@/components/LanguageProvider";

/* ─────────────────────────────────────────────────────────────────────────
   GovtTopBar — the dark utility strip that sits above the masthead on every
   Government of India portal: parent ministry, skip-link, text-size controls,
   screen-reader access and a working language toggle (GIGW 3.0 requirement).
   ───────────────────────────────────────────────────────────────────────── */

const SCALE_KEY = "bidguard_font_scale";
const STEPS = [
  { key: "sm", label: "A-", value: 0.92, tKey: "topbar.decrease" },
  { key: "md", label: "A", value: 1, tKey: "topbar.normal" },
  { key: "lg", label: "A+", value: 1.14, tKey: "topbar.increase" },
] as const;

export default function GovtTopBar({
  ministryKey = "topbar.ministry",
}: {
  ministryKey?: string;
}) {
  const { lang, setLang, t } = useLang();
  const [scale, setScale] = useState(1);

  /* Restore the visitor's saved text-size preference. */
  useEffect(() => {
    const saved = Number(localStorage.getItem(SCALE_KEY));
    if (saved >= 0.8 && saved <= 1.3) {
      setScale(saved);
      document.documentElement.style.setProperty("--font-scale", String(saved));
    }
  }, []);

  function applyScale(v: number) {
    setScale(v);
    localStorage.setItem(SCALE_KEY, String(v));
    document.documentElement.style.setProperty("--font-scale", String(v));
  }

  return (
    <div className="govt-header on-dark">
      <div className="container-wide flex items-center justify-between gap-4">
        {/* Authority line */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline font-semibold text-white/90">
            {t("topbar.authority")}
          </span>
          <span className="hidden sm:inline govt-divider">|</span>
          <span className="truncate text-white/65">{t(ministryKey)}</span>
        </div>

        {/* Accessibility + language controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a href="#main-content" className="hidden md:inline hover:underline">
            {t("topbar.skipToMain")}
          </a>
          <span className="hidden md:inline govt-divider">|</span>

          <span className="hidden lg:flex items-center gap-1" aria-label={t("topbar.textSize")}>
            <Type className="w-3.5 h-3.5 text-white/45" aria-hidden="true" />
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => applyScale(s.value)}
                title={t(s.tKey)}
                aria-label={t(s.tKey)}
                aria-pressed={Math.abs(scale - s.value) < 0.02}
                className={`a11y-btn ${Math.abs(scale - s.value) < 0.02 ? "!bg-white/20 !border-white/50 !text-white" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </span>
          <span className="hidden lg:inline govt-divider">|</span>

          <a href="#" className="hidden xl:flex items-center gap-1.5 hover:underline" title={t("topbar.screenReader")}>
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            {t("topbar.screenReader")}
          </a>
          <span className="hidden xl:inline govt-divider">|</span>

          {/* Language toggle — switches the whole portal copy */}
          <span className="flex items-center gap-1.5" aria-label={t("topbar.language")}>
            <Languages className="w-3.5 h-3.5 text-white/45" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setLang("hi")}
              lang="hi"
              aria-pressed={lang === "hi"}
              className={lang === "hi" ? "font-bold text-white" : "hover:underline"}
            >
              हिन्दी
            </button>
            <span className="govt-divider">/</span>
            <button
              type="button"
              onClick={() => setLang("en")}
              lang="en"
              aria-pressed={lang === "en"}
              className={lang === "en" ? "font-bold text-white" : "hover:underline"}
            >
              English
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
