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
    if (!bidId) return;
    fetch(`/api/bids/${bidId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBid(d.data);
          initializeComparison();
        }
      });
  }, [bidId]);

  const initializeComparison = () => {
    if (!bid) return;

    const evaluations = bid.complianceResults || [];
    const mandatoryMap = new Map(
      (bid.tender?.requirements || []).map((r: any) => [r.id, r.mandatory])
    );

    const counts = { total: 0, passed: 0, failed: 0, underReview: 0, verificationUnavailable: 0 };
    const items: ComparisonItem[] = [];

    for (const ev of evaluations) {
      const req = bid.tender?.requirements?.find((r: any) => r.id === ev.requirementId);
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
      const doc = bid.documents?.find((d: any) => d.id === ev.evidence?.[0]?.documentId);

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

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="text-sm text-[#a1a1a6] animate-pulse">Loading comparison...</div>
  </div>;

  if (!bid) return <div className="text-center py-20 text-[#a1a1a6]">Bid not found</div>;

  const isPassing = summary.complianceScore >= 70;
  const scoreBadgeClassName = isPassing
    ? "bg-[#30d158]/20 text-green-800 text-sm font-medium px-3 py-1 rounded border border-green-300"
    : "bg-[#ff453a]/20 text-red-800 text-sm font-medium px-3 py-1 rounded border border-red-300";

  return (
    <div className="space-y-6">
      <div className="bg-[#161617] border border-white/10 rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white">Bid Comparison — {bid.bidNumber}</h1>
            <div className="text-sm text-[#a1a1a6]">Tender: {bid.tender?.tenderNumber} — {bid.tender?.title}</div>
            <div className="mt-2">
              <span className={scoreBadgeClassName}>
                Compliance Score: {summary.complianceScore}/100 {isPassing ? "(Passing)" : "(Requires Review)"}
              </span>
            </div>
          </div>
          <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-8 h-8 text-[#c7c7cc]" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-[#161617] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#30d158]" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{summary.passed}</div>
              <div className="text-xs text-[#a1a1a6]">Passed</div>
            </div>
          </div>
        </div>
        <div className="bg-[#161617] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#ffd60a]" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{summary.failed}</div>
              <div className="text-xs text-[#a1a1a6]">Failed</div>
            </div>
          </div>
        </div>
        <div className="bg-[#161617] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#ffd60a]" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{summary.underReview}</div>
              <div className="text-xs text-[#a1a1a6]">Under Review</div>
            </div>
          </div>
        </div>
        <div className="bg-[#161617] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-[#c7c7cc]" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{summary.totalRequirements}</div>
              <div className="text-xs text-[#a1a1a6]">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Requirements Comparison Table */}
      <div className="bg-[#161617] border border-white/10 rounded-xl overflow-hidden">
        <div className="border-b border-white/10">
          <h2 className="font-semibold text-white px-4 py-3">Requirement-wise Compliance Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-[#a1a1a6]">
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3 text-right">Result</th>
                <th className="px-4 py-3">Explanation</th>
                <th className="px-4 py-3">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {comparison.map((item, i) => {
                const resultClass =
                  item.result === "PASS"
                    ? "text-[#30d158]"
                    : item.result === "FAIL"
                      ? "text-[#ff6961]"
                      : "text-[#ffd60a]";
                const resultBadge = item.result === "PASS"
                  ? <span className="bg-[#30d158]/20 text-green-800 text-xs px-2 py-0.5 rounded">PASS</span>
                  : item.result === "FAIL"
                    ? <span className="bg-[#ff453a]/20 text-red-800 text-xs px-2 py-0.5 rounded">FAIL</span>
                    : <span className="bg-[#ffd60a]/20 text-amber-800 text-xs px-2 py-0.5 rounded">REVIEW</span>;

                return (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{item.requirementTitle}</td>
                    <td className="px-4 py-3 text-right">
                      {resultBadge}
                      <div className="text-xs text-[#a1a1a6] mt-1">{item.explanation.slice(0, 100)}...</div>
                    </td>
                    <td className="px-4 py-3 text-[#c7c7cc]">{item.explanation}</td>
                    <td className="px-4 py-3">
                      {item.document ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#86868b]">{item.document.docType}</span>
                          <a href={`/officer/verification/${bid.id}`} className="text-[#2997ff] underline text-xs">
                            View details
                          </a>
                        </div>
                      ) : (
                        <span className="text-[#86868b] text-xs">No document</span>
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
      <div className="bg-[#161617] border border-white/10 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-4">AI Recommendation</h2>
        <p className="font-medium text-white">
          {summary.riskLevel === "LOW"
            ? "Recommend proceeding to technical evaluation"
            : summary.riskLevel === "MEDIUM"
              ? "Manual review required before decision"
              : "High risk — officer approval required"}
        </p>
        <p className="text-sm text-[#a1a1a6] mt-1">
          Compliance score {summary.complianceScore}/100 based on {summary.totalRequirements} requirements evaluated.
        </p>
      </div>

      {/* Quick Navigation */}
      <div className="bg-[#161617] border border-white/10 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/officer/verification/${bid.id}`}
            className="flex items-center gap-2 bg-blue-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-[#64b5ff] transition-colors"
          >
            <FileText className="w-4 h-4" /> View Full Verification
          </Link>
          <Link
            href="/officer/tenders"
            className="flex items-center gap-2 bg-slate-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
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
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-sm text-[#a1a1a6] animate-pulse">Loading…</div></div>}>
      <ComparisonInner />
    </Suspense>
  );
}
