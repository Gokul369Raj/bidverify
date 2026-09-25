"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatBot from "@/components/ChatBot";
import { BrandLogo } from "@/components/BrandLogo";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/session";
import {
  Shield, LayoutDashboard, Search, FileText, Upload, Bell, User, Settings,
  LogOut, ChevronDown, Building2, ClipboardCheck, Scale, BarChart3,
  ScrollText, Menu, X, Home, ChevronRight,
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType; }
interface NavGroup { title: string; items: NavItem[]; }

const BIDDER_NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/bidder", icon: LayoutDashboard },
      { label: "Search Tenders", href: "/bidder/tenders", icon: Search },
      { label: "My Applications", href: "/bidder/applications", icon: FileText },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Document Vault", href: "/bidder/documents", icon: Upload },
      { label: "Compliance Status", href: "/bidder/compliance", icon: ClipboardCheck },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Organization", href: "/bidder/profile", icon: Building2 },
      { label: "Notifications", href: "/bidder/notifications", icon: Bell },
    ],
  },
];

const OFFICER_NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/officer", icon: LayoutDashboard },
      { label: "Tenders", href: "/officer/tenders", icon: FileText },
      { label: "Verification Queue", href: "/officer/verification", icon: ClipboardCheck },
    ],
  },
  {
    title: "Analysis",
    items: [
      { label: "Compliance Matrix", href: "/officer/compliance", icon: Scale },
      { label: "Reports", href: "/officer/reports", icon: BarChart3 },
      { label: "Audit Trail", href: "/officer/audit", icon: ScrollText },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Admin Panel", href: "/officer/admin", icon: Settings },
      { label: "Notifications", href: "/officer/notifications", icon: Bell },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", PROCUREMENT_OFFICER: "Procurement Officer",
  BID_EVALUATION_OFFICER: "Evaluation Officer", COMPLIANCE_REVIEWER: "Compliance Reviewer",
  AUDITOR: "Auditor", SYSTEM_ADMIN: "System Admin", BIDDER: "Bidder",
};

export function AppShell({ children, role }: { children: React.ReactNode; role: "bidder" | "officer" }) {
  const { user, loading } = useSession();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = role === "bidder" ? BIDDER_NAV : OFFICER_NAV;

  useEffect(() => {
    if (!loading && !user) window.location.href = "/";
  }, [loading, user]);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    await signOut();
    window.location.href = "/";
  }

  /* The edge middleware already rejects unauthenticated requests, so the dashboard
     is safe to paint before the client-side session check returns. Blocking on it
     used to delay mounting the children by ~1.5s and pushed every one of their data
     fetches behind it — a serial waterfall. The shell now paints immediately. */
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--navy-800)] flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <p className="text-[13px] font-medium text-[var(--foreground-secondary)]">
            Redirecting to sign in…
          </p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/bidder" || href === "/officer") return pathname === href || pathname === href + "/";
    return pathname.startsWith(href);
  };

  const currentLabel =
    nav.flatMap((g) => g.items).find((i) => isActive(i.href))?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {/* Mobile scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--navy-950)]/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[264px] bg-[var(--navy-900)] flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="tricolor-bar shrink-0" />

        {/* Brand */}
        <div className="h-[74px] flex items-center gap-3 px-4 border-b border-white/10 shrink-0">
          <BrandLogo size="sm" tone="inverse" href={null} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-white/60 leading-tight truncate">
              {user ? (ROLE_LABELS[user.role] || user.role) : "Loading…"}
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white p-1 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {nav.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-[13.5px] font-medium transition-colors ${
                        active
                          ? "bg-white/[0.13] text-white"
                          : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--saffron-500)]" />
                      )}
                      <item.icon className="w-[17px] h-[17px] shrink-0" strokeWidth={2} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-white/10 space-y-0.5 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-[13.5px] font-medium text-white/65 hover:bg-white/[0.07] hover:text-white transition-colors"
          >
            <Home className="w-[17px] h-[17px] shrink-0" strokeWidth={2} aria-hidden="true" />
            Back to Portal Home
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-[13.5px] font-medium text-[#ff9a92] hover:bg-[var(--danger)]/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" strokeWidth={2} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-[64px] bg-white border-b border-[var(--border)] flex items-center justify-between gap-3 px-4 lg:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] p-1 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav className="hidden sm:flex items-center gap-1.5 text-[12.5px] min-w-0" aria-label="Breadcrumb">
              <Link href="/" className="text-[var(--foreground-tertiary)] hover:text-[var(--navy-700)] transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--gray-300)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--foreground-tertiary)] capitalize">{role}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--gray-300)] shrink-0" aria-hidden="true" />
              <span className="font-semibold text-[var(--navy-800)] truncate">{currentLabel}</span>
            </nav>
          </div>

          <div className="hidden xl:block text-[12.5px] text-[var(--foreground-secondary)] truncate max-w-xs">
            {user ? (user.organization?.legalName || ROLE_LABELS[user.role]) : "Loading…"}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={`/${role}/notifications`}
              aria-label="Notifications"
              className="relative p-2 text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] hover:bg-[var(--navy-50)] rounded-[var(--radius)] transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
              {(user?.unreadNotifications ?? 0) > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[var(--danger)] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {(user?.unreadNotifications ?? 0) > 9 ? "9+" : user?.unreadNotifications}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[var(--radius)] hover:bg-[var(--navy-50)] transition-colors cursor-pointer"
              >
                <span className="w-8 h-8 bg-[var(--navy-800)] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                  {(user?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden sm:block text-[13.5px] font-semibold text-[var(--foreground)] max-w-[110px] truncate">
                  {(user?.name || "Account").split(" ")[0]}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--foreground-tertiary)] transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[50px] w-[272px] bg-white border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 overflow-hidden">
                    <div className="px-4 py-3.5 bg-[var(--navy-50)] border-b border-[var(--border)]">
                      <div className="text-[13.5px] font-bold text-[var(--navy-800)] truncate">{user?.name ?? "Loading…"}</div>
                      <div className="text-[12px] text-[var(--foreground-tertiary)] truncate mt-0.5">{user?.email ?? ""}</div>
                      <span className="inline-block mt-2 badge badge-navy">{user ? ROLE_LABELS[user.role] : "…"}</span>
                    </div>
                    <div className="py-1.5">
                      <Link
                        href={`/${role}/profile`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-[var(--foreground-secondary)] hover:bg-[var(--navy-50)] hover:text-[var(--navy-800)] transition-colors"
                      >
                        <User className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" /> Profile
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

      <ChatBot context={role} />
    </div>
  );
}
