"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Search, LogIn, UserPlus } from "lucide-react";
import UserNav from "@/components/UserNav";
import GovtTopBar from "@/components/GovtTopBar";
import { BrandLogo } from "@/components/BrandLogo";
import { useSession } from "@/lib/useSession";
import { useLang } from "@/components/LanguageProvider";

const NAV_LINKS = [
  { href: "/", key: "nav.home" },
  { href: "/how-it-works", key: "nav.howItWorks" },
  { href: "/compliance", key: "nav.compliance" },
  { href: "/tenders", key: "nav.tenders" },
  { href: "/about", key: "nav.about" },
];

export default function SiteNav({ onSignIn }: { onSignIn: () => void }) {
  const { user, loading } = useSession();
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="tricolor-bar" />
      <GovtTopBar />

      {/* ── Masthead ── */}
      <div className={`bg-white transition-shadow duration-200 ${scrolled ? "shadow-[0_2px_16px_rgba(16,27,45,0.10)]" : "border-b border-[var(--border)]"}`}>
        <div className="container-wide">
          <div className="flex h-[76px] items-center justify-between gap-4">
            <BrandLogo />

            {/* Primary navigation */}
            <nav className="hidden lg:flex items-center" aria-label={t("nav.primary")}>
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="relative px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] transition-colors group"
                >
                  {t(l.key)}
                  <span className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-[var(--saffron-500)] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-200" />
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Smart India Hackathon credit */}
              <Link
                href="/about"
                className="hidden xl:flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--navy-500)] hover:bg-[var(--navy-50)] transition-colors"
                title="Smart India Hackathon 2026"
              >
                <Image
                  src="/images/govt/sih-logo.png"
                  alt="Smart India Hackathon 2026"
                  width={64}
                  height={33}
                  className="h-8 w-auto"
                  style={{ height: 32, width: "auto" }}
                />
                <span className="hidden 2xl:block text-[10.5px] font-semibold leading-tight text-[var(--foreground-secondary)]">
                  Smart India
                  <br />
                  Hackathon 2026
                </span>
              </Link>

              <Link
                href="/tenders"
                aria-label={t("nav.search")}
                className="hidden md:flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] hover:bg-[var(--navy-50)] transition-colors"
              >
                <Search className="w-[18px] h-[18px]" aria-hidden="true" />
              </Link>

              {!loading && !user && (
                <>
                  <Link href="/register" className="hidden sm:inline-flex btn btn-navy btn-sm">
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    {t("nav.register")}
                  </Link>
                  <button onClick={onSignIn} className="btn btn-outline btn-sm cursor-pointer">
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    {t("nav.login")}
                  </button>
                </>
              )}
              <UserNav />

              <button
                className="lg:hidden p-2 text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] hover:bg-[var(--navy-50)] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[var(--border)] bg-white shadow-lg">
            <nav className="container py-3 space-y-0.5" aria-label={t("nav.mobile")}>
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-3 text-[15px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] hover:bg-[var(--navy-50)] rounded-[var(--radius)] transition-colors"
                >
                  {t(l.key)}
                </Link>
              ))}

              <div className="flex items-center gap-2.5 px-3 py-3 border-t border-[var(--border)] mt-2">
                <Image
                  src="/images/govt/sih-logo.png"
                  alt="Smart India Hackathon 2026"
                  width={72}
                  height={37}
                  className="h-9 w-auto"
                  style={{ height: 36, width: "auto" }}
                />
                <span className="text-[12px] font-semibold text-[var(--foreground-secondary)]">
                  Smart India Hackathon 2026
                </span>
              </div>

              {!loading && !user && (
                <div className="pt-2 border-t border-[var(--border)] space-y-2">
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex justify-center btn btn-navy w-full"
                  >
                    {t("nav.registerBidder")}
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); onSignIn(); }}
                    className="flex justify-center btn btn-outline w-full cursor-pointer"
                  >
                    {t("nav.login")}
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
