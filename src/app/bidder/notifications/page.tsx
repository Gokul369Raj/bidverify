"use client";
import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, Trash2, X } from "lucide-react";

export default function BidderNotificationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/notifications");
    const d = await res.json();
    if (d.ok) setData(d.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) });
    load();
  }

  async function deleteNotification(id: string) {
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    load();
  }

  async function deleteAll() {
    if (!confirm("Delete all notifications?")) return;
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteAll: true }) });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading...</div></div>;

  const kindIcon = (kind: string) => {
    if (kind === "SUCCESS") return <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />;
    if (kind === "WARNING") return <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />;
    if (kind === "ERROR") return <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />;
    return <Info className="w-4 h-4 text-[var(--accent)]" />;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Notifications</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">{data?.unread || 0} unread · {data?.notifications?.length || 0} total</p>
        </div>
        <div className="flex items-center gap-3">
          {data?.unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-[var(--accent)] hover:opacity-80 cursor-pointer">Mark all read</button>
          )}
          {data?.notifications?.length > 0 && (
            <button onClick={deleteAll} className="text-xs text-[var(--danger)] hover:opacity-80 cursor-pointer flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      </div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
        {(data?.notifications || []).map((n: any) => (
          <div key={n.id} className={`px-5 py-3 flex items-start gap-3 group ${!n.read ? "bg-[var(--accent)]/5" : ""}`}>
            <div className="mt-0.5">{kindIcon(n.kind)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--foreground)]">{n.title}</div>
              <div className="text-xs text-[var(--foreground-secondary)] mt-0.5 whitespace-pre-line">{n.body}</div>
              <div className="text-[10px] text-[var(--foreground-tertiary)] mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
              <button onClick={() => deleteNotification(n.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--foreground-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-all cursor-pointer" title="Delete">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(!data?.notifications || data.notifications.length === 0) && (
          <div className="px-5 py-10 text-center">
            <Bell className="w-8 h-8 text-[var(--foreground-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--foreground-tertiary)]">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}
