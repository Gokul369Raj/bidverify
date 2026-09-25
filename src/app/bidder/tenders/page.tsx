"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, Clock, MapPin, Tag, ArrowRight, Bookmark, BookmarkCheck, X, Sparkles } from "lucide-react";

export default function BidderTendersPage() {
  const [query, setQuery] = useState("");
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ state: "", category: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [nlMode, setNlMode] = useState(false);
  const [interpretation, setInterpretation] = useState<any>(null);

  async function search(q?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q ?? query, ...filters, limit: 50 }),
      });
      const data = await res.json();
      if (data.ok) {
        setTenders(data.data.tenders);
        setInterpretation(data.data.aiInterpretation);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { search(""); }, []);

  if (loading && tenders.length === 0) return (
    <div className="space-y-4">
      <div className="h-10 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-32 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Search Tenders</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Find active government tenders. Try natural language like &quot;industrial pumps in Tamil Nadu&quot;
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={nlMode ? "e.g. Find MSME-friendly solar equipment tenders closing this week..." : "Search by tender ID, title, or keyword..."}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setNlMode(!nlMode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${nlMode ? "bg-[var(--navy-100)] border-[var(--navy-500)] text-[var(--navy-700)]" : "border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)]"}`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${showFilters ? "bg-[var(--surface-2)] border-[var(--border)]" : "border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)]"}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button onClick={() => search()} className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              Search
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--foreground-secondary)] mb-1 block">State</label>
              <input value={filters.state} onChange={(e) => setFilters((p) => ({ ...p, state: e.target.value }))} className="w-full px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm" placeholder="Any state" />
            </div>
            <div>
              <label className="text-xs text-[var(--foreground-secondary)] mb-1 block">Category</label>
              <input value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm" placeholder="Any category" />
            </div>
          </div>
        )}

        {/* AI Interpretation */}
        {interpretation && nlMode && (
          <div className="mt-3 bg-[var(--navy-50)] border border-[var(--navy-200)] rounded-[var(--radius)] px-4 py-2.5 text-xs text-[var(--navy-700)]">
            <span className="font-semibold">AI interpreted:</span>{" "}
            {interpretation.state && <span>State: {interpretation.state} · </span>}
            {interpretation.category && <span>Category: {interpretation.category} · </span>}
            {interpretation.msmeFriendly && <span>MSME Friendly · </span>}
            {interpretation.keywords?.length > 0 && <span>Keywords: {interpretation.keywords.join(", ")}</span>}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {loading && <div className="text-center py-10 text-sm text-[var(--foreground-tertiary)] animate-pulse">Searching...</div>}
        {!loading && tenders.length === 0 && (
          <div className="text-center py-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <Search className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--foreground-secondary)]">No tenders found. Try a different search.</p>
          </div>
        )}
        {tenders.map((t: any) => {
          const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
          async function toggleSave(e: React.MouseEvent) {
            e.preventDefault();
            e.stopPropagation();
            const res = await fetch(`/api/tenders/${t.id}/save`, { method: "POST" });
            const data = await res.json();
            if (data.ok) setTenders((prev) => prev.map((tt) => tt.id === t.id ? { ...tt, saved: data.data.saved } : tt));
          }
          return (
            <Link key={t.id} href={`/bidder/tenders/${t.id}`} className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[var(--foreground-tertiary)] font-mono">{t.tenderNumber}</span>
                    {t.dataLabel === "DEMO_SIMULATED" && <span className="badge badge-yellow text-[10px]">DEMO</span>}
                  </div>
                  <h3 className="font-semibold text-[var(--foreground)] mb-1 line-clamp-1">{t.title}</h3>
                  <div className="text-sm text-[var(--foreground-secondary)] mb-2">{t.buyerOrganization}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-tertiary)]">
                    {t.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{t.category}</span>}
                    {(t.state || t.city) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[t.city, t.state].filter(Boolean).join(", ")}</span>}
                    {t.estimatedValueLakh && <span>Est. ₹{t.estimatedValueLakh.toLocaleString()}L</span>}
                    {t._count?.requirements > 0 && <span>{t._count.requirements} requirements</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                  <button onClick={toggleSave} className="p-1 hover:bg-[var(--surface-2)] rounded-lg transition-colors" title={t.saved ? "Unsave" : "Save tender"}>
                    {t.saved ? <BookmarkCheck className="w-5 h-5 text-[var(--warning)]" /> : <Bookmark className="w-5 h-5 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]" />}
                  </button>
                  <div className={`text-lg font-bold ${daysLeft <= 7 ? "text-[var(--danger)]" : daysLeft <= 14 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                    {daysLeft > 0 ? `${daysLeft}d` : "Closed"}
                  </div>
                  <div className="text-xs text-[var(--foreground-tertiary)]">closing</div>
                  <div className="mt-1 text-[var(--accent)]">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
