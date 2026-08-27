"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Scale, Shield, Eye,
  FileText, Play, Loader2, AlertCircle, Info, BarChart3, MessageSquare,
  FileCheck, ChevronDown, ChevronUp
} from "lucide-react";
import { parseJson } from "@/lib/json";

export default function OfficerVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const [bid, setBid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [assistantQ, setAssistantQ] = useState("");
  const [assistantAns, setAssistantAns] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  async function loadBid() {
    const bidId = Array.isArray(params.id) ? params.id[0] : params.id;
    const searchRes = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) });
    const searchData = await searchRes.json();
    if (searchData.ok) {
      for (const t of searchData.data.tenders) {
        if (t.bids) {
          const found = t.bids.find((b: any) => b.id === bidId);
          if (found) { found.tenderId = t.id; setBid(found); setLoading(false); return; }
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { loadBid(); }, [params.id]);

  async function runVerification() {
    if (!bid) return;
    setVerifying(true);
    await fetch(`/api/bids/${bid.id}/verify`, { method: "POST" });
    loadBid();
    setVerifying(false);
  }

  async function recordDecision() {
    if (!bid || !decision) return;
    setDeciding(true);
    await fetch(`/api/bids/${bid.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, notes }) });
    loadBid();
    setDeciding(false);
    setDecision("");
    setNotes("");
  }

  async function askCopilot() {
    if (!assistantQ || !bid) return;
    setAssistantLoading(true);
    const res = await fetch("/api/ai/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: assistantQ, bidId: bid.id }) });
    const data = await res.json();
    if (data.ok) setAssistantAns(data.data.answer);
    else setAssistantAns("Unable to answer at this time.");
    setAssistantLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading verification...</div></div>;
  if (!bid) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Bid not found. Go to tender → Bids to select one.</div>;

  const complianceResults = bid.complianceResults || [];
  const risks = bid.risks || [];
  const anomalies = bid.anomalies || [];
  const verifications = bid.verifications || [];
  const documents = bid.documents || [];
  const latestRisk = risks[0];

  const counts = { PASS: 0, FAIL: 0, REVIEW: 0, NOT_APPLICABLE: 0, INSUFFICIENT_EVIDENCE: 0, VERIFICATION_UNAVAILABLE: 0 };
  complianceResults.forEach((r: any) => { counts[r.result as keyof typeof counts] = (counts[r.result as keyof typeof counts] || 0) + 1; });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link href={`/officer/tenders/${bid.tenderId}`} className="text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tender
        </Link>
      </div>

      {/* Bid Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{bid.tender?.tenderNumber}</span>
              <span className="font-mono text-xs text-[var(--foreground-tertiary)]">·</span>
              <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{bid.bidNumber}</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">{bid.organization?.legalName || "Unknown Bidder"}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--foreground-secondary)] flex-wrap">
              {bid.organization?.gstin && <span>GSTIN: {bid.organization.gstin}</span>}
              {bid.organization?.pan && <span>PAN: {bid.organization.pan}</span>}
              {bid.organization?.udyamNumber && <span>Udyam: {bid.organization.udyamNumber}</span>}
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            {(bid.status === "SUBMITTED" || bid.status === "DRAFT") && (
              <button onClick={runVerification} disabled={verifying} className="bg-[var(--warning)] text-white font-medium px-4 py-2 rounded-lg hover:brightness-110 text-sm flex items-center gap-2 disabled:opacity-50">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Verification
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Score + Risk Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 text-center">
          <div className="text-xs text-[var(--foreground-tertiary)] mb-2">Compliance Score</div>
          <div className={`text-3xl font-bold ${bid.complianceScore != null ? (bid.complianceScore >= 80 ? "text-[var(--success)]" : bid.complianceScore >= 60 ? "text-[var(--warning)]" : "text-[var(--danger)]") : "text-[var(--foreground-tertiary)]"}`}>
            {bid.complianceScore != null ? bid.complianceScore : "—"}
          </div>
          <div className="text-xs text-[var(--foreground-tertiary)] mt-1">out of 100</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 text-center">
          <div className="text-xs text-[var(--foreground-tertiary)] mb-2">Risk Level</div>
          <div className={`text-2xl font-bold ${latestRisk?.level === "LOW" ? "text-[var(--success)]" : latestRisk?.level === "MEDIUM" ? "text-[var(--warning)]" : latestRisk?.level === "HIGH" ? "text-[var(--danger)]" : latestRisk?.level === "CRITICAL" ? "text-[var(--danger)]" : "text-[var(--foreground-tertiary)]"}`}>
            {latestRisk?.level || "—"}
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-xs text-[var(--foreground-tertiary)] mb-2">Requirements</div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm"><span className="text-[var(--success)]">Passed</span><span className="font-semibold">{counts.PASS}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--warning)]">Review</span><span className="font-semibold">{counts.REVIEW}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--danger)]">Failed</span><span className="font-semibold">{counts.FAIL}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--foreground-tertiary)]">N/A</span><span className="font-semibold">{counts.NOT_APPLICABLE + counts.INSUFFICIENT_EVIDENCE + counts.VERIFICATION_UNAVAILABLE}</span></div>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-xs text-[var(--foreground-tertiary)] mb-2">Status</div>
          <div className={`badge text-sm mb-2 ${bid.status === "VERIFIED" ? "badge-green" : bid.status === "DECIDED" ? "badge-blue" : "badge-yellow"}`}>{bid.status}</div>
          {bid.officerDecision && <div className="text-sm font-medium text-[var(--foreground)]">Decision: {bid.officerDecision}</div>}
          {bid.aiRecommendation && <div className="text-xs text-[var(--foreground-secondary)] mt-1 line-clamp-2">AI: {bid.aiRecommendation}</div>}
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-[var(--foreground)]">
            <AlertTriangle className="w-4 h-4" /> Potential Inconsistencies ({anomalies.length})
          </h3>
          <div className="space-y-2">
            {anomalies.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                <span className={`badge text-[10px] shrink-0 ${a.severity === "HIGH" ? "badge-red" : a.severity === "MEDIUM" ? "badge-yellow" : "badge-gray"}`}>{a.severity}</span>
                <span className="text-[var(--warning)]">{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Results */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Compliance Matrix</h2>
          <p className="text-xs text-[var(--foreground-secondary)] mt-1">Each requirement evaluated with evidence, verification, and deterministic rules.</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {complianceResults.map((cr: any) => {
            const expanded = expandedReq === cr.id;
            return (
              <div key={cr.id} className="px-5 py-3">
                <button onClick={() => setExpandedReq(expanded ? null : cr.id)} className="w-full text-left">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      cr.result === "PASS" ? "bg-[var(--success-light)]" : cr.result === "FAIL" ? "bg-[var(--danger-light)]" : cr.result === "REVIEW" ? "bg-[var(--warning-light)]" : "bg-[var(--surface-2)]"
                    }`}>
                      {cr.result === "PASS" ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> :
                       cr.result === "FAIL" ? <XCircle className="w-4 h-4 text-[var(--danger)]" /> :
                       cr.result === "REVIEW" ? <AlertTriangle className="w-4 h-4 text-[var(--warning)]" /> :
                       <Info className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--foreground-tertiary)]">{cr.requirement?.code}</span>
                        <span className="text-sm font-medium text-[var(--foreground)]">{cr.requirement?.title}</span>
                      </div>
                    </div>
                    <span className={`badge text-[10px] ${
                      cr.result === "PASS" ? "badge-green" : cr.result === "FAIL" ? "badge-red" :
                      cr.result === "REVIEW" ? "badge-yellow" : "badge-gray"
                    }`}>{cr.result}</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                  </div>
                </button>
                {expanded && (
                  <div className="mt-3 ml-11 bg-[var(--surface-2)] rounded-lg p-4 text-sm space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Finding</div>
                      <p className="text-[var(--foreground)]">{parseJson<{finding?: string}>(cr.detailsJson, {}).finding || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Evidence</div>
                      <p className="text-[var(--foreground)]">{parseJson<{evidence?: string}>(cr.detailsJson, {}).evidence || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Comparison</div>
                      <p className="text-[var(--foreground)]">{parseJson<{comparison?: string}>(cr.detailsJson, {}).comparison || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Rule Applied</div>
                      <p className="text-[var(--foreground)]">{cr.ruleCode} v{cr.ruleVersion}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Recommendation</div>
                      <p className="text-[var(--foreground)]">{parseJson<{recommendation?: string}>(cr.detailsJson, {}).recommendation || "—"}</p>
                    </div>
                    {cr.evidences?.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1">Evidence Items</div>
                        <div className="space-y-1">
                          {cr.evidences.map((ev: any) => (
                            <div key={ev.id} className="flex items-center gap-2 text-xs text-[var(--foreground-secondary)]">
                              <FileText className="w-3 h-3 text-[var(--accent)]" />
                              <span>{ev.label}</span>
                              {ev.extractedValue && <span className="text-[var(--foreground-tertiary)]">→ {ev.extractedValue.slice(0, 50)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {cr.overridden && (
                      <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded p-2 text-xs text-[var(--warning)]">
                        Officer override: {cr.overrideResult} — {cr.overrideReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {complianceResults.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-[var(--foreground-tertiary)]">
              Run verification to evaluate compliance requirements.
            </div>
          )}
        </div>
      </div>

      {/* Verification Results */}
      {verifications.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Government Verification Results</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {verifications.map((v: any) => (
              <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v.status === "VERIFIED" ? "bg-[var(--success-light)]" : v.status === "MISMATCH" ? "bg-[var(--danger-light)]" : "bg-[var(--surface-2)]"}`}>
                  {v.status === "VERIFIED" ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : v.status === "MISMATCH" ? <XCircle className="w-4 h-4 text-[var(--danger)]" /> : <Info className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--foreground)]">{v.provider} Verification</div>
                  <div className="text-xs text-[var(--foreground-secondary)]">Source: {v.source} {v.simulated && "· SIMULATED"}</div>
                </div>
                <span className={`badge text-[10px] ${v.status === "VERIFIED" ? "badge-green" : v.status === "MISMATCH" ? "badge-red" : v.status === "UNAVAILABLE" ? "badge-gray" : "badge-yellow"}`}>
                  {v.status}
                </span>
                {v.matchStatus && <span className="text-xs text-[var(--foreground-tertiary)]">{v.matchStatus}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Fusion — Verification Coverage Matrix */}
      {(() => {
        let fusion: any = null;
        try { fusion = JSON.parse(bid.aiRecommendationJson || "null")?.fusion ?? null; } catch {}
        if (!fusion) return null;
        const LEVEL_NAMES = ["File exists","Structurally valid","Fields extracted","Internal consistency","Cross-document consistency","Crypto / QR evidence","Official verification","Tender compliance"];
        const statusColor: Record<string,string> = {
          VERIFIED: "var(--success)", PROVISIONALLY_VERIFIED: "var(--accent)", PARTIALLY_VERIFIED: "var(--warning)",
          CONFLICTING_EVIDENCE: "var(--danger)", UNKNOWN: "var(--foreground-tertiary)",
        };
        return (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-[var(--foreground)]">Evidence Fusion — Coverage Matrix</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge" style={{ background: `${statusColor[fusion.overallStatus] ?? "var(--foreground-tertiary)"}22`, color: statusColor[fusion.overallStatus] ?? "var(--foreground-tertiary)" }}>
                  {fusion.overallStatus}
                </span>
                <span className="badge badge-blue">Evidence: {fusion.evidenceStrength}</span>
                <span className="badge badge-gray">Official source: {fusion.authoritativeVerification}</span>
                <span className="badge badge-purple">Coverage: {fusion.verificationCoverage ?? "—"}%</span>
                <span className={`badge ${fusion.reviewTriage === "HUMAN_REVIEW" ? "badge-red" : fusion.reviewTriage === "SELECTIVE_REVIEW" ? "badge-yellow" : "badge-green"}`}>
                  {fusion.reviewTriage.replace("_", " ")}
                </span>
              </div>
            </div>
            <div className="p-5 grid md:grid-cols-2 gap-2">
              {(fusion.levelDetails ?? []).map((l: any) => (
                <div key={l.level} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 border ${l.achieved ? "border-[var(--success)] bg-[var(--success-light)]" : "border-[var(--border)] bg-[var(--surface-2)]"}`}>
                  <span className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${l.achieved ? "bg-[var(--success)] text-white" : "bg-[var(--surface-3)] text-[var(--foreground-tertiary)]"}`}>
                    {l.achieved ? "✓" : "L"}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-xs font-medium ${l.achieved ? "text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"}`}>L{l.level} · {l.name}</div>
                    <div className="text-[11px] text-[var(--foreground-tertiary)] truncate">{l.basis}</div>
                  </div>
                </div>
              ))}
            </div>
            {fusion.openIssues?.length > 0 && (
              <div className="px-5 pb-5">
                <div className="text-[11px] uppercase tracking-wide text-[var(--danger)] font-medium mb-1.5">Open issues ({fusion.openIssues.length})</div>
                <ul className="space-y-1">
                  {fusion.openIssues.map((iss: string, i: number) => (
                    <li key={i} className="text-xs text-[var(--foreground-secondary)] flex items-start gap-1.5"><span className="text-[var(--warning)] mt-0.5">•</span>{iss}</li>
                  ))}
                </ul>
                {fusion.critique && (
                  <div className={`mt-3 rounded-lg border p-3 ${fusion.critique.verdict === "SUPPORTED" ? "border-[var(--success)] bg-[var(--success-light)]" : "border-[var(--warning)] bg-[var(--warning-light)]"}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: fusion.critique.verdict === "SUPPORTED" ? "var(--success)" : "var(--warning)" }}>
                      Reviewer Agent · {fusion.critique.verdict}
                    </div>
                    <p className="text-xs text-[var(--foreground-secondary)]">{fusion.critique.reviewerNote}</p>
                    {(fusion.critique.challenges ?? []).slice(0, 3).map((ch: string, i: number) => (
                      <p key={i} className="text-[11px] text-[var(--foreground-secondary)] mt-1">↳ {ch}</p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-[var(--foreground-tertiary)] mt-2">Officer review {fusion.officerReviewRecommended ? "recommended" : "optional"} — AI output is decision support only; the final qualification decision rests with the Procurement Officer.</p>
              </div>
            )}
            {fusion.blockers?.length > 0 && (
              <div className="px-5 pb-5">
                <div className="text-[11px] uppercase tracking-wide text-[var(--accent)] font-medium mb-1.5">What would change the result — top blockers</div>
                <ol className="space-y-1">
                  {fusion.blockers.map((bl: any) => (
                    <li key={bl.rank} className="text-xs text-[var(--foreground-secondary)]">
                      <span className="text-[var(--accent)] font-semibold">{bl.rank}.</span>{" "}
                      <span className="text-[var(--foreground)]">{bl.code}</span> · {bl.currentState} — {bl.resolutionPath}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })()}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Bidder Documents ({documents.length})</h2>
            <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5">Forensic, QR, signature and validation evidence per document — officer review required for all flagged items.</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {documents.map((d: any) => {
              const fields = d.fields || [];
              const intel = fields.filter((f: any) => ["FORENSICS", "SIGNATURE", "QR", "VALIDATOR"].includes(f.source));
              const tamper = intel.find((f: any) => f.field === "tamper_signals")?.value ?? "";
              const tamperSev = tamper.startsWith("HIGH") ? "HIGH" : tamper.startsWith("MEDIUM") ? "MEDIUM" : tamper.startsWith("LOW") ? "LOW" : null;
              let qrStatus: string | null = null;
              try { qrStatus = JSON.parse(intel.find((f: any) => f.field === "qr_consistency")?.value ?? "null")?.status ?? null; } catch {}
              const invalidIds = intel
                .filter((f: any) => f.field.endsWith("_validation"))
                .map((f: any) => { try { return JSON.parse(f.value); } catch { return null; } })
                .filter((v: any) => v?.valid === false);
              return (
                <div key={d.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-[var(--accent)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--foreground)] truncate">{d.fileName}</div>
                      <div className="text-xs text-[var(--foreground-secondary)]">{d.docType} · {d.status} · {fields.length} fields</div>
                    </div>
                  </div>

                  {(tamperSev || qrStatus === "CONFLICT" || qrStatus === "CONSISTENT" || invalidIds.length > 0 || intel.length > 0) && (
                    <div className="mt-2 ml-8 flex flex-wrap gap-1.5">
                      {tamperSev ? (
                        <span className={`badge ${tamperSev === "LOW" ? "badge-yellow" : "badge-red"} !text-[10px]`}>Tamper signals: {tamperSev}</span>
                      ) : intel.some((f: any) => f.field === "tamper_signals") ? (
                        <span className="badge badge-green !text-[10px]">Tamper signals: none detected</span>
                      ) : null}
                      {qrStatus === "CONFLICT" && <span className="badge badge-red !text-[10px]">QR conflict</span>}
                      {qrStatus === "CONSISTENT" && <span className="badge badge-green !text-[10px]">QR consistent</span>}
                      {qrStatus === "INCONCLUSIVE" && <span className="badge badge-gray !text-[10px]">QR not found</span>}
                      {invalidIds.map((v: any) => (
                        <span key={v.field} className="badge badge-red !text-[10px]">{v.field} invalid</span>
                      ))}
                      {intel.some((f: any) => f.field === "signature_status" && /SIGNATURE/.test(f.value)) && (
                        <span className="badge badge-blue !text-[10px]">Signature detected (not validated)</span>
                      )}
                    </div>
                  )}

                  {intel.length > 0 && (
                    <details className="ml-8 mt-2">
                      <summary className="cursor-pointer text-xs text-[var(--accent)] hover:underline select-none">View evidence & checks ({intel.length})</summary>
                      <div className="mt-2 space-y-1.5">
                        {intel.map((f: any) => (
                          <div key={f.id} className="bg-[var(--surface-2)] rounded-lg px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-tertiary)]">{f.source} · {f.field}{f.confidence != null ? ` · conf ${f.confidence}` : ""}</div>
                            <pre className="text-[11px] text-[var(--foreground-secondary)] whitespace-pre-wrap break-all max-h-32 overflow-y-auto mt-1">{f.value?.slice(0, 600)}{f.value?.length > 600 ? "…" : ""}</pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Officer Decision */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="font-semibold text-[var(--foreground)] mb-4">Record Final Decision</h3>
        <p className="text-xs text-[var(--foreground-secondary)] mb-4">AI never automatically disqualifies. The final decision rests with the procurement officer.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {["COMPLIANT", "NON_COMPLIANT", "CONDITIONAL", "REJECTED"].map((d) => (
            <button
              key={d}
              onClick={() => setDecision(d)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                decision === d
                  ? d === "COMPLIANT" ? "bg-[var(--success-light)] border-[var(--success)] text-[var(--success)]" : d === "NON_COMPLIANT" || d === "REJECTED" ? "bg-[var(--danger-light)] border-[var(--danger)] text-[var(--danger)]" : "bg-[var(--warning-light)] border-[var(--warning)] text-[var(--warning)]"
                  : "border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {d.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm mb-4 resize-none h-20 text-[var(--foreground)]" placeholder="Decision notes (optional)..." />
        <button onClick={recordDecision} disabled={!decision || deciding} className="bg-[var(--accent)] text-white font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm flex items-center gap-2 disabled:opacity-50">
          {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
          Record Decision
        </button>
      </div>

      {/* AI Copilot */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--accent)]" /> Officer AI Copilot
        </h3>
        <p className="text-xs text-[var(--foreground-secondary)] mb-3">Ask questions about this bid — all answers are evidence-grounded.</p>
        <div className="flex gap-2 mb-3">
          <input value={assistantQ} onChange={(e) => setAssistantQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askCopilot()} className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)]" placeholder='e.g. "Why is this bidder medium risk?"' />
          <button onClick={askCopilot} disabled={assistantLoading} className="bg-[var(--surface-2)] text-[var(--foreground)] px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {assistantLoading ? "..." : "Ask"}
          </button>
        </div>
        {assistantAns && <div className="bg-[var(--surface-2)] rounded-lg p-4 text-sm text-[var(--foreground)] whitespace-pre-wrap">{assistantAns}</div>}
      </div>
    </div>
  );
}
