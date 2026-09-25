"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  BarChart3,
  Loader2,
  Search,
  Users,
  TrendingUp,
  ArrowLeft,
  Eye,
} from "lucide-react";

interface ComparisonItem {
  requirementCode: string;
  requirementTitle: string;
  result: string;
  explanation: string;
  document: { fileName: string; docType: string } | null;
}

interface ComparisonSummary {
  totalRequirements: number;
  passed: number;
  failed: number;
  underReview: number;
  verificationUnavailable: number;
  complianceScore: number;
  riskLevel: string;
}

function ComparisonInner() {
  const searchParams = useSearchParams();
  const bidId = searchParams.get("bidId") ?? "";
  const [bid, setBid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary>({
    totalRequirements: 0,
    passed: 0,
    failed: 0,
    underReview: 0,
    verificationUnavailable: 0,
    complianceScore: 0,
    riskLevel: "LOW",
  });

  useEffect(() => {
    if (!bidId) {
      // No bid selected — stop the spinner so the empty state can render.
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/bids/${bidId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          // The endpoint returns { bid, tender }; fold the tender in so the
          // comparison builder can read `bid.tender.requirements`.
          const composed = { ...d.data.bid, tender: d.data.tender };
          setBid(composed);
          // Build from the freshly fetched bid — `bid` state is still null in
          // this tick, so reading it here would always bail out.
          initializeComparison(composed);
        }
      })
      .catch(() => { /* fall through to the empty state */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId]);

  const initializeComparison = (b: any) => {
    if (!b) return;

    const evaluations = b.complianceResults || [];
    const mandatoryMap = new Map(
      (b.tender?.requirements || []).map((r: any) => [r.id, r.mandatory])
    );

    const counts = { total: 0, passed: 0, failed: 0, underReview: 0, verificationUnavailable: 0 };
    const items: ComparisonItem[] = [];

    for (const ev of evaluations) {
      const req = b.tender?.requirements?.find((r: any) => r.id === ev.requirementId);
      if (!req) continue;

      counts.total++;
      const result = ev.result;
      if (result === "PASS") counts.passed++;
      else if (result === "FAIL") counts.failed++;
      else if (
        result === "REVIEW" ||
        result === "VERIFICATION_UNAVAILABLE" ||
        result === "INSUFFICIENT_EVIDENCE"
      )
        counts.underReview++;

      // Get document info
      const doc = b.documents?.find((d: any) => d.id === ev.evidence?.[0]?.documentId);

      items.push({
        requirementCode: ev.ruleCode || ev.code || req.code || "",
        requirementTitle: req?.title || ev.code || "Unknown requirement",
        result,
        explanation: ev.details?.finding || ev.explanation || "",
        document: doc ? { fileName: doc.fileName, docType: doc.docType } : null,
      });
    }

    const complianceScore = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0;
    const riskLevel = complianceScore >= 80 ? "LOW" : complianceScore >= 60 ? "MEDIUM" : "HIGH";

    setComparison(items);
    setSummary({
      totalRequirements: counts.total,
      passed: counts.passed,
      failed: counts.failed,
      underReview: counts.underReview,
      verificationUnavailable: counts.verificationUnavailable,
      complianceScore,
      riskLevel,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2.5 text-[var(--foreground-secondary)]">
      <Loader2 className="w-5 h-5 animate-spin text-[var(--navy-700)]" aria-hidden="true" />
      <span className="text-sm">Loading comparison…</span>
    </div>
  );

  if (!bid) return (
    <div className="govt-panel max-w-lg mx-auto my-10 p-10 text-center">
      <span className="w-12 h-12 rounded-full bg-[var(--navy-100)] flex items-center justify-center mx-auto mb-4">
        <FileText className="w-6 h-6 text-[var(--navy-700)]" aria-hidden="true" />
      </span>
      <h2 className="text-[17px] font-bold text-[var(--navy-800)] mb-1.5">No bid selected</h2>
      <p className="text-[13.5px] text-[var(--foreground-secondary)] leading-relaxed mb-5">
        Open a bid from the verification queue or a tender&apos;s bid list to see its
        requirement-wise compliance comparison.
      </p>
      <Link href="/officer/verification" className="btn btn-navy btn-sm">
        Go to Verification Queue
      </Link>
    </div>
  );

  const isPassing = summary.complianceScore >= 70;
  const scoreBadgeClassName = isPassing
    ? "bg-[var(--green-100)] text-green-800 text-sm font-medium px-3 py-1 rounded border border-green-300"
    : "bg-[var(--red-100)] text-red-800 text-sm font-medium px-3 py-1 rounded border border-red-300";

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Bid Comparison — {bid.bidNumber}</h1>
            <div className="text-sm text-[var(--foreground-tertiary)]">Tender: {bid.tender?.tenderNumber} — {bid.tender?.title}</div>
            <div className="mt-2">
              <span className={scoreBadgeClassName}>
                Compliance Score: {summary.complianceScore}/100 {isPassing ? "(Passing)" : "(Requires Review)"}
              </span>
            </div>
          </div>
          <div className="w-16 h-16 bg-[var(--surface-3)] rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-8 h-8 text-[var(--foreground-secondary)]" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--surface-3)] rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[var(--green-600)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{summary.passed}</div>
              <div className="text-xs text-[var(--foreground-tertiary)]">Passed</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--surface-3)] rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#ffd60a]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{summary.failed}</div>
              <div className="text-xs text-[var(--foreground-tertiary)]">Failed</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--surface-3)] rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#ffd60a]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{summary.underReview}</div>
              <div className="text-xs text-[var(--foreground-tertiary)]">Under Review</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--surface-3)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-[var(--foreground-secondary)]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--foreground)]">{summary.totalRequirements}</div>
              <div className="text-xs text-[var(--foreground-tertiary)]">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Requirements Comparison Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] px-4 py-3">Requirement-wise Compliance Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--foreground-tertiary)]">
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3 text-right">Result</th>
                <th className="px-4 py-3">Explanation</th>
                <th className="px-4 py-3">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {comparison.map((item, i) => {
                const resultClass =
                  item.result === "PASS"
                    ? "text-[var(--green-600)]"
                    : item.result === "FAIL"
                      ? "text-[var(--danger)]"
                      : "text-[#ffd60a]";
                const resultBadge = item.result === "PASS"
                  ? <span className="bg-[var(--green-100)] text-green-800 text-xs px-2 py-0.5 rounded">PASS</span>
                  : item.result === "FAIL"
                    ? <span className="bg-[var(--red-100)] text-red-800 text-xs px-2 py-0.5 rounded">FAIL</span>
                    : <span className="bg-[#ffd60a]/20 text-amber-800 text-xs px-2 py-0.5 rounded">REVIEW</span>;

                return (
                  <tr key={i} className="hover:bg-[var(--navy-50)]">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{item.requirementTitle}</td>
                    <td className="px-4 py-3 text-right">
                      {resultBadge}
                      <div className="text-xs text-[var(--foreground-tertiary)] mt-1">{item.explanation.slice(0, 100)}...</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-secondary)]">{item.explanation}</td>
                    <td className="px-4 py-3">
                      {item.document ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--foreground-tertiary)]">{item.document.docType}</span>
                          <a href={`/officer/verification/${bid.id}`} className="text-[var(--navy-600)] underline text-xs">
                            View details
                          </a>
                        </div>
                      ) : (
                        <span className="text-[var(--foreground-tertiary)] text-xs">No document</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-4">AI Recommendation</h2>
        <p className="font-medium text-[var(--foreground)]">
          {summary.riskLevel === "LOW"
            ? "Recommend proceeding to technical evaluation"
            : summary.riskLevel === "MEDIUM"
              ? "Manual review required before decision"
              : "High risk — officer approval required"}
        </p>
        <p className="text-sm text-[var(--foreground-tertiary)] mt-1">
          Compliance score {summary.complianceScore}/100 based on {summary.totalRequirements} requirements evaluated.
        </p>
      </div>

      {/* Quick Navigation */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/officer/verification/${bid.id}`}
            className="flex items-center gap-2 bg-[var(--navy-800)] text-white rounded-lg px-4 py-2 text-sm hover:bg-[var(--navy-600)] transition-colors"
          >
            <FileText className="w-4 h-4" /> View Full Verification
          </Link>
          <Link
            href="/officer/tenders"
            className="flex items-center gap-2 bg-[var(--gray-600)] text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tenders
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-tertiary)] animate-pulse">Loading…</div></div>}>
      <ComparisonInner />
    </Suspense>
  );
}
