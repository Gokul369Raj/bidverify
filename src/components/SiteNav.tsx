"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Shield, ChevronDown } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-all duration-300 ${
        scrolled ? "shadow-md border-b border-gray-100" : "border-b border-gray-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-[var(--saffron)] to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[var(--navy)] font-bold text-lg leading-none tracking-tight">Bidguard</span>
              <span className="text-[var(--saffron)] font-bold text-lg leading-none"> AI</span>
            </div>
          </Link>

          {/* Center nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[var(--navy)] hover:bg-gray-50 rounded-lg transition-all duration-150"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {!loading && !user && (
              <>
                <Link
                  href="/register"
                  className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[var(--navy)] border border-[var(--navy)] hover:bg-[var(--navy)] hover:text-white rounded-lg px-4 py-2 transition-all"
                >
                  Get Started <span className="text-xs">→</span>
                </Link>
                <button
                  onClick={onSignIn}
                  className="text-sm font-medium text-[var(--navy)] border border-gray-300 hover:border-[var(--navy)] rounded-lg px-4 py-2 transition-all cursor-pointer"
                >
                  Login
                </button>
              </>
            )}
            <UserNav />

            {/* Gov emblem */}
            <div className="hidden md:flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
              <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
                <circle cx="20" cy="20" r="19" stroke="#1a365d" strokeWidth="1.5" fill="none" />
                <path d="M20 6 L22 14 L20 12 L18 14 Z" fill="#1a365d" />
                <path d="M14 16 h12 v2 h-12z" fill="#1a365d" />
                <path d="M12 20 h16 v1.5 h-16z" fill="#1a365d" />
                <circle cx="20" cy="25" r="4" stroke="#1a365d" strokeWidth="1" fill="none" />
                <circle cx="20" cy="25" r="1.5" fill="#1a365d" />
                <path d="M15 32 h10" stroke="#1a365d" strokeWidth="1.5" />
                <text x="20" y="38" textAnchor="middle" fontSize="3.5" fill="#1a365d" fontWeight="600">भारत सरकार</text>
              </svg>
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden text-gray-500 hover:text-[var(--navy)] p-2 cursor-pointer"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm text-gray-600 hover:text-[var(--navy)] hover:bg-gray-50 rounded-lg px-3 py-2.5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {!loading && !user && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="block text-center text-sm font-medium text-white bg-[var(--navy)] rounded-lg px-4 py-2.5"
              >
                Register as New Bidder
              </Link>
              <button
                onClick={() => { setOpen(false); onSignIn(); }}
                className="w-full text-sm font-medium text-[var(--navy)] border border-gray-300 rounded-lg px-4 py-2.5 cursor-pointer"
              >
                Login
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
