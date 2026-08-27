"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function BidderBidsPage() {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const allBids = (d.data.tenders || []).flatMap((t: any) => (t.bids || []).map((b: any) => ({ ...b, tender: t })));
          setBids(allBids);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading bids...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">My Bids</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Track your bid submissions and their verification status.</p>
      </div>

      {bids.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center">
          <FileText className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
          <h3 className="font-semibold text-[var(--foreground)] mb-1">No bids yet</h3>
          <p className="text-sm text-[var(--foreground-secondary)] mb-4">Start by searching for tenders and submitting a bid.</p>
          <Link href="/bidder/tenders" className="text-sm text-[var(--accent)] hover:opacity-80 font-medium">Browse Tenders →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bids.map((b: any) => (
            <div key={b.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[var(--foreground-tertiary)] font-mono mb-1">{b.bidNumber}</div>
                  <h3 className="font-medium text-[var(--foreground)] mb-1">{b.tender?.title || "Tender"}</h3>
                  <p className="text-xs text-[var(--foreground-secondary)]">{b.tender?.tenderNumber}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`badge text-[10px] ${b.status === "VERIFIED" ? "badge-green" : b.status === "SUBMITTED" ? "badge-purple" : b.status === "DECIDED" ? "badge-blue" : "badge-gray"}`}>{b.status}</span>
                    {b.complianceScore != null && <span className="text-xs font-semibold text-[var(--foreground-secondary)]">Score: {b.complianceScore}/100</span>}
                    {b.riskLevel && <span className={`badge text-[10px] ${b.riskLevel === "LOW" ? "badge-green" : b.riskLevel === "MEDIUM" ? "badge-yellow" : "badge-red"}`}>{b.riskLevel} risk</span>}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0 mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
