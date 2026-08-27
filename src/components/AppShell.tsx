"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ChatBot from "@/components/ChatBot";
import { Logo } from "@/components/Logo";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/session";
import {
  Shield, LayoutDashboard, Search, FileText, Upload, Bell, User, Settings,
  LogOut, ChevronDown, Building2, ClipboardCheck, Scale, BarChart3,
  ScrollText, Menu, X,
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType; badge?: number; }

const BIDDER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/bidder", icon: LayoutDashboard },
  { label: "Search Tenders", href: "/bidder/tenders", icon: Search },
  { label: "My Applications", href: "/bidder/applications", icon: FileText },
  { label: "Document Vault", href: "/bidder/documents", icon: Upload },
  { label: "Compliance", href: "/bidder/compliance", icon: ClipboardCheck },
  { label: "Notifications", href: "/bidder/notifications", icon: Bell },
  { label: "Organization", href: "/bidder/profile", icon: Building2 },
];

const OFFICER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/officer", icon: LayoutDashboard },
  { label: "Tenders", href: "/officer/tenders", icon: FileText },
  { label: "Verification Queue", href: "/officer/verification", icon: ClipboardCheck },
  { label: "Compliance", href: "/officer/compliance", icon: Scale },
  { label: "Reports", href: "/officer/reports", icon: BarChart3 },
  { label: "Audit Trail", href: "/officer/audit", icon: ScrollText },
  { label: "Admin", href: "/officer/admin", icon: Settings },
  { label: "Notifications", href: "/officer/notifications", icon: Bell },
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <p className="caption">Loading...</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/bidder" || href === "/officer") return pathname === href || pathname === href + "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--surface)] border-r border-[var(--border)] transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-14 flex items-center gap-3 px-5 border-b border-[var(--border-light)] shrink-0">
          <Logo size="small" />
          <span className="text-[11px] font-medium text-[var(--accent)] truncate">{ROLE_LABELS[user.role] || user.role}</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-[var(--foreground-tertiary)] hover:text-[var(--foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border-light)] space-y-1 shrink-0">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-light)] px-3 py-2 rounded-lg transition-colors w-full">
            <Shield className="w-4 h-4" strokeWidth={1.75} /> Back to Home
          </Link>
          <button onClick={logout} className="flex items-center gap-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] px-3 py-2 rounded-lg transition-colors w-full cursor-pointer">
            <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="lg:hidden text-[var(--foreground-secondary)] hover:text-[var(--foreground)]">
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline">
              Home
            </Link>
          </div>

          <div className="hidden lg:block">
            <span className="text-sm text-[var(--foreground-secondary)]">{user.organization?.legalName || ROLE_LABELS[user.role]}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/${role}/notifications`} aria-label="Notifications" className="relative p-2 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg transition-colors">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {(user.unreadNotifications ?? 0) > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 bg-[var(--danger)] text-white text-[9px] font-semibold rounded-full flex items-center justify-center px-1">
                  {(user.unreadNotifications ?? 0) > 9 ? "9+" : user.unreadNotifications}
                </span>
              )}
            </Link>

            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg pl-1 pr-2 py-1 transition-colors cursor-pointer">
                <span className="w-8 h-8 bg-[var(--accent)] rounded-full flex items-center justify-center text-xs font-medium text-white">
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden sm:block font-medium">{user.name.split(" ")[0]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--foreground-tertiary)] transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-2 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-light)]">
                      <div className="text-sm font-semibold text-[var(--foreground)]">{user.name}</div>
                      <div className="text-xs text-[var(--foreground-tertiary)] truncate">{user.email}</div>
                      <span className="inline-block mt-1.5 text-[10px] font-medium bg-[var(--surface-2)] text-[var(--foreground-secondary)] px-2 py-0.5 rounded-md">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>
                    <div className="py-1.5">
                      <Link href={`/${role}/profile`} className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]" onClick={() => setMenuOpen(false)}>
                        <User className="w-4 h-4 text-[var(--foreground-tertiary)]" strokeWidth={1.75} /> Profile
                      </Link>
                      <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)] cursor-pointer">
                        <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>

      <ChatBot context={role} />
    </div>
  );
}
