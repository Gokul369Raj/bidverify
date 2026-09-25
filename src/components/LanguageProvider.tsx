"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICTS, LANG_STORAGE_KEY, translate, type Dict, type Lang } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────────────────
   Language context.

   Starts in English so server and first client render agree (no hydration
   mismatch), then restores the visitor's saved choice on mount. Setting the
   language also updates <html lang> so screen readers switch voice.
   ───────────────────────────────────────────────────────────────────────── */

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Whole dictionary for the active language. */
  d: Dict;
  /** Dot-path lookup, e.g. t("nav.home"). */
  t: (path: string) => string;
}

const LanguageContext = createContext<LangValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "hi" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      /* storage unavailable (private mode) — language still switches for this session */
    }
  }, []);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "hi" : "en"),
      d: DICTS[lang],
      t: (path: string) => translate(lang, path),
    }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Read the active language. Returns English defaults outside a provider so
 *  components stay usable in isolation (e.g. the admin gate). */
export function useLang(): LangValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    lang: "en",
    setLang: () => {},
    toggle: () => {},
    d: DICTS.en,
    t: (path: string) => translate("en", path),
  };
}
