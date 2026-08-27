"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import {
  ArrowLeft, FileText, Clock, CheckCircle2, AlertTriangle, Eye, Shield,
  Building2, ChevronDown, ChevronRight, Lock, Loader2, Check, X,
} from "lucide-react";

function AdminBidDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  function SkeletonLoader() {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="bg-[var(--accent)] text-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="h-4 w-16 bg-white/20 rounded animate-pulse" />
            <div className="w-px h-5 bg-white/30" />
            <div className="h-4 w-48 bg-white/20 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 h-28 animate-pulse" />)}
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetch(`/api/admin/bids/${params.id}`).then(r => r.json()).then(d => {
      if (d.ok) setData(d.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [params.id]);

  async function decide(decision: string, isChange = false) {
    const label = decision === "COMPLIANT" ? "PASS" : decision === "CONDITIONAL" ? "HOLD" : "FAIL";
    if (!confirm(`Are you sure you want to ${isChange ? "change decision to" : ""} ${label} this bid?\nThe bidder will be notified immediately.`)) return;
    setDeciding(true);
    try {
      const body: any = { decision, notes: `Decided from admin bid detail page — ${label}` };
      if (isChange) body.changeDecision = true;
      await fetch(`/api/bids/${params.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await fetch(`/api/admin/bids/${params.id}`).then(r => r.json());
      if (d.ok) setData(d.data);
    } finally {
      setDeciding(false);
    }
  }

  if (loading) return <SkeletonLoader />;
  if (!data) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Bid not found</div>;

  const { bid, bidder, organization, tender, documents, requirementMatchings, formValues } = data;

  const scoreColor = (bid.complianceScore ?? 0) >= 75 ? "text-[var(--success)]" : (bid.complianceScore ?? 0) >= 45 ? "text-[var(--warning)]" : "text-[var(--danger)]";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--accent)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-white/80 hover:text-white flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-5 bg-white/30" />
            <div>
              <h1 className="text-sm font-bold">Bid Review — {bid.bidNumber}</h1>
              <p className="text-[10px] text-white/70">{tender.tenderNumber} | {tender.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-bold ${scoreColor}`}>{bid.complianceScore ?? "—"}/100</div>
              <div className="text-[10px] text-white/70">Compliance Score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Bid Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-2 flex items-center gap-1"><Building2 className="w-3 h-3" /> Bidder</h3>
            <p className="text-sm font-semibold text-[var(--foreground)]">{bidder.name}</p>
            <p className="text-xs text-[var(--foreground-secondary)]">{bidder.email}</p>
            <p className="text-xs text-[var(--foreground-secondary)] mt-1">{organization.legalName}</p>
            <p className="text-xs text-[var(--foreground-tertiary)]">PAN: {organization.pan ?? "—"}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-2 flex items-center gap-1"><FileText className="w-3 h-3" /> Tender</h3>
            <p className="text-sm font-semibold text-[var(--foreground)]">{tender.title}</p>
            <p className="text-xs text-[var(--foreground-secondary)]">{tender.tenderNumber}</p>
            <p className="text-xs text-[var(--foreground-secondary)]">Category: {tender.category ?? "—"}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Status</h3>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                bid.status === "DECIDED" ? "bg-purple-900/40 text-purple-400 border border-purple-800/50" :
                bid.status === "VERIFIED" ? "bg-[var(--success-light)] text-[var(--success)]" :
                "bg-[var(--accent-light)] text-[var(--accent)]"
              }`}>{bid.status}</span>
              {bid.officerDecision && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  bid.officerDecision === "COMPLIANT" ? "bg-[var(--success-light)] text-[var(--success)]" : bid.officerDecision === "CONDITIONAL" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--danger-light)] text-[var(--danger)]"
                }`}>{bid.officerDecision === "COMPLIANT" ? "APPROVED" : bid.officerDecision === "CONDITIONAL" ? "HOLD" : "REJECTED"}</span>
              )}
            </div>
            {bid.riskLevel && <p className="text-xs text-[var(--foreground-secondary)] mt-1">Risk: {bid.riskLevel}</p>}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Documents ({documents.length})</h3>
          </div>
          {documents.length === 0 ? (
            <div className="p-8 text-center text-[var(--foreground-tertiary)] text-sm">No documents uploaded</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {documents.map((doc: any) => {
                const isExpanded = expandedDoc === doc.id;
                const isPdf = doc.fileType.includes("pdf");
                const docScore = doc.score ?? 0;
                return (
                  <div key={doc.id}>
                    <div
                      className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-2)] transition ${isExpanded ? "bg-[var(--accent-light)]/50" : ""}`}
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--foreground-tertiary)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--foreground-tertiary)]" />}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPdf ? "bg-red-900/40 text-red-400" : "bg-blue-900/40 text-blue-400"}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-[var(--foreground)] truncate">{doc.fileName}</div>
                        <div className="text-[10px] text-[var(--foreground-tertiary)] flex items-center gap-2">
                          <span className="font-mono">{doc.docType}</span>
                          <span>·</span>
                          <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          <span>·</span>
                          <span className={doc.status === "PROCESSED" ? "text-[var(--success)]" : "text-[var(--warning)]"}>{doc.status}</span>
                        </div>
                      </div>
                      <div className={`text-sm font-bold shrink-0 px-2 py-0.5 rounded ${
                        docScore >= 75 ? "bg-[var(--success-light)] text-[var(--success)]" :
                        docScore >= 45 ? "bg-[var(--warning-light)] text-[var(--warning)]" :
                        docScore > 0 ? "bg-orange-100 text-orange-700" :
                        "bg-[var(--danger-light)] text-[var(--danger)]"
                      }`}>
                        {docScore}/100
                      </div>
                      {(isPdf || doc.fileType.includes("image")) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingDoc(viewingDoc === doc.id ? null : doc.id); }}
                          className="text-[10px] bg-[var(--accent-light)] text-[var(--accent)] px-2 py-0.5 rounded font-medium hover:opacity-80 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      )}
                    </div>

                    {viewingDoc === doc.id && (
                      <div className="px-4 pb-3 border-b border-[var(--border)]">
                        <div className="bg-[var(--surface-2)] rounded-lg overflow-hidden" style={{ height: "500px" }}>
                          <iframe src={`/api/admin/documents/${doc.id}/file`} className="w-full h-full border-0" title={doc.fileName} />
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {doc.extractedFields.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {doc.extractedFields.filter((f: any) => !f.field.startsWith("forensics") && !f.field.startsWith("tamper") && !f.field.startsWith("signature") && !f.field.startsWith("qr_") && !f.field.includes("validation")).map((f: any) => (
                              <div key={f.field} className="bg-[var(--surface-2)] rounded-lg px-3 py-2">
                                <div className="text-[10px] text-[var(--foreground-tertiary)] font-medium">{f.field}</div>
                                <div className="text-xs text-[var(--foreground)] font-medium truncate">{f.value === "NOT_FOUND_IN_SOURCE" ? "—" : f.value}</div>
                                {f.confidence != null && <div className="text-[10px] text-[var(--foreground-tertiary)]">Confidence: {(f.confidence * 100).toFixed(0)}%</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-[var(--foreground-tertiary)] flex items-center gap-2">
                          <Lock className="w-3 h-3" />
                          SHA-256: <span className="font-mono">{doc.sha256.slice(0, 32)}...</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Requirements Match */}
        {requirementMatchings.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Requirement Matching</h3>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {requirementMatchings.map((req: any) => (
                <div key={req.requirementCode} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        req.hasDocuments ? "bg-[var(--success-light)] text-[var(--success)]" : req.missing ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"
                      }`}>
                        {req.hasDocuments ? "✓" : "✗"}
                      </span>
                      <div>
                        <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{req.requirementCode}</span>
                        <span className="text-xs text-[var(--foreground)] ml-2">{req.requirementTitle}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${req.mandatory ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>
                      {req.mandatory ? "Mandatory" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3 flex-wrap">
          {(bid.status === "SUBMITTED" || bid.status === "VERIFIED") && !bid.officerDecision && (
            <>
              <button onClick={() => decide("COMPLIANT")} disabled={deciding} className="bg-[var(--success)] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                <Check className="w-4 h-4" /> PASS
              </button>
              <button onClick={() => decide("CONDITIONAL")} disabled={deciding} className="bg-[var(--warning)] text-[var(--background)] px-6 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                HOLD
              </button>
              <button onClick={() => decide("NON_COMPLIANT")} disabled={deciding} className="bg-[var(--danger)] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                <X className="w-4 h-4" /> FAIL
              </button>
            </>
          )}
          {bid.status === "DECIDED" && bid.officerDecision && (
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-sm font-bold px-5 py-2.5 rounded-lg ${
                bid.officerDecision === "COMPLIANT" ? "bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/20" : bid.officerDecision === "CONDITIONAL" ? "bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]/20" : "bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20"
              }`}>
                Decision: {bid.officerDecision === "COMPLIANT" ? "APPROVED" : bid.officerDecision === "CONDITIONAL" ? "HOLD" : "REJECTED"}
              </span>
              {bid.officerDecision !== "COMPLIANT" && (
                <button onClick={() => decide("COMPLIANT", true)} disabled={deciding} className="bg-[var(--success)]/20 text-[var(--success)] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[var(--success)]/30 border border-[var(--success)]/30 disabled:opacity-50 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Change to PASS
                </button>
              )}
              {bid.officerDecision !== "CONDITIONAL" && (
                <button onClick={() => decide("CONDITIONAL", true)} disabled={deciding} className="bg-[var(--warning)]/20 text-[var(--warning)] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[var(--warning)]/30 border border-[var(--warning)]/30 disabled:opacity-50 flex items-center gap-1">
                  Change to HOLD
                </button>
              )}
              {bid.officerDecision !== "NON_COMPLIANT" && (
                <button onClick={() => decide("NON_COMPLIANT", true)} disabled={deciding} className="bg-[var(--danger)]/20 text-[var(--danger)] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[var(--danger)]/30 border border-[var(--danger)]/30 disabled:opacity-50 flex items-center gap-1">
                  <X className="w-3 h-3" /> Change to FAIL
                </button>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <Link href="/admin#bids" className="text-xs text-[var(--accent)] hover:opacity-80 flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3 h-3" /> Back to Review Bids
            </Link>
            <Link href="/admin" className="text-xs text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] flex items-center gap-1">
              Admin Panel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBidDetailPage() {
  return <AdminGate><AdminBidDetailContent /></AdminGate>;
}
