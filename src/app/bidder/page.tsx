"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, Clock, AlertTriangle, Upload, ArrowRight,
  Building2, Wallet, Search, Bell, CalendarDays, TrendingUp, ChevronRight,
  ClipboardCheck, ShieldCheck,
} from "lucide-react";

interface DashboardData {
   
  tenders: any[];
   
  user: any;
  notifications: { notifications: { id: string; title: string; body: string }[]; unread: number };
  orgProfile: { complete?: boolean; missingFields?: string[] };
  vaultStats: { total: number; verified: number; needsAttention: number; expired: number };
   
  applications: any[];
}

export default function BidderDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
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

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[104px] skeleton rounded-[var(--radius-lg)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] skeleton rounded-[var(--radius-lg)]" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 skeleton rounded-[var(--radius-lg)]" />
          <div className="space-y-6">
            <div className="h-48 skeleton rounded-[var(--radius-lg)]" />
            <div className="h-64 skeleton rounded-[var(--radius-lg)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-9 h-9 text-[var(--warning)] mx-auto mb-3" aria-hidden="true" />
        <p className="text-[14px] font-semibold text-[var(--foreground)]">Unable to load dashboard</p>
        <p className="text-[13px] text-[var(--foreground-secondary)] mt-1">Please refresh the page and try again.</p>
      </div>
    );
  }

  const activeTenders = data.tenders.filter((t) => t.status === "ACTIVE");
  const closingSoon = activeTenders.filter((t) => {
    const diff = new Date(t.closingDate).getTime() - Date.now();
    return diff > 0 && diff < 7 * 86400000;
  });
  const notifs = data.notifications.notifications.slice(0, 5);

  const stats = [
    { label: "Active Tenders", value: activeTenders.length, icon: FileText, tone: "navy" },
    { label: "Closing This Week", value: closingSoon.length, icon: Clock, tone: "amber" },
    { label: "Unread Notifications", value: data.notifications.unread, icon: Bell, tone: "red" },
    { label: "Documents in Vault", value: data.vaultStats?.total || 0, icon: ShieldCheck, tone: "green" },
  ];

  const toneMap: Record<string, { bg: string; fg: string }> = {
    navy: { bg: "var(--navy-100)", fg: "var(--navy-700)" },
    amber: { bg: "var(--amber-100)", fg: "var(--amber-700)" },
    red: { bg: "var(--red-100)", fg: "var(--red-600)" },
    green: { bg: "var(--green-100)", fg: "var(--green-700)" },
  };

  const needsOrg =
    data.user?.role === "BIDDER" &&
    (data.orgProfile ? data.orgProfile.complete === false : !data.user?.organization);

  const vault = data.vaultStats ?? { total: 0, verified: 0, needsAttention: 0, expired: 0 };
  const readiness = vault.total > 0 ? Math.round((vault.verified / vault.total) * 100) : 0;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* ═══════ Welcome banner ═══════ */}
      <section className="rounded-[var(--radius-lg)] overflow-hidden bg-[var(--navy-800)] relative">
        <div className="absolute inset-0 opacity-[0.10]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }} aria-hidden="true" />
        <div className="relative px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--saffron-400)] mb-1.5">
              Bidder Dashboard · {today}
            </p>
            <h1 className="text-[25px] font-extrabold text-white tracking-tight leading-tight truncate">
              Welcome, {data.user?.name?.split(" ")[0] || "Bidder"}
            </h1>
            <p className="text-[13.5px] text-white/65 mt-1.5">
              {data.user?.organization?.legalName
                ? `${data.user.organization.legalName} — track compliance and bid readiness`
                : "Search tenders, verify documents and track your compliance status"}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-[var(--radius)] bg-white/10 border border-white/15 px-5 py-3.5 text-center">
              <div className="text-[24px] font-extrabold text-white leading-none tabular-nums">{readiness}%</div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/60 mt-1.5">
                Vault Readiness
              </div>
            </div>
            <Link href="/bidder/documents" className="btn btn-saffron">
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Document
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ Org profile prompt ═══════ */}
      {needsOrg && (
        <Link
          href="/bidder/profile"
          className="group flex items-center justify-between gap-4 flex-wrap rounded-[var(--radius-lg)] border border-[var(--saffron-500)]/35 bg-[var(--saffron-50)] p-5 hover:shadow-[var(--shadow)] transition-shadow"
        >
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-11 h-11 rounded-[var(--radius)] bg-[var(--saffron-500)]/15 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[var(--saffron-600)]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-[var(--navy-800)]">
                Complete your organisation profile
              </p>
              <p className="text-[13px] text-[var(--foreground-secondary)] mt-1 truncate">
                Missing: {(data.orgProfile.missingFields ?? ["Organisation details"]).slice(0, 4).join(" · ")}
                {(data.orgProfile.missingFields?.length ?? 0) > 4 ? " …" : ""}
              </p>
            </div>
          </div>
          <span className="btn btn-saffron btn-sm shrink-0">
            Fill details <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* ═══════ KPI cards ═══════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key metrics">
        {stats.map((s) => {
          const t = toneMap[s.tone];
          return (
            <div key={s.label} className="card p-5">
              <div className="flex items-center gap-4">
                <span
                  className="w-11 h-11 rounded-[var(--radius)] flex items-center justify-center shrink-0"
                  style={{ background: t.bg }}
                >
                  <s.icon className="w-5 h-5" style={{ color: t.fg }} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-[26px] font-extrabold text-[var(--navy-800)] leading-none tabular-nums">
                    {s.value}
                  </div>
                  <div className="text-[12.5px] font-medium text-[var(--foreground-secondary)] mt-1 truncate">
                    {s.label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ═══════ Vault summary strip ═══════ */}
      <section className="govt-panel">
        <div className="govt-panel-head">
          <h2 className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
            Document Vault Status
          </h2>
          <Link
            href="/bidder/documents"
            className="text-[12.5px] font-semibold text-[var(--navy-600)] hover:text-[var(--navy-800)] flex items-center gap-1"
          >
            Manage vault <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[var(--border-light)]">
          {[
            { label: "Total Documents", value: vault.total, tone: "var(--navy-700)" },
            { label: "Verified", value: vault.verified, tone: "var(--green-600)" },
            { label: "Needs Attention", value: vault.needsAttention, tone: "var(--amber-600)" },
            { label: "Expired", value: vault.expired, tone: "var(--red-600)" },
          ].map((v) => (
            <div key={v.label} className="px-5 py-4 text-center">
              <div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: v.tone }}>
                {v.value}
              </div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--foreground-tertiary)] mt-1.5">
                {v.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ Main grid ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active tenders */}
        <section className="lg:col-span-2 govt-panel">
          <div className="govt-panel-head">
            <h2 className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
              Active Tenders
            </h2>
            <Link
              href="/bidder/tenders"
              className="text-[12.5px] font-semibold text-[var(--navy-600)] hover:text-[var(--navy-800)] flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {activeTenders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText className="w-8 h-8 text-[var(--gray-300)] mx-auto mb-3" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-[var(--foreground-secondary)]">No active tenders</p>
              <p className="text-[12.5px] text-[var(--foreground-tertiary)] mt-1">
                New tender notices will appear here as soon as they are published.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th className="hidden sm:table-cell">Category</th>
                    <th className="hidden md:table-cell">State</th>
                    <th>Closing</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTenders.slice(0, 6).map((t) => {
                    const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
                    const urgent = daysLeft <= 7;
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link
                            href={`/bidder/tenders/${t.id}`}
                            className="font-semibold text-[var(--foreground)] hover:text-[var(--navy-700)] block max-w-[290px] truncate"
                          >
                            {t.title}
                          </Link>
                          <div className="text-[11.5px] text-[var(--foreground-tertiary)] mt-0.5 mono">
                            {t.tenderNumber}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell">
                          {t.category ? <span className="badge badge-blue">{t.category}</span> : <span className="text-[var(--gray-400)]">—</span>}
                        </td>
                        <td className="hidden md:table-cell">
                          {t.state ? <span className="badge badge-gray">{t.state}</span> : <span className="text-[var(--gray-400)]">—</span>}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold ${urgent ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                            {daysLeft > 0 ? `${daysLeft} days` : "Closed"}
                          </span>
                        </td>
                        <td className="text-right">
                          <Link href={`/bidder/tenders/${t.id}`} className="btn btn-outline btn-sm">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick actions */}
          <section className="govt-panel">
            <div className="govt-panel-head">
              <h2>Quick Actions</h2>
            </div>
            <div className="p-2">
              {[
                { href: "/bidder/tenders", icon: Search, label: "Search Tenders", tone: "var(--navy-700)" },
                { href: "/bidder/applications", icon: Wallet, label: "My Applications", tone: "var(--green-600)" },
                { href: "/bidder/documents", icon: Upload, label: "Document Vault", tone: "var(--saffron-600)" },
                { href: "/bidder/compliance", icon: ClipboardCheck, label: "Compliance Status", tone: "var(--navy-600)" },
                { href: "/bidder/profile", icon: Building2, label: "Organisation Profile", tone: "var(--amber-600)" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-[13.5px] font-medium text-[var(--foreground-secondary)] hover:bg-[var(--navy-50)] hover:text-[var(--navy-800)] transition-colors group"
                >
                  <a.icon className="w-[17px] h-[17px] shrink-0" style={{ color: a.tone }} aria-hidden="true" />
                  {a.label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-[var(--gray-300)] group-hover:text-[var(--navy-600)] transition-colors" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          {/* Notifications */}
          <section className="govt-panel">
            <div className="govt-panel-head">
              <h2 className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                Recent Notifications
              </h2>
              {data.notifications.unread > 0 && (
                <span className="badge badge-red">{data.notifications.unread} new</span>
              )}
            </div>
            <div className="divide-y divide-[var(--border-light)]">
              {notifs.length === 0 && (
                <p className="px-5 py-8 text-center text-[13px] text-[var(--foreground-tertiary)]">
                  No notifications yet
                </p>
              )}
              {notifs.map((n) => (
                <div key={n.id} className="px-5 py-3.5">
                  <div className="text-[13.5px] font-semibold text-[var(--foreground)] leading-snug">{n.title}</div>
                  <div className="text-[12.5px] text-[var(--foreground-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                    {n.body}
                  </div>
                </div>
              ))}
            </div>
            {notifs.length > 0 && (
              <Link
                href="/bidder/notifications"
                className="block px-5 py-3 text-center text-[12.5px] font-semibold text-[var(--navy-600)] hover:bg-[var(--navy-50)] border-t border-[var(--border-light)] transition-colors"
              >
                View all notifications
              </Link>
            )}
          </section>
        </div>
      </div>

      {/* ═══════ Guidance strip ═══════ */}
      <section className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <span className="w-11 h-11 rounded-[var(--radius)] bg-[var(--navy-100)] flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-[var(--navy-700)]" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-[var(--navy-800)]">
            Improve your bid readiness
          </p>
          <p className="text-[13px] text-[var(--foreground-secondary)] mt-1 leading-relaxed">
            Bids with a fully verified document vault clear compliance checks
            significantly faster. Verify your PAN, GSTIN, Udyam and experience
            certificates before your next submission.
          </p>
        </div>
        <Link href="/bidder/documents" className="btn btn-navy btn-sm shrink-0">
          Go to Vault <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
