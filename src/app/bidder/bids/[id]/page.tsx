"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, AlertTriangle, Loader2, Shield,
  Building2, Clock, Target, Info, FileCheck, XCircle, Scale
} from "lucide-react";

export default function BidderBidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bid, setBid] = useState<any>(null);
  const [tender, setTender] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bids/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setBid(d.data.bid); setTender(d.data.tender); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading bid details...</div></div>;
  if (!bid) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Bid not found</div>;

  const score = bid.complianceScore ?? 0;
  const scoreColor = score >= 75 ? "text-[var(--success)]" : score >= 45 ? "text-[var(--warning)]" : "text-[var(--danger)]";
  const docs = bid.documents || [];
  const complianceResults = bid.complianceResults || [];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--accent)] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/bidder/applications" className="text-white/80 hover:text-white flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-5 bg-white/30" />
            <div>
              <h1 className="text-sm font-bold">My Bid — {bid.bidNumber}</h1>
              <p className="text-[10px] text-white/70">{tender?.tenderNumber} | {tender?.title}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreColor}`}>{score}/100</div>
            <div className="text-[10px] text-white/70">Compliance Score</div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-[var(--accent)]" /><span className="text-xs font-medium text-[var(--foreground-secondary)]">Status</span></div>
            <div className={`text-lg font-bold ${bid.status === "VERIFIED" ? "text-[var(--success)]" : bid.status === "SUBMITTED" ? "text-[var(--accent)]" : bid.status === "DECIDED" ? "text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"}`}>{bid.status}</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-[var(--accent)]" /><span className="text-xs font-medium text-[var(--foreground-secondary)]">Decision</span></div>
            <div className="text-lg font-bold text-[var(--foreground)]">{bid.decision || "Pending"}</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-[var(--accent)]" /><span className="text-xs font-medium text-[var(--foreground-secondary)]">Risk Level</span></div>
            <div className={`text-lg font-bold ${bid.riskLevel === "LOW" ? "text-[var(--success)]" : bid.riskLevel === "MEDIUM" ? "text-[var(--warning)]" : bid.riskLevel === "HIGH" ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>{bid.riskLevel || "Not assessed"}</div>
          </div>
        </div>

        {/* Organization Info */}
        {bid.organization && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-[var(--accent)]" /><h2 className="text-sm font-semibold text-[var(--foreground)]">Bidder Organization</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-[var(--foreground-tertiary)]">Name</span><div className="font-medium text-[var(--foreground)]">{bid.organization.legalName}</div></div>
              {bid.organization.gstin && <div><span className="text-[var(--foreground-tertiary)]">GSTIN</span><div className="font-mono text-[var(--foreground)]">{bid.organization.gstin}</div></div>}
              {bid.organization.pan && <div><span className="text-[var(--foreground-tertiary)]">PAN</span><div className="font-mono text-[var(--foreground)]">{bid.organization.pan}</div></div>}
              {bid.organization.udyamNumber && <div><span className="text-[var(--foreground-tertiary)]">Udyam</span><div className="font-mono text-[var(--foreground)]">{bid.organization.udyamNumber}</div></div>}
            </div>
          </div>
        )}

        {/* Documents */}
        {docs.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--accent)]" /><h2 className="text-sm font-semibold text-[var(--foreground)]">Submitted Documents ({docs.length})</h2></div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {docs.map((doc: any) => (
                <div key={doc.id} className="px-5 py-3 flex items-center gap-3">
                  <FileCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)] truncate">{doc.fileName}</div>
                    <div className="text-[10px] text-[var(--foreground-tertiary)]">{doc.docType?.replace(/_/g, " ")} · {(doc.fileSize / 1024).toFixed(1)} KB</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${doc.verificationStatus === "VERIFIED" ? "bg-[var(--success-light)] text-[var(--success)]" : doc.verificationStatus === "SUSPICIOUS" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--foreground-tertiary)]"}`}>{doc.verificationStatus || "PENDING"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance Results */}
        {complianceResults.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-[var(--accent)]" /><h2 className="text-sm font-semibold text-[var(--foreground)]">Compliance Checks ({complianceResults.length})</h2></div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {complianceResults.map((cr: any) => (
                <div key={cr.id} className="px-5 py-3 flex items-center gap-3">
                  {cr.status === "PASS" ? <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" /> : cr.status === "FAIL" ? <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0" /> : <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)]">{cr.requirement?.title || cr.requirementCode}</div>
                    <div className="text-[10px] text-[var(--foreground-tertiary)]">{cr.notes || "No notes"}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cr.status === "PASS" ? "bg-[var(--success-light)] text-[var(--success)]" : cr.status === "FAIL" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>{cr.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision */}
        {bid.decision && (
          <div className={`rounded-xl p-5 border ${bid.decision === "COMPLIANT" ? "bg-[var(--success-light)] border-[var(--success)]/30" : bid.decision === "CONDITIONAL" ? "bg-[var(--warning-light)] border-[var(--warning)]/30" : "bg-[var(--danger-light)] border-[var(--danger)]/30"}`}>
            <div className="flex items-center gap-2 mb-1">
              {bid.decision === "COMPLIANT" ? <CheckCircle2 className="w-5 h-5 text-[var(--success)]" /> : bid.decision === "CONDITIONAL" ? <AlertTriangle className="w-5 h-5 text-[var(--warning)]" /> : <XCircle className="w-5 h-5 text-[var(--danger)]" />}
              <span className={`text-base font-bold ${bid.decision === "COMPLIANT" ? "text-[var(--success)]" : bid.decision === "CONDITIONAL" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>{bid.decision}</span>
            </div>
            {bid.decisionNotes && <p className="text-xs text-[var(--foreground-secondary)] mt-1">{bid.decisionNotes}</p>}
          </div>
        )}

        {docs.length === 0 && complianceResults.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center">
            <Info className="w-10 h-10 text-[var(--foreground-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-secondary)]">Bid details will appear here once verification is complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}
