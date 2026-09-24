"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Shield } from "lucide-react";
import UserNav from "@/components/UserNav";
import { useSession } from "@/lib/useSession";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#features", label: "Features" },
  { href: "/bidder", label: "For Bidders" },
  { href: "/admin", label: "For Officers" },
];

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
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[var(--saffron)] via-[var(--saffron-light)] to-[var(--navy)]" />

      {/* Main nav */}
      <nav className={`bg-white transition-shadow duration-300 ${scrolled ? "shadow-md" : "shadow-sm"}`}>
        <div className="container">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-[var(--navy)] flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[var(--navy)] font-bold text-base leading-tight tracking-tight">
                  Bidguard <span className="text-[var(--saffron)]">AI</span>
                </span>
                <span className="text-[10px] text-gray-400 leading-tight hidden sm:block">
                  Secure Procurement Platform
                </span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 text-[13px] font-medium text-gray-600 hover:text-[var(--navy)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {!loading && !user && (
                <>
                  <Link
                    href="/register"
                    className="hidden sm:inline-flex btn btn-primary text-[13px] py-2 px-4"
                  >
                    Register
                  </Link>
                  <button
                    onClick={onSignIn}
                    className="btn btn-outline text-[13px] py-2 px-4"
                  >
                    Login
                  </button>
                </>
              )}
              <UserNav />

              {/* Government emblem */}
              <div className="hidden md:flex items-center border-l border-gray-200 pl-3 ml-1">
                <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
                  <circle cx="18" cy="18" r="17" stroke="#0B1D3A" strokeWidth="1" fill="none" />
                  <circle cx="18" cy="18" r="14" stroke="#0B1D3A" strokeWidth="0.5" fill="none" />
                  {/* Simplified Ashoka Chakra */}
                  <circle cx="18" cy="18" r="6" stroke="#0B1D3A" strokeWidth="1" fill="none" />
                  <circle cx="18" cy="18" r="2" fill="#0B1D3A" />
                  {[0, 30, 60, 90, 120, 150].map((deg) => (
                    <line
                      key={deg}
                      x1="18"
                      y1="12"
                      x2="18"
                      y2="24"
                      stroke="#0B1D3A"
                      strokeWidth="0.5"
                      transform={`rotate(${deg} 18 18)`}
                    />
                  ))}
                  <text x="18" y="33" textAnchor="middle" fontSize="3" fill="#0B1D3A" fontWeight="600">
                    भारत सरकार
                  </text>
                </svg>
              </div>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 text-gray-500 hover:text-[var(--navy)] hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
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
          <div className="lg:hidden border-t border-gray-100 bg-white">
            <div className="container py-4 space-y-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-[var(--navy)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              {!loading && !user && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block text-center btn btn-primary text-sm w-full"
                  >
                    Register as Bidder
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); onSignIn(); }}
                    className="block text-center btn btn-outline text-sm w-full"
                  >
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
