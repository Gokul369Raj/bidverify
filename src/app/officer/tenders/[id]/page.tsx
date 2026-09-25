"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Users, Scale,
  ChevronRight, AlertTriangle, Shield, Loader2, Play, Eye, BarChart3,
  FileCheck, MessageSquare, AlertCircle, Info
} from "lucide-react";

export default function OfficerTenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tender, setTender] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requirements" | "bids" | "corrigenda" | "audit">("requirements");
  const [verifying, setVerifying] = useState<string | null>(null);

  async function loadTender() {
    const res = await fetch(`/api/tenders/${params.id}`);
    const data = await res.json();
    if (data.ok) setTender(data.data);
    setLoading(false);
  }

  useEffect(() => { loadTender(); }, [params.id]);

  async function approveAll() {
    await fetch(`/api/tenders/${params.id}/requirements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approveAll" }) });
    loadTender();
  }

  async function approveReq(reqId: string) {
    await fetch(`/api/tenders/${params.id}/requirements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", requirementId: reqId }) });
    loadTender();
  }

  async function rejectReq(reqId: string) {
    await fetch(`/api/tenders/${params.id}/requirements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", requirementId: reqId }) });
    loadTender();
  }

  async function startVerification(bidId: string) {
    setVerifying(bidId);
    const res = await fetch(`/api/bids/${bidId}/verify`, { method: "POST" });
    const data = await res.json();
    setVerifying(null);
    loadTender();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading tender...</div></div>;
  if (!tender) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Tender not found</div>;

  const reqs = tender.requirements || [];
  const approved = reqs.filter((r: any) => r.status === "APPROVED").length;
  const draft = reqs.filter((r: any) => r.status === "DRAFT").length;
  const bids = tender.bids || [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <Link href="/officer/tenders" className="text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tenders
        </Link>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{tender.tenderNumber}</span>
                <span className={`badge text-[10px] ${tender.requirementsFrozen ? "badge-green" : "badge-yellow"}`}>
                  {tender.requirementsFrozen ? "REQUIREMENTS FROZEN" : "DRAFT"}
                </span>
                <span className={`badge text-[10px] ${tender.dataLabel === "DEMO_SIMULATED" ? "badge-yellow" : "badge-green"}`}>
                  {tender.dataLabel === "DEMO_SIMULATED" ? "DEMO DATA" : "LIVE"}
                </span>
              </div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">{tender.title}</h1>
              <p className="text-sm text-[var(--foreground-secondary)] mt-1">{tender.buyerOrganization}</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-2xl font-bold ${Math.ceil((new Date(tender.closingDate).getTime() - Date.now()) / 86400000) <= 7 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
                {Math.ceil((new Date(tender.closingDate).getTime() - Date.now()) / 86400000)}d
              </div>
              <div className="text-xs text-[var(--foreground-tertiary)]">closing</div>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs text-[var(--foreground-secondary)] flex-wrap">
            <span>{approved}/{reqs.length} requirements approved</span>
            <span>{bids.length} bid(s)</span>
            <span>AI: {tender.aiAnalysisStatus}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto">
        {([
          { id: "requirements" as const, label: `Requirements (${reqs.length})`, icon: FileCheck },
          { id: "bids" as const, label: `Bids (${bids.length})`, icon: Users },
          { id: "corrigenda" as const, label: "Corrigenda", icon: FileText },
          { id: "audit" as const, label: "Audit", icon: Shield },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)]"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Requirements Tab */}
      {tab === "requirements" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">AI-Extracted Requirements</h2>
              <p className="text-xs text-[var(--foreground-secondary)] mt-1">Review, approve, edit, or reject each requirement. Approved requirements become the compliance checklist.</p>
            </div>
            {draft > 0 && (
              <button onClick={approveAll} className="bg-[var(--success)] text-white font-medium px-4 py-2 rounded-lg hover:opacity-90 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Approve All ({draft})
              </button>
            )}
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
            {reqs.map((r: any) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${r.status === "APPROVED" ? "bg-[var(--success-light)]" : r.status === "REJECTED" ? "bg-[var(--danger-light)]" : "bg-[var(--warning-light)]"}`}>
                    <span className="text-xs font-bold">{r.code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm text-[var(--foreground)]">{r.title}</span>
                      {r.mandatory ? <span className="badge badge-red text-[10px]">Mandatory</span> : <span className="badge badge-gray text-[10px]">Optional</span>}
                      <span className={`badge text-[10px] ${r.status === "APPROVED" ? "badge-green" : r.status === "REJECTED" ? "badge-red" : "badge-yellow"}`}>{r.status}</span>
                      {r.extractionMethod && <span className="text-[10px] text-[var(--foreground-tertiary)]">{r.extractionMethod}</span>}
                    </div>
                    <p className="text-xs text-[var(--foreground-secondary)] mb-1">{r.description}</p>
                    {r.sourceText && <p className="text-xs text-[var(--foreground-tertiary)] italic line-clamp-1">&quot;{r.sourceText}&quot;</p>}
                    {r.confidence && <span className="text-[10px] text-[var(--foreground-tertiary)]">Confidence: {(r.confidence * 100).toFixed(0)}%</span>}
                  </div>
                  {r.status === "DRAFT" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => approveReq(r.id)} className="text-xs bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)] px-3 py-1.5 rounded-lg hover:opacity-80">Approve</button>
                      <button onClick={() => rejectReq(r.id)} className="text-xs bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)] px-3 py-1.5 rounded-lg hover:opacity-80">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {reqs.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[var(--foreground-tertiary)]">
                <Info className="w-8 h-8 mx-auto mb-2 text-[var(--foreground-tertiary)]" />
                No requirements extracted yet. Upload a tender document with the text content or PDF for AI extraction.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bids Tab */}
      {tab === "bids" && (
        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--foreground)]">Bid Submissions</h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left">
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Bidder</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Bid #</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Status</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Score</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Risk</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Docs</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Decision</th>
                    <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {bids.map((b: any) => (
                    <tr key={b.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[var(--foreground)]">{b.organization?.legalName || "—"}</div>
                        <div className="text-xs text-[var(--foreground-tertiary)]">{b.organization?.gstin || ""}</div>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-[var(--foreground-secondary)]">{b.bidNumber}</td>
                      <td className="px-5 py-3">
                        <span className={`badge text-[10px] ${
                          b.status === "VERIFIED" ? "badge-green" :
                          b.status === "DECIDED" ? "badge-blue" :
                          b.status === "UNDER_VERIFICATION" ? "badge-yellow" :
                          b.status === "SUBMITTED" ? "badge-purple" : "badge-gray"
                        }`}>{b.status}</span>
                      </td>
                      <td className="px-5 py-3">
                        {b.complianceScore != null ? (
                          <span className={`font-semibold ${b.complianceScore >= 80 ? "text-[var(--success)]" : b.complianceScore >= 60 ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>
                            {b.complianceScore}
                          </span>
                        ) : <span className="text-[var(--foreground-tertiary)]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {b.riskLevel ? (
                          <span className={`badge text-[10px] ${
                            b.riskLevel === "LOW" ? "badge-green" :
                            b.riskLevel === "MEDIUM" ? "badge-yellow" :
                            b.riskLevel === "HIGH" ? "badge-orange" : "badge-red"
                          }`}>{b.riskLevel}</span>
                        ) : <span className="text-[var(--foreground-tertiary)]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[var(--foreground-secondary)]">{b.documents?.length || 0}</td>
                      <td className="px-5 py-3">
                        {b.officerDecision ? (
                          <span className={`badge text-[10px] ${b.officerDecision === "COMPLIANT" ? "badge-green" : b.officerDecision === "NON_COMPLIANT" ? "badge-red" : "badge-yellow"}`}>
                            {b.officerDecision}
                          </span>
                        ) : <span className="text-xs text-[var(--foreground-tertiary)]">Pending</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <Link href={`/officer/verification/${b.id}`} className="text-[var(--accent)] hover:opacity-80" title="View Details">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/officer/comparison?bidId=${b.id}`}
                            className="text-[var(--navy-600)] hover:opacity-80"
                            title="Requirement-wise compliance comparison"
                          >
                            <Scale className="w-4 h-4" />
                          </Link>
                          {(b.status === "SUBMITTED" || b.status === "DRAFT") && (
                            <button onClick={() => startVerification(b.id)} disabled={verifying === b.id} className="text-[var(--warning)] hover:opacity-80" title="Start Verification">
                              {verifying === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bids.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[var(--foreground-tertiary)]">
                <Users className="w-8 h-8 mx-auto mb-2 text-[var(--foreground-tertiary)]" />
                No bids submitted yet. Bids will appear here when bidders submit their compliance packages.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Corrigenda Tab */}
      {tab === "corrigenda" && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-4">Corrigenda</h2>
            {(tender.corrigenda || []).length === 0 ? (
              <p className="text-sm text-[var(--foreground-tertiary)] text-center py-6">No corrigenda published for this tender.</p>
            ) : (
              <div className="space-y-3">
                {tender.corrigenda.map((c: any) => (
                  <div key={c.id} className="bg-[var(--surface-2)] rounded-lg p-4">
                    <div className="font-medium text-sm text-[var(--foreground)]">{c.corrigendumNumber}: {c.title}</div>
                    <div className="text-xs text-[var(--foreground-secondary)] mt-1">Published: {new Date(c.publishedAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[var(--accent-light)] border border-[var(--accent)] rounded-xl p-4">
            <p className="text-xs text-[var(--accent)]">
              Corrigenda are uploaded by the officer and analyzed by AI to detect requirement changes.
              Upload a corrigendum PDF and the AI will compare it against the approved requirements checklist.
            </p>
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-4">Tender Audit Trail</h2>
            <p className="text-xs text-[var(--foreground-secondary)] mb-4">Recent audit entries for this tender.</p>
            <div className="space-y-2">
              <div className="bg-[var(--surface-2)] rounded-lg px-4 py-3 flex items-center gap-3">
                <Shield className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div>
                  <div className="text-sm text-[var(--foreground)]">Tender created and AI analysis completed</div>
                  <div className="text-xs text-[var(--foreground-secondary)]">{new Date(tender.createdAt).toLocaleString()} · {tender.aiAnalysisStatus} · {tender.requirements?.length || 0} requirements extracted</div>
                </div>
              </div>
              {(tender.requirements || []).filter((r: any) => r.status === "APPROVED").length > 0 && (
                <div className="bg-[var(--surface-2)] rounded-lg px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <div>
                    <div className="text-sm text-[var(--foreground)]">Requirements checklist approved</div>
                    <div className="text-xs text-[var(--foreground-secondary)]">{tender.requirements.filter((r: any) => r.status === "APPROVED").length} requirements approved · Frozen: {tender.requirementsFrozen ? "Yes" : "No"}</div>
                  </div>
                </div>
              )}
              {bids.length > 0 && (
                <div className="bg-[var(--surface-2)] rounded-lg px-4 py-3 flex items-center gap-3">
                  <Users className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <div>
                    <div className="text-sm text-[var(--foreground)]">{bids.length} bid(s) submitted</div>
                    <div className="text-xs text-[var(--foreground-secondary)]">{bids.filter((b: any) => b.status === "VERIFIED").length} verified · {bids.filter((b: any) => b.status === "DECIDED").length} decided</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Link href="/officer/audit" className="text-sm text-[var(--accent)] hover:opacity-80">View full audit trail →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
