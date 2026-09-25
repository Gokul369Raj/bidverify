"use client";

import { useEffect, useState } from "react";
import { LogOut, User, LayoutDashboard, Bell, ChevronDown } from "lucide-react";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/session";

export default function UserNav() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!user) return null;

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const dashboardLink = user.role === "BIDDER" ? "/bidder" : "/officer";

  async function handleSignOut(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await signOut();
    window.location.href = "/";
  }

  const itemClass =
    "flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-[var(--foreground-secondary)] hover:bg-[var(--navy-50)] hover:text-[var(--navy-800)] transition-colors";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[var(--radius)] border border-transparent hover:border-[var(--border)] hover:bg-[var(--navy-50)] transition-colors cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full bg-[var(--navy-800)] text-white flex items-center justify-center text-[11px] font-bold tracking-wide shrink-0">
          {initials}
        </span>
        <span className="hidden sm:block text-[13.5px] font-semibold text-[var(--foreground)] max-w-[110px] truncate">
          {user.name.split(" ")[0]}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--foreground-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[52px] w-[280px] bg-white border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 overflow-hidden">
            <div className="px-4 py-3.5 bg-[var(--navy-50)] border-b border-[var(--border)]">
              <div className="text-[13.5px] font-bold text-[var(--navy-800)] truncate">{user.name}</div>
              <div className="text-[12px] text-[var(--foreground-tertiary)] truncate mt-0.5">{user.email}</div>
              <span className="inline-block mt-2 badge badge-navy">
                {user.role.replace(/_/g, " ")}
              </span>
            </div>

            <div className="py-1.5">
              <a href={dashboardLink} className={itemClass}>
                <LayoutDashboard className="w-4 h-4 text-[var(--navy-600)] shrink-0" strokeWidth={2} aria-hidden="true" />
                Dashboard
              </a>
              <a href={dashboardLink + "/profile"} className={itemClass}>
                <User className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0" strokeWidth={2} aria-hidden="true" />
                Profile
              </a>
              <a href={dashboardLink + "/notifications"} className={itemClass}>
                <Bell className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0" strokeWidth={2} aria-hidden="true" />
                Notifications
                {typeof user.unreadNotifications === "number" && user.unreadNotifications > 0 && (
                  <span className="ml-auto bg-[var(--danger)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
                  </span>
                )}
              </a>
            </div>

            <div className="border-t border-[var(--border)] py-1.5">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
