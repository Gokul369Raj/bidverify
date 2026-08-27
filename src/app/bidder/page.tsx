"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, AlertTriangle, Upload, TrendingUp, ArrowRight, ExternalLink, Building2, Wallet } from "lucide-react";

export default function BidderDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 10 }) }).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/bidder/organization").then((r) => r.json()).catch(() => ({ ok: false })),
      fetch("/api/bidder/vault").then((r) => r.json()).catch(() => ({ ok: false })),
      fetch("/api/bidder/applications").then((r) => r.json()).catch(() => ({ ok: false })),
    ]).then(([tenders, me, notifs, org, vault, apps]) => {
      setData({
        tenders: tenders.ok ? tenders.data.tenders : [],
        user: me.ok ? me.data : null,
        notifications: notifs.ok ? notifs.data : { notifications: [], unread: 0 },
        orgProfile: org.ok ? org.data : { complete: true, missingFields: [] },
        vaultStats: vault.ok ? vault.data.stats : { total: 0, verified: 0, needsAttention: 0, expired: 0 },
        applications: apps.ok ? apps.data.applications : [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="h-10 w-64 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        <div className="space-y-6">
          <div className="h-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
          <div className="h-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
  if (!data) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Failed to load dashboard</div>;

  const activeTenders = data.tenders.filter((t: any) => t.status === "ACTIVE");
  const closingSoon = activeTenders.filter((t: any) => {
    const diff = new Date(t.closingDate).getTime() - Date.now();
    return diff > 0 && diff < 7 * 86400000;
  });
  const notifs = data.notifications.notifications.slice(0, 5);

  const stats = [
    { label: "Active Tenders", value: activeTenders.length, icon: FileText, color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/12" },
    { label: "Closing Soon", value: closingSoon.length, icon: Clock, color: "text-[var(--warning)]", bg: "bg-[var(--warning)]/10" },
    { label: "Notifications", value: data.notifications.unread, icon: AlertTriangle, color: "text-[var(--danger)]", bg: "bg-[var(--danger)]/10" },
    { label: "Documents in Vault", value: data.vaultStats?.total || 0, icon: CheckCircle2, color: "text-[var(--success)]", bg: "bg-[var(--success)]/10" },
  ];

  const needsOrg =
    data.user?.role === "BIDDER" &&
    (data.orgProfile ? data.orgProfile.complete === false : !data.user?.organization);

  return (
    <div className="space-y-6">
      {needsOrg && (
        <Link
          href="/bidder/profile"
          className="block rounded-xl border-l-4 !border-l-[var(--accent)] !border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent)]/8 to-[var(--surface)] p-5 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-[var(--accent)]" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-[var(--foreground)]">Complete your organization profile</p>
                <p className="text-sm text-[var(--foreground-secondary)] mt-1 truncate">
                  Missing: {(data.orgProfile.missingFields ?? ["Organization details"]).slice(0, 4).join(" · ")}
                  {(data.orgProfile.missingFields?.length ?? 0) > 4 ? " …" : ""}
                </p>
              </div>
            </div>
            <span className="btn-apple !py-2.5 !px-6 !text-sm shrink-0 group-hover:brightness-110 group-hover:shadow-lg">
              Fill details <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight">
            Welcome, {data.user?.name?.split(" ")[0] || "Bidder"}
          </h1>
          <p className="text-[15px] text-[var(--foreground-secondary)] mt-1.5">
            Search tenders, upload documents, and track your compliance status.
          </p>
        </div>
        {data.notifications.unread > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
            {data.notifications.unread} unread
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md hover:border-[var(--border)]/80 transition-all group cursor-default">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                <s.icon className={`w-5.5 h-5.5 ${s.color}`} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">{s.value}</div>
                <div className="text-xs font-medium text-[var(--foreground-secondary)] mt-0.5">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tenders */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--foreground)] text-[15px]">Active Tenders</h2>
            <Link href="/bidder/tenders" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 transition-colors font-medium">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {activeTenders.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--foreground-tertiary)]">No active tenders found</div>}
            {activeTenders.slice(0, 5).map((t: any) => {
              const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
              return (
                <Link key={t.id} href={`/bidder/tenders/${t.id}`} className="block px-5 py-3.5 hover:bg-[var(--surface-2)] transition-all hover:pl-6 group/item">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--foreground)] truncate group-hover/item:text-[var(--accent)] transition-colors">{t.title}</div>
                      <div className="text-xs text-[var(--foreground-secondary)] mt-0.5 font-medium">{t.tenderNumber} · {t.buyerOrganization}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {t.category && <span className="badge badge-blue text-[10px]">{t.category}</span>}
                        {t.state && <span className="badge badge-gray text-[10px]">{t.state}</span>}
                        {t.dataLabel === "DEMO_SIMULATED" && <span className="badge badge-yellow text-[10px]">DEMO DATA</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${daysLeft <= 7 ? "text-[var(--danger)]" : daysLeft <= 14 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                        {daysLeft > 0 ? `${daysLeft}d left` : "Closed"}
                      </div>
                      <div className="text-xs text-[var(--foreground-tertiary)] mt-0.5">{t._count?.requirements || 0} reqs</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions + Notifications */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--foreground)] text-[15px] mb-4">Quick Actions</h2>
            <div className="space-y-1">
              <Link href="/bidder/tenders" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] rounded-lg p-2.5 transition-all font-medium group">
                <Search className="w-4 h-4 text-[var(--accent)] group-hover:scale-110 transition-transform" /> Search Tenders
              </Link>
              <Link href="/bidder/applications" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] rounded-lg p-2.5 transition-all font-medium group">
                <Wallet className="w-4 h-4 text-[var(--success)] group-hover:scale-110 transition-transform" /> My Applications
              </Link>
              <Link href="/bidder/documents" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] rounded-lg p-2.5 transition-all font-medium group">
                <Upload className="w-4 h-4 text-[var(--warning)] group-hover:scale-110 transition-transform" /> Document Vault
              </Link>
              <Link href="/bidder/profile" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] rounded-lg p-2.5 transition-all font-medium group">
                <Building2 className="w-4 h-4 text-[var(--warning)] group-hover:scale-110 transition-transform" /> Organization Profile
              </Link>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--foreground)] text-[15px]">Recent Notifications</h2>
              {data.notifications.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center">
                  {data.notifications.unread}
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {notifs.length === 0 && <div className="px-5 py-4 text-sm text-[var(--foreground-tertiary)] text-center">No notifications</div>}
              {notifs.map((n: any) => (
                <div key={n.id} className="px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors cursor-default">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{n.title}</div>
                  <div className="text-xs text-[var(--foreground-secondary)] mt-0.5 line-clamp-2">{n.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Search(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
