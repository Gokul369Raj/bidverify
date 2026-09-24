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
      className={`nav-glass sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "shadow-lg" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-[var(--saffron)] to-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none tracking-tight">BIDGUARD</span>
              <span className="text-[var(--saffron)] font-bold text-lg leading-none"> AI</span>
            </div>
          </Link>

          {/* Center nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm font-medium text-blue-100/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150"
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
                  className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-white border border-white/20 hover:bg-white/10 rounded-lg px-4 py-2 transition-all"
                >
                  Register
                </Link>
                <button
                  onClick={onSignIn}
                  className="text-sm font-semibold text-white bg-[var(--saffron)] hover:bg-[var(--saffron-dark)] rounded-lg px-5 py-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  Login
                </button>
              </>
            )}
            <UserNav />

            {/* Mobile menu button */}
            <button
              className="lg:hidden text-white/70 hover:text-white p-2 cursor-pointer"
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
        <div className="lg:hidden border-t border-white/10 bg-[var(--navy)] px-6 py-4 space-y-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm text-blue-100/70 hover:text-white hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {!loading && !user && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="block text-center text-sm font-medium text-white border border-white/20 rounded-lg px-4 py-2.5 hover:bg-white/10 transition-colors"
              >
                Register as New Bidder
              </Link>
              <button
                onClick={() => { setOpen(false); onSignIn(); }}
                className="w-full text-sm font-semibold text-white bg-[var(--saffron)] rounded-lg px-4 py-2.5 cursor-pointer"
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
