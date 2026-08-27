"use client";
import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function OfficerNotificationsPage() {
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[#a1a1a6] animate-pulse">Loading...</div></div>;

  const kindIcon = (kind: string) => {
    if (kind === "SUCCESS") return <CheckCircle2 className="w-4 h-4 text-[#30d158]" />;
    if (kind === "WARNING") return <AlertTriangle className="w-4 h-4 text-[#ffd60a]" />;
    return <Info className="w-4 h-4 text-[#2997ff]" />;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-[#a1a1a6] mt-1">{data?.unread || 0} unread</p>
        </div>
        {data?.unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-[#2997ff] hover:text-[#64b5ff]">Mark all read</button>
        )}
      </div>
      <div className="bg-[#161617] border border-white/10 rounded-xl divide-y divide-white/10">
        {(data?.notifications || []).map((n: any) => (
          <div key={n.id} className={`px-5 py-4 flex items-start gap-3 ${!n.read ? "bg-[#2997ff]/12/30" : ""}`}>
            <div className="mt-0.5">{kindIcon(n.kind)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{n.title}</div>
              <div className="text-xs text-[#a1a1a6] mt-0.5">{n.body}</div>
              <div className="text-[10px] text-[#86868b] mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />}
          </div>
        ))}
        {(!data?.notifications || data.notifications.length === 0) && <div className="px-5 py-10 text-center text-sm text-[#86868b]">No notifications</div>}
      </div>
    </div>
  );
}
