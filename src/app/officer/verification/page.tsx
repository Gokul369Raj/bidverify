"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Play, Loader2, Shield, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function OfficerVerificationQueuePage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTenders(d.data.tenders); setLoading(false); });
  }, []);

  const allBids = tenders.flatMap((t) => (t.bids || []).map((b: any) => ({ ...b, tender: t })));
  const riskRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const pending = allBids
    .filter((b) => b.status === "SUBMITTED" || b.status === "UNDER_VERIFICATION" || b.status === "DRAFT")
    .sort((a, b) =>
      ((riskRank[a.riskLevel ?? "LOW"] ?? 4) - (riskRank[b.riskLevel ?? "LOW"] ?? 4)) ||
      ((a.complianceScore ?? 100) - (b.complianceScore ?? 100)),
    );
  const highRisk = allBids.filter((b) => b.riskLevel === "HIGH" || b.riskLevel === "CRITICAL");

  async function runVerification(bidId: string) {
    setVerifying(bidId);
    await fetch(`/api/bids/${bidId}/verify`, { method: "POST" });
    setVerifying(null);
    const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) });
    const d = await res.json();
    if (d.ok) setTenders(d.data.tenders);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading queue...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Verification Queue</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Bids pending verification.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{pending.length}</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Pending</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{highRisk.length}</div>
              <div className="text-xs text-[var(--foreground-secondary)]">High Risk</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Play className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Verified</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">0</div>
              <div className="text-xs text-[var(--foreground-secondary)]">Total</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[var(--foreground)] mb-3">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-secondary)]">No pending verifications.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((b: any) => (
              <div key={b.id} className="bg-[var(--surface)] border-b border-[var(--border)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="font-medium text-[var(--foreground)]">{b.organization?.legalName || "—"}</span>
                <span className="text-sm text-[var(--foreground-secondary)]">{b.bidNumber} · {b.tender?.tenderNumber}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => runVerification(b.id)} disabled={verifying === b.id} className="bg-[var(--warning)] text-white text-sm px-3 py-1 rounded">
                    {verifying === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Verify
                  </button>
                  <Link href={`/officer/verification/${b.id}`} className="text-[var(--accent)] text-sm"><ArrowRight className="w-3 h-3" /></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
