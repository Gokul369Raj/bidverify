"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ArrowRight, MapPin, Tag, Clock, Search } from "lucide-react";

export default function SavedTendersPage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", saved: true, limit: 50 }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTenders(d.data.tenders.filter((t: any) => t.saved)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function unsaveTender(tenderId: string) {
    await fetch(`/api/tenders/${tenderId}/save`, { method: "POST" });
    setTenders((prev) => prev.filter((t) => t.id !== tenderId));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading saved tenders...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Saved Tenders</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Tenders you have bookmarked for later review.</p>
      </div>

      {tenders.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center">
          <Bookmark className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
          <h3 className="font-semibold text-[var(--foreground)] mb-1">No saved tenders</h3>
          <p className="text-sm text-[var(--foreground-secondary)] mb-4">Browse tenders and save the ones you are interested in.</p>
          <Link href="/bidder/tenders" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">Browse Tenders →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tenders.map((t: any) => {
            const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
            return (
              <div key={t.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/bidder/tenders/${t.id}`} className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--foreground-tertiary)] font-mono mb-1">{t.tenderNumber}</div>
                    <h3 className="font-semibold text-[var(--foreground)] mb-1 line-clamp-1">{t.title}</h3>
                    <p className="text-sm text-[var(--foreground-secondary)] mb-2">{t.buyerOrganization}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-tertiary)]">
                      {t.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{t.category}</span>}
                      {(t.state || t.city) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[t.city, t.state].filter(Boolean).join(", ")}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{daysLeft > 0 ? `${daysLeft}d left` : "Closed"}</span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => unsaveTender(t.id)} className="text-[var(--warning)] hover:text-[var(--warning)] p-1" title="Remove from saved">
                      <Bookmark className="w-5 h-5 fill-current" />
                    </button>
                    <Link href={`/bidder/tenders/${t.id}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
