"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import UserNav from "@/components/UserNav";
import { useSession } from "@/lib/useSession";

const LINKS = [
  { href: "/tenders", label: "Tenders" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/compliance", label: "Compliance" },
  { href: "/about", label: "About" },
];

/**
 * Apple-style dark frosted-glass navigation.
 * 44px bar · centered micro-links · blur material per HIG.
 */
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
      className={`glass-nav sticky top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "shadow-[0_1px_0_0_rgba(255,255,255,0.08),0_8px_30px_rgba(0,0,0,0.5)]" : ""
      }`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-[1024px] mx-auto px-6">
        <div className="h-12 flex items-center justify-between gap-4">
          {/* Left: logo */}
          <Link href="/" aria-label="BIDGUARD AI home" className="shrink-0">
            <Logo size="small" dark />
          </Link>

          {/* Center: micro-links (desktop) */}
          <div className="hidden md:flex items-center gap-7">
            {LINKS.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.href} href={l.href} className="text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] font-medium transition-colors duration-150">
                  {l.label}
                </Link>
              ) : (
                <a key={l.href} href={l.href} className="text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] font-medium transition-colors duration-150">
                  {l.label}
                </a>
              ),
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {!loading && !user && (
              <button
                onClick={onSignIn}
                className="text-xs font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-full px-4 py-1.5 transition-colors duration-200 cursor-pointer"
              >
                Login
              </button>
            )}
            <UserNav />
            <button
              className="md:hidden text-[var(--foreground-secondary)] hover:text-[var(--foreground)] p-1 cursor-pointer"
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
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 space-y-3">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] py-1"
            >
              {l.label}
            </a>
          ))}
          {!loading && !user && (
            <button
              onClick={() => { setOpen(false); onSignIn(); }}
               className="w-full btn-primary !py-2 !text-sm mt-2 cursor-pointer"
            >
              Login
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
