"use client";
import { useEffect, useState } from "react";
import { LogOut, User, LayoutDashboard, Bell, ChevronUp } from "lucide-react";
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

  const itemClass = "flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#f5f5f7] hover:bg-white/10 transition-colors rounded-lg mx-1.5";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="flex items-center gap-1 cursor-pointer group"
      >
        <span className="w-8 h-8 bg-gradient-to-b from-[#2997ff] to-[#0066cc] text-white rounded-full flex items-center justify-center text-xs font-medium tracking-wide group-hover:brightness-110 transition-all ring-1 ring-white/20">
          {initials}
        </span>
        <ChevronUp className={`w-3 h-3 text-[#86868b] transition-transform ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-64 bg-[#1C1C1E] border border-white/12 rounded-2xl shadow-2xl z-50 overflow-hidden py-1">
            <div className="px-4 py-3.5 border-b border-white/10">
              <div className="font-semibold text-sm text-[#f5f5f7]">{user.name}</div>
              <div className="text-xs text-[#86868b] truncate mt-0.5">{user.email}</div>
              <div className="text-[11px] text-[#2997ff] mt-1 capitalize">{user.role.replace(/_/g, " ").toLowerCase()}</div>
            </div>
            <div className="py-1.5">
              <a href={dashboardLink} className={itemClass}>
                <LayoutDashboard className="w-4 h-4 text-[#2997ff]" strokeWidth={1.75} /> Dashboard
              </a>
              <a href={dashboardLink + "/profile"} className={itemClass}>
                <User className="w-4 h-4 text-[#86868b]" strokeWidth={1.75} /> Profile
              </a>
              <a href={dashboardLink + "/notifications"} className={`${itemClass} ${open ? "" : ""}`}>
                <Bell className="w-4 h-4 text-[#86868b]" strokeWidth={1.75} /> Notifications
                {typeof user.unreadNotifications === "number" && user.unreadNotifications > 0 && (
                  <span className="ml-auto bg-[#ff453a] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
                  </span>
                )}
              </a>
            </div>
            <div className="border-t border-white/10 py-1.5">
              <button onClick={handleSignOut} className={`w-full ${itemClass} !text-[#ff6961] cursor-pointer`}>
                <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
