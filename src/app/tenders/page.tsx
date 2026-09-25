"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import GovtFooter from "@/components/GovtFooter";
import LoginModal from "@/components/LoginModal";
import { useSession } from "@/lib/useSession";
import {
  Search, Building2, MapPin, IndianRupee, Loader2,
  ChevronDown, ChevronUp, ArrowLeft, SlidersHorizontal,
} from "lucide-react";

interface PublicTender {
  id: string; tenderNumber: string; title: string; description: string;
  buyerOrganization: string; category: string | null; state: string | null;
  city: string | null; closingDate: string; estimatedValueLakh: number | null;
  status: string; requirementCount: number; bidCount: number;
}

type SortKey = "closing" | "newest" | "value";

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function TenderExplorerPage() {
  const { user: loggedInUser, loading: authLoading } = useSession();
  const [tenders, setTenders] = useState<PublicTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<SortKey>("closing");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    fetch("/api/public/tenders?limit=50")
      .then(r => r.json())
      .then(d => { if (d.ok) setTenders(d.data.tenders); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Debounced instant search
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { void fetchTenders(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, state]);

  async function fetchTenders() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    if (state) params.set("state", state);
    params.set("limit", "50");
    try {
      const res = await fetch(`/api/public/tenders?${params}`);
      const data = await res.json();
      if (data.ok) setTenders(data.data.tenders);
    } catch {}
    setLoading(false);
  }

  async function expand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!details[id]) {
      setLoadingDetail(id);
      try {
        const res = await fetch(`/api/public/tenders/${id}`);
        const data = await res.json();
        if (data.ok) setDetails(prev => ({ ...prev, [id]: data.data }));
      } catch {}
      setLoadingDetail(null);
    }
  }

  const categories = [...new Set(tenders.map(t => t.category).filter(Boolean))];
  const states = [...new Set(tenders.map(t => t.state).filter(Boolean))];

  const visible = [...tenders].sort((a, b) => {
    if (sort === "closing") return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime();
    if (sort === "value") return (b.estimatedValueLakh ?? 0) - (a.estimatedValueLakh ?? 0);
    return new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime();
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteNav onSignIn={() => setShowLogin(true)} />

      {/* Page header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 pt-16 pb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="display-2">Explore Tenders.</h1>
          <p className="subhead mt-2">
            {loading ? "Loading live listings…" : `${visible.length} open ${visible.length === 1 ? "tender" : "tenders"} across departments and states.`}
          </p>

          {/* Search + filters */}
          <div className="mt-8 card-flat p-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              {loading ? (
                <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin absolute left-4 top-1/2 -translate-y-1/2" />
              ) : (
                <Search className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-4 top-1/2 -translate-y-1/2" />
              )}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by tender ID, title, department…"
                aria-label="Search tenders"
                className="input-field !pl-11 !pr-10"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--foreground-secondary)] flex items-center justify-center text-xs cursor-pointer transition-colors">
                  ×
                </button>
              )}
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category" className="input-field !w-auto cursor-pointer">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c!}>{c}</option>)}
            </select>
            <select value={state} onChange={e => setState(e.target.value)} aria-label="Filter state" className="input-field !w-auto cursor-pointer">
              <option value="">All States</option>
              {states.map(s => <option key={s} value={s!}>{s}</option>)}
            </select>
            <div className="relative">
              <SlidersHorizontal className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort" className="input-field !w-auto !pl-10 cursor-pointer">
                <option value="closing">Closing soonest</option>
                <option value="newest">Newest</option>
                <option value="value">Highest value</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Listings */}
      <main className="max-w-[1100px] mx-auto px-6 py-12">
        {loading ? (
          <div className="space-y-5" aria-busy="true" aria-label="Loading tenders">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="card-flat p-7 space-y-3">
                <div className="skeleton h-4 w-44" />
                <div className="skeleton h-6 w-3/4" />
                <div className="skeleton h-3 w-full" />
                <div className="flex gap-3"><div className="skeleton h-3 w-32" /><div className="skeleton h-3 w-24" /></div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card-flat py-24 text-center">
            <Search className="w-9 h-9 text-[var(--foreground-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--foreground)] text-lg font-medium">No tenders match &ldquo;{search || "your filters"}&rdquo;</p>
            <p className="text-[15px] text-[var(--foreground-secondary)] mt-2 max-w-md mx-auto">
              Try a shorter term or a tender number like <span className="font-mono text-[var(--foreground-secondary)]">CPCL/PUMP</span>.
            </p>
            {(search || category || state) && (
              <button onClick={() => { setSearch(""); setCategory(""); setState(""); }} className="btn-ghost !text-sm mt-6 cursor-pointer">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {visible.map(t => {
              const days = daysUntil(t.closingDate);
              const isOpen = expanded === t.id;
              const detail = details[t.id] as Record<string, unknown> | undefined;
              const reqs = (detail?.requirements ?? []) as Array<Record<string, unknown>>;
              const closed = days <= 0;

              return (
                <article key={t.id} className="card-flat overflow-hidden pressable hover:border-[var(--border)] transition-colors">
                  <button onClick={() => expand(t.id)} className="w-full text-left p-7 cursor-pointer" aria-expanded={isOpen}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0">
                        <span className="font-mono text-[12px] text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1 rounded-md">{t.tenderNumber}</span>
                        <h2 className="headline !text-[21px] mt-3 mb-2 line-clamp-1">{t.title}</h2>
                        <p className="text-[15px] text-[var(--foreground-secondary)] line-clamp-2 mb-4 max-w-2xl">{t.description || "No description provided."}</p>
                        <div className="flex items-center gap-5 text-[13px] text-[var(--foreground-tertiary)] flex-wrap">
                          <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {t.buyerOrganization}</span>
                          {(t.state || t.city) && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {[t.city, t.state].filter(Boolean).join(", ")}</span>}
                          {t.estimatedValueLakh && <span className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" /> ₹{t.estimatedValueLakh.toLocaleString()} L</span>}
                          <span>{t.requirementCount} requirements</span>
                          <span>{t.bidCount} bids</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <span className={`text-[15px] font-semibold ${closed ? "text-[var(--foreground-tertiary)]" : "text-[var(--foreground)]"}`}>
                          {closed ? "Closed" : `${days}d left`}
                        </span>
                        {!closed && (
                          <div className="w-20 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)] rounded-full"
                              style={{ width: `${Math.max(4, Math.min(100, (days / 30) * 100))}%` }}
                            />
                          </div>
                        )}
                        <span className="text-[11px] text-[var(--foreground-tertiary)]">
                          Closes {new Date(t.closingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--border-light)] flex items-center justify-between">
                      <span className="link-apple text-[14px] inline-flex items-center gap-1">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isOpen ? "Hide requirements" : "View requirements"}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-7 pb-7">
                      {loadingDetail === t.id ? (
                        <div className="space-y-2" aria-busy="true">
                          <div className="skeleton h-12 rounded-xl" />
                          <div className="skeleton h-12 rounded-xl" />
                        </div>
                      ) : reqs.length > 0 ? (
                        <>
                          <div className="grid md:grid-cols-2 gap-2 mb-5">
                            {reqs.map((r, i) => (
                              <div key={i} className="flex items-start gap-2.5 text-[13px] bg-[var(--surface-2)] p-3.5 rounded-xl border border-[var(--border-light)]">
                                <span className={`mt-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${r.mandatory ? "bg-[var(--accent-light)] text-[var(--accent)]" : "bg-[var(--border-light)] text-[var(--foreground-tertiary)]"}`}>
                                  {r.mandatory ? "M" : "O"}
                                </span>
                                <span className="text-[var(--foreground-secondary)]">{String(r.title)}</span>
                              </div>
                            ))}
                          </div>
                          {!authLoading && loggedInUser ? (
                            <Link href={`/bidder/tenders/${t.id}`} className="btn-primary !py-2.5 !px-6 !text-sm inline-flex">
                              Apply Now
                            </Link>
                          ) : (
                            <button onClick={() => setShowLogin(true)} className="btn-primary !py-2.5 !px-6 !text-sm cursor-pointer">
                              Login to Apply
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-[13px] text-[var(--foreground-tertiary)] py-2">Requirements are being analysed — check back shortly.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Bottom band image for depth */}
        <div className="mt-16 relative rounded-[28px] overflow-hidden border border-[var(--border)]">
          <Image
            src="https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1600&h=500&fit=crop"
            alt="Government office architecture"
            width={1600}
            height={500}
            sizes="(max-width: 768px) 100vw, 1050px"
            loading="lazy"
            className="w-full h-56 object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/80 to-transparent" />
          <p className="absolute bottom-5 left-6 text-sm text-[var(--foreground)]/85">
            New tenders published every week across CPSEs and state departments.
          </p>
        </div>
      </main>

      <GovtFooter />

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
