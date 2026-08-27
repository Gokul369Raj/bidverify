"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, Users, ClipboardCheck, AlertTriangle, CheckCircle2, Upload,
  TrendingUp, ArrowRight, Shield, Scale, BarChart3,
} from "lucide-react";

export default function OfficerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) }).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
    ]).then(([tenders, me, notifs]) => {
      setData({ tenders: tenders.ok ? tenders.data.tenders : [], user: me.ok ? me.data : null, notifications: notifs.ok ? notifs.data : { notifications: [], unread: 0 } });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading dashboard...</div></div>;
  if (!data) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Failed to load</div>;

  const tenders = data.tenders;
  const totalBids = tenders.reduce((s: number, t: any) => s + (t._count?.bids || 0), 0);

  const stats = [
    { label: "Active Tenders", value: tenders.length, icon: FileText, color: "text-[var(--accent)]", bg: "bg-[var(--accent-light)]" },
    { label: "Total Bids", value: totalBids, icon: Users, color: "text-[var(--accent)]", bg: "bg-[var(--accent-light)]" },
    { label: "Pending Verification", value: 0, icon: ClipboardCheck, color: "text-[var(--warning)]", bg: "bg-[var(--warning-light)]" },
    { label: "Requirements Tracked", value: tenders.reduce((s: number, t: any) => s + (t._count?.requirements || 0), 0), icon: Scale, color: "text-[var(--success)]", bg: "bg-[var(--success-light)]" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Procurement Dashboard</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">Overview of tenders, bids, and compliance status.</p>
        </div>
        <Link
          href="/officer/tenders"
          className="btn-primary text-sm"
        >
          <Upload className="w-4 h-4" />
          Create Tender
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">{s.value}</div>
                <div className="text-xs text-[var(--foreground-secondary)]">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tenders List */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--foreground)]">Tenders</h2>
            <Link href="/officer/tenders" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1">
              Manage All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Tender</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)] hidden sm:table-cell">Category</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Reqs</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Bids</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Closing</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)] hidden md:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tenders.map((t: any) => {
                  const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={t.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-3">
                        <Link href={`/officer/tenders/${t.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] block max-w-xs truncate">{t.title}</Link>
                        <div className="text-xs text-[var(--foreground-tertiary)]">{t.tenderNumber}</div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell"><span className="badge badge-blue text-[10px]">{t.category || "—"}</span></td>
                      <td className="px-5 py-3 text-[var(--foreground-secondary)]">{t._count?.requirements || 0}</td>
                      <td className="px-5 py-3 text-[var(--foreground-secondary)]">{t._count?.bids || 0}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-[var(--danger)]" : daysLeft <= 14 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                          {daysLeft > 0 ? `${daysLeft}d` : "Closed"}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell"><span className="badge badge-yellow text-[10px]">{t.dataLabel || "DEMO"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions + Notifications */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/officer/tenders" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] rounded-lg p-2 transition-colors">
                <FileText className="w-4 h-4 text-[var(--accent)]" /> Manage Tenders
              </Link>
              <Link href="/officer/verification" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] rounded-lg p-2 transition-colors">
                <ClipboardCheck className="w-4 h-4 text-[var(--warning)]" /> Verification Queue
              </Link>
              <Link href="/officer/compliance" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] rounded-lg p-2 transition-colors">
                <Scale className="w-4 h-4 text-[var(--success)]" /> Compliance Matrix
              </Link>
              <Link href="/officer/reports" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] rounded-lg p-2 transition-colors">
                <BarChart3 className="w-4 h-4 text-[var(--accent)]" /> Reports
              </Link>
              <Link href="/officer/audit" className="flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)] rounded-lg p-2 transition-colors">
                <Shield className="w-4 h-4 text-[var(--danger)]" /> Audit Trail
              </Link>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--foreground)]">Recent Activity</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {data.notifications.notifications.slice(0, 5).map((n: any) => (
                <div key={n.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">{n.title}</div>
                  <div className="text-xs text-[var(--foreground-secondary)] mt-0.5">{n.body}</div>
                </div>
              ))}
              {data.notifications.notifications.length === 0 && (
                <div className="px-5 py-4 text-sm text-[var(--foreground-tertiary)] text-center">No recent activity</div>
              )}
            </div>
          </div>

          {/* Data Source Notice */}
          <div className="bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[var(--warning)] text-xs font-semibold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Demo Mode Active
            </div>
            <p className="text-xs text-[var(--warning)]">
              All tender and verification data is simulated. Connect real APIs in Admin → Settings for live data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
