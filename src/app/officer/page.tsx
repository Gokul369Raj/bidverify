"use client";

import { useEffect, useState } from "react";
import { getSessionClient } from "@/lib/session";
import Link from "next/link";
import {
  FileText, Users, ClipboardCheck, AlertTriangle, Scale, BarChart3,
  Shield, ArrowRight, Upload, ChevronRight, CalendarDays, BadgeCheck,
  Bell, TrendingUp,
} from "lucide-react";

interface OfficerData {
   
  tenders: any[];
   
  user: any;
  notifications: { notifications: { id: string; title: string; body: string }[]; unread: number };
}

export default function OfficerDashboard() {
  const [data, setData] = useState<OfficerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) }).then((r) => r.json()),
      getSessionClient().then((u) => ({ ok: Boolean(u), data: u })),
      fetch("/api/notifications").then((r) => r.json()),
    ]).then(([tenders, me, notifs]) => {
      setData({
        tenders: tenders.ok ? tenders.data.tenders : [],
        user: me.ok ? me.data : null,
        notifications: notifs.ok ? notifs.data : { notifications: [], unread: 0 },
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[104px] skeleton rounded-[var(--radius-lg)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] skeleton rounded-[var(--radius-lg)]" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 skeleton rounded-[var(--radius-lg)]" />
          <div className="h-80 skeleton rounded-[var(--radius-lg)]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-9 h-9 text-[var(--warning)] mx-auto mb-3" aria-hidden="true" />
        <p className="text-[14px] font-semibold text-[var(--foreground)]">Unable to load dashboard</p>
      </div>
    );
  }

  const tenders = data.tenders;
  const totalBids = tenders.reduce((s: number, t) => s + (t._count?.bids || 0), 0);
  const totalReqs = tenders.reduce((s: number, t) => s + (t._count?.requirements || 0), 0);
  const closingSoon = tenders.filter((t) => {
    const diff = new Date(t.closingDate).getTime() - Date.now();
    return diff > 0 && diff < 7 * 86400000;
  });

  const stats = [
    { label: "Active Tenders", value: tenders.length, icon: FileText, tone: "navy" },
    { label: "Bids Received", value: totalBids, icon: Users, tone: "green" },
    { label: "Requirements Tracked", value: totalReqs, icon: Scale, tone: "amber" },
    { label: "Closing This Week", value: closingSoon.length, icon: ClipboardCheck, tone: "red" },
  ];

  const toneMap: Record<string, { bg: string; fg: string }> = {
    navy: { bg: "var(--navy-100)", fg: "var(--navy-700)" },
    amber: { bg: "var(--amber-100)", fg: "var(--amber-700)" },
    red: { bg: "var(--red-100)", fg: "var(--red-600)" },
    green: { bg: "var(--green-100)", fg: "var(--green-700)" },
  };

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
              Procurement Officer Dashboard · {today}
            </p>
            <h1 className="text-[25px] font-extrabold text-white tracking-tight leading-tight">
              Procurement Control Centre
            </h1>
            <p className="text-[13.5px] text-white/65 mt-1.5">
              {data.user?.name ? `${data.user.name} — ` : ""}
              overview of tenders, bids and compliance status across the department.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href="/officer/verification" className="btn btn-white">
              <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              Verification Queue
            </Link>
            <Link href="/officer/tenders" className="btn btn-saffron">
              <Upload className="w-4 h-4" aria-hidden="true" />
              Create Tender
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ KPI cards ═══════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key metrics">
        {stats.map((s) => {
          const t = toneMap[s.tone];
          return (
            <div key={s.label} className="card p-5">
              <div className="flex items-center gap-4">
                <span className="w-11 h-11 rounded-[var(--radius)] flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                  <s.icon className="w-5 h-5" style={{ color: t.fg }} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-[26px] font-extrabold text-[var(--navy-800)] leading-none tabular-nums">{s.value}</div>
                  <div className="text-[12.5px] font-medium text-[var(--foreground-secondary)] mt-1 truncate">{s.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ═══════ Main grid ═══════ */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tenders table */}
        <section className="lg:col-span-2 govt-panel">
          <div className="govt-panel-head">
            <h2 className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
              Tenders Under Management
            </h2>
            <Link
              href="/officer/tenders"
              className="text-[12.5px] font-semibold text-[var(--navy-600)] hover:text-[var(--navy-800)] flex items-center gap-1"
            >
              Manage all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {tenders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText className="w-8 h-8 text-[var(--gray-300)] mx-auto mb-3" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-[var(--foreground-secondary)]">No tenders created yet</p>
              <p className="text-[12.5px] text-[var(--foreground-tertiary)] mt-1">
                Create your first tender to begin the evaluation workflow.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th className="hidden sm:table-cell">Category</th>
                    <th>Reqs</th>
                    <th>Bids</th>
                    <th>Closing</th>
                    <th className="hidden md:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.slice(0, 8).map((t) => {
                    const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link
                            href={`/officer/tenders/${t.id}`}
                            className="font-semibold text-[var(--foreground)] hover:text-[var(--navy-700)] block max-w-[260px] truncate"
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
                        <td className="tabular-nums font-semibold text-[var(--foreground)]">{t._count?.requirements || 0}</td>
                        <td className="tabular-nums font-semibold text-[var(--foreground)]">{t._count?.bids || 0}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold ${
                            daysLeft <= 0 ? "text-[var(--gray-400)]" : daysLeft <= 7 ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"
                          }`}>
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                            {daysLeft > 0 ? `${daysLeft} days` : "Closed"}
                          </span>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="badge badge-yellow">{t.dataLabel || "DEMO"}</span>
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
            <div className="govt-panel-head"><h2>Quick Actions</h2></div>
            <div className="p-2">
              {[
                { href: "/officer/tenders", icon: FileText, label: "Manage Tenders", tone: "var(--navy-700)" },
                { href: "/officer/verification", icon: ClipboardCheck, label: "Verification Queue", tone: "var(--amber-600)" },
                { href: "/officer/compliance", icon: Scale, label: "Compliance Matrix", tone: "var(--green-600)" },
                { href: "/officer/reports", icon: BarChart3, label: "Reports & Analytics", tone: "var(--navy-600)" },
                { href: "/officer/audit", icon: Shield, label: "Audit Trail", tone: "var(--red-600)" },
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

          {/* Activity */}
          <section className="govt-panel">
            <div className="govt-panel-head">
              <h2 className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--navy-600)]" aria-hidden="true" />
                Recent Activity
              </h2>
              {data.notifications.unread > 0 && <span className="badge badge-red">{data.notifications.unread} new</span>}
            </div>
            <div className="divide-y divide-[var(--border-light)]">
              {data.notifications.notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="px-5 py-3.5">
                  <div className="text-[13.5px] font-semibold text-[var(--foreground)] leading-snug">{n.title}</div>
                  <div className="text-[12.5px] text-[var(--foreground-secondary)] mt-0.5 line-clamp-2 leading-relaxed">{n.body}</div>
                </div>
              ))}
              {data.notifications.notifications.length === 0 && (
                <p className="px-5 py-8 text-center text-[13px] text-[var(--foreground-tertiary)]">No recent activity</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ═══════ Demo notice + readiness ═══════ */}
      <div className="grid md:grid-cols-2 gap-5">
        <section className="notice notice-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold text-[13.5px] mb-0.5">Demonstration data active</p>
            <p className="text-[12.5px] leading-relaxed">
              Tender and verification data is simulated for this prototype.
              Connect live APIs from the Control Center to evaluate real submissions.
            </p>
          </div>
        </section>

        <section className="card p-5 flex items-start gap-4">
          <span className="w-11 h-11 rounded-[var(--radius)] bg-[var(--navy-100)] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-[var(--navy-700)]" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-bold text-[var(--navy-800)] flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-[var(--green-600)]" aria-hidden="true" />
              Evaluation readiness
            </p>
            <p className="text-[13px] text-[var(--foreground-secondary)] mt-1 leading-relaxed">
              {totalBids > 0
                ? `${totalBids} bid${totalBids === 1 ? "" : "s"} awaiting evaluation across ${tenders.length} tender${tenders.length === 1 ? "" : "s"}.`
                : "No bids have been submitted yet. Publish a tender to begin receiving submissions."}
            </p>
            <Link href="/officer/verification" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy-600)] hover:text-[var(--navy-800)] mt-2.5">
              Open verification queue <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
