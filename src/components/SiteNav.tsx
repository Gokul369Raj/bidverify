"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import UserNav from "@/components/UserNav";
import { useSession } from "@/lib/useSession";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#features", label: "Features" },
  { href: "/bidder", label: "For Bidders" },
  { href: "/admin", label: "For Officers" },
];

/* Ashoka Stambh — Three Lions Emblem SVG */
function AshokaStambh({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Base platform */}
      <rect x="20" y="120" width="80" height="8" rx="2" fill="currentColor" opacity="0.3" />
      <rect x="25" y="116" width="70" height="6" rx="1" fill="currentColor" opacity="0.2" />

      {/* Ashoka Chakra circle at base */}
      <circle cx="60" cy="108" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
      <circle cx="60" cy="108" r="3" fill="currentColor" opacity="0.4" />
      {[0, 30, 60, 90, 120, 150].map((deg) => (
        <line key={deg} x1="60" y1="98" x2="60" y2="108" stroke="currentColor" strokeWidth="0.8" opacity="0.3"
          transform={`rotate(${deg} 60 108)`} />
      ))}

      {/* Central pillar */}
      <rect x="55" y="50" width="10" height="58" rx="2" fill="currentColor" opacity="0.15" />

      {/* Lion bodies - simplified */}
      {/* Left lion */}
      <path d="M20 65 C20 50 30 40 40 42 C42 38 48 35 55 38 L55 70 C48 68 35 70 30 72 C25 68 22 70 20 65Z"
        fill="currentColor" opacity="0.25" />
      {/* Right lion */}
      <path d="M100 65 C100 50 90 40 80 42 C78 38 72 35 65 38 L65 70 C72 68 85 70 90 72 C95 68 98 70 100 65Z"
        fill="currentColor" opacity="0.25" />
      {/* Center lion */}
      <path d="M40 55 C40 40 50 30 60 32 C70 30 80 40 80 55 L80 75 C72 72 48 72 40 75Z"
        fill="currentColor" opacity="0.3" />

      {/* Lion heads */}
      <circle cx="60" cy="35" r="10" fill="currentColor" opacity="0.35" />
      <circle cx="38" cy="42" r="7" fill="currentColor" opacity="0.3" />
      <circle cx="82" cy="42" r="7" fill="currentColor" opacity="0.3" />

      {/* Manes */}
      <path d="M50 28 C52 22 58 20 60 20 C62 20 68 22 70 28" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />

      {/* Top bell/capital */}
      <path d="M45 25 C45 18 52 14 60 14 C68 14 75 18 75 25" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />

      {/* "Satyameva Jayate" text placeholder */}
      <text x="60" y="136" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="600" opacity="0.5">
        सत्यमेव जयते
      </text>
    </svg>
  );
}

export default function SiteNav({ onSignIn }: { onSignIn: () => void }) {
  const { user, loading } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Indian Flag Tricolor Bar */}
      <div className="tricolor-bar" />

      {/* Government Info Bar */}
      <div className="govt-header">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-white/60">An Initiative under Digital India</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <a href="#" className="hover:text-white">Skip to Main Content</a>
            <span className="text-white/30">|</span>
            <span className="text-white/60 cursor-pointer hover:text-white">A-</span>
            <span className="text-white/60 cursor-pointer hover:text-white">A</span>
            <span className="text-white/60 cursor-pointer hover:text-white">A+</span>
            <span className="text-white/30">|</span>
            <span className="text-white/60 cursor-pointer hover:text-white">English</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className={`bg-white transition-shadow duration-200 ${scrolled ? "shadow-md" : "shadow-sm"}`}>
        <div className="container">
          <div className="flex h-[72px] items-center justify-between">
            {/* Left: Emblem + Title */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <AshokaStambh className="w-10 h-14 text-[var(--navy)]" />
              <div className="flex flex-col border-l border-[var(--gray-200)] pl-3">
                <span className="text-[var(--navy)] font-bold text-[15px] leading-tight tracking-tight">
                  Bidguard AI
                </span>
                <span className="text-[11px] text-[var(--gray-400)] leading-tight">
                  Government of India
                </span>
              </div>
            </Link>

            {/* Center: Nav links */}
            <div className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 text-[13px] font-medium text-[var(--gray-600)] hover:text-[var(--navy)] hover:bg-[var(--gray-50)] rounded transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {!loading && !user && (
                <>
                  <Link href="/register" className="hidden sm:inline-flex btn btn-navy btn-sm">
                    Register
                  </Link>
                  <button onClick={onSignIn} className="btn btn-outline btn-sm">
                    Login
                  </button>
                </>
              )}
              <UserNav />

              {/* Mobile toggle */}
              <button
                className="lg:hidden p-2 text-[var(--gray-500)] hover:text-[var(--navy)] hover:bg-[var(--gray-100)] rounded transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[var(--gray-200)] bg-white">
            <div className="container py-3 space-y-0.5">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-[var(--gray-600)] hover:text-[var(--navy)] hover:bg-[var(--gray-50)] rounded transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              {!loading && !user && (
                <div className="pt-3 border-t border-[var(--gray-200)] space-y-2">
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="block text-center btn btn-navy text-sm w-full">
                    Register as Bidder
                  </Link>
                  <button onClick={() => { setMobileOpen(false); onSignIn(); }} className="block text-center btn btn-outline text-sm w-full">
                    Login
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
