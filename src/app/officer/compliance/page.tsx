"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, ArrowRight } from "lucide-react";

export default function OfficerCompliancePage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTenders(d.data.tenders); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Compliance Matrix</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Compare compliance scores across all bidders per tender.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]" id="totalBids">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Total Bids</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]" id="avgScore">—</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Avg Score</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]" id="highRisk">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">High Risk</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]" id="passedReq">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Passed</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]" id="reviews">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Under Review</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tenders.map((t) => {
          const bids = t.bids || [];
          if (bids.length === 0) return null;
          return (
            <div key={t.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="font-semibold text-[var(--foreground)] mb-3">{t.title}</h2>
              <p className="text-sm text-[var(--foreground-secondary)]">Tender: {t.tenderNumber}</p>
              {bids.map((b: any) => (
                <div key={b.id} className="border-b border-[var(--border)] pb-3 mb-3">
                  <span className="font-medium text-[var(--foreground)]">{b.organization?.legalName || "—"}</span>
                  <span className="text-right text-sm">
                    <span className="font-semibold text-[var(--foreground)]">{b.complianceScore ?? 0}/100</span>
                    <span className="text-xs text-[var(--foreground-secondary)] ml-2">{b.riskLevel || "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {tenders.filter((t) => (t.bids || []).length > 0).length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
            <Scale className="w-10 h-10 text-[var(--foreground-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-secondary)]">No compliance data yet. Bids appear here after verification.</p>
          </div>
        )}
      </div>
    </div>
  );
}
