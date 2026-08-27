"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, AlertTriangle, Upload, Send, Loader2,
  Shield, Building2, RefreshCw, XCircle, Info, FileCheck, Scale, X,
  Search, ChevronDown, ChevronUp, Copy, Check, Ban
} from "lucide-react";

export default function ApplicationWorkspacePage() {
  const params = useParams();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState<string | null>(null);
  const [vaultSearch, setVaultSearch] = useState("");
  const [profileFilled, setProfileFilled] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    org: true, docs: true, form: true, review: false,
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}`);
      const d = await res.json();
      if (d.ok) {
        setApp(d.data);
        const fv: Record<string, string> = {};
        d.data.formValues?.forEach((f: any) => { fv[f.key] = f.value || ""; });
        setFormValues(fv);
      }
    } catch {}
    setLoading(false);
  }, [params.id]);

  useEffect(() => { loadApp(); }, [loadApp]);

  async function runValidation() {
    setValidating(true);
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}/validate`, { method: "POST" });
      const d = await res.json();
      if (d.ok) setValidation(d.data);
    } catch {}
    setValidating(false);
  }

  async function submitApplication() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}/submit`, { method: "POST" });
      const d = await res.json();
      if (d.ok) { setMessage({ type: "success", text: "Application submitted!" }); loadApp(); }
      else setMessage({ type: "error", text: d.error });
    } catch { setMessage({ type: "error", text: "Submission failed" }); }
    setSubmitting(false);
  }

  async function withdrawBid() {
    if (!confirm("Are you sure you want to withdraw this bid? This cannot be undone.")) return;
    const bidId = a.bidSubmissionId;
    if (!bidId) { setMessage({ type: "error", text: "No bid submission found" }); return; }
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/bids/${bidId}/withdraw`, { method: "POST" });
      const d = await res.json();
      if (d.ok) { setMessage({ type: "success", text: "Bid withdrawn" }); loadApp(); }
      else setMessage({ type: "error", text: d.error });
    } catch { setMessage({ type: "error", text: "Withdraw failed" }); }
    setWithdrawing(false);
  }

  async function attachDocument(reqCode: string, vaultDocId: string) {
    const res = await fetch(`/api/bidder/applications/${params.id}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirementCode: reqCode, vaultDocumentId: vaultDocId, matchType: "MANUAL" }),
    });
    const d = await res.json();
    if (d.ok) { setMessage({ type: "success", text: "Document attached" }); loadApp(); }
  }

  async function uploadMissingDoc(reqCode: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(reqCode);
    setUploadSuccess(null);
    const form = new FormData();
    form.append("requirementCode", reqCode);
    form.append("saveToVault", "true");
    for (const f of files) form.append("files", f);
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}/attach`, { method: "POST", body: form });
      const d = await res.json();
      if (d.ok) {
        await loadApp();
        setUploadSuccess(reqCode);
        setUploading(null);
        setTimeout(() => setUploadSuccess(null), 2000);
      } else {
        setMessage({ type: "error", text: d.error });
        setUploading(null);
      }
    } catch { setMessage({ type: "error", text: "Upload failed" }); setUploading(null); }
  }

  async function detachDocument(docId: string) {
    if (!confirm("Remove this document?")) return;
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}/attach`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      const d = await res.json();
      if (d.ok) loadApp();
    } catch {}
  }

  async function loadVaultDocs() {
    setVaultLoading(true);
    try {
      const res = await fetch("/api/bidder/vault");
      const d = await res.json();
      if (d.ok) setVaultDocs(d.data.documents || []);
    } catch {}
    setVaultLoading(false);
  }

  function openVaultModal(reqCode: string) {
    setShowVaultModal(reqCode);
    if (vaultDocs.length === 0) loadVaultDocs();
  }

  async function attachFromVault(reqCode: string, vaultDocId: string) {
    await attachDocument(reqCode, vaultDocId);
    setShowVaultModal(null);
  }

  async function autoFillProfile() {
    if (!app?.profileAutoFill) return;
    const p = app.profileAutoFill;
    const filled = {
      legalName: formValues.legalName || p.legalName || "",
      pan: formValues.pan || p.pan || "",
      gstin: formValues.gstin || p.gstin || "",
      udyamNumber: formValues.udyamNumber || p.udyamNumber || "",
      registeredAddress: formValues.registeredAddress || p.registeredAddress || "",
      state: formValues.state || p.state || "",
      city: formValues.city || p.city || "",
    };
    setFormValues(filled);
    setProfileFilled(true);
    try {
      const res = await fetch(`/api/bidder/applications/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formValues: filled }),
      });
      const d = await res.json();
      if (d.ok) setMessage({ type: "success", text: "Profile auto-filled & saved" });
    } catch {}
    setTimeout(() => setProfileFilled(false), 2000);
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading application...</div></div>;
  if (!app) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Application not found</div>;

  const { application: a, requirementMatchings: reqs, stats, profileAutoFill, formValues: fvList } = app;
  const tender = a.tender;
  const isSubmitted = ["SUBMITTED", "UNDER_REVIEW", "DECIDED"].includes(a.status);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div>
        <Link href={`/bidder/tenders/${tender.id}`} className="text-xs text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to tender
        </Link>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] text-[var(--foreground-tertiary)] bg-[var(--surface-2)] px-2 py-0.5 rounded">{a.applicationNumber}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.status === "WITHDRAWN" ? "bg-[var(--danger-light)] text-[var(--danger)]" : isSubmitted ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>{a.status}</span>
              </div>
              <h1 className="text-lg font-bold text-[var(--foreground)]">{tender.title}</h1>
              <p className="text-xs text-[var(--foreground-secondary)] mt-0.5">{tender.tenderNumber} · {tender.buyerOrganization}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-[var(--accent)]">{Math.round(a.progressPercent || 0)}%</div>
              <div className="text-[10px] text-[var(--foreground-tertiary)]">Complete</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--success)] rounded-full transition-all duration-500" style={{ width: `${a.progressPercent || 0}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-[var(--foreground-tertiary)]">
            <span>{stats.documentsAttached}/{stats.totalRequirements} docs</span>
            {stats.missingMandatory > 0 && <span className="text-[var(--danger)]">{stats.missingMandatory} missing</span>}
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${message.type === "success" ? "bg-[var(--success-light)] border border-[var(--success)]/30 text-[var(--success)]" : "bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)]"}`} onClick={() => setMessage(null)}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <X className="w-3 h-3 ml-auto cursor-pointer" />
        </div>
      )}

      {/* ─── Section 1: Organization Details ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <button onClick={() => toggleSection("org")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Organization Details</h2>
              <p className="text-[10px] text-[var(--foreground-tertiary)]">Auto-filled from your profile</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isSubmitted && (
              <button onClick={(e) => { e.stopPropagation(); autoFillProfile(); }} className="text-[10px] font-medium text-[var(--accent)] bg-[var(--accent-light)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/20 transition-colors flex items-center gap-1 cursor-pointer">
                {profileFilled ? <><Check className="w-3 h-3" /> Filled</> : <><Copy className="w-3 h-3" /> Auto-fill</>}
              </button>
            )}
            {expandedSections.org ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
          </div>
        </button>
        {expandedSections.org && (
          <div className="px-5 pb-5 border-t border-[var(--border)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {[
                { key: "legalName", label: "Legal Name / Company Name", value: profileAutoFill?.legalName },
                { key: "pan", label: "PAN Number", value: profileAutoFill?.pan },
                { key: "gstin", label: "GSTIN", value: profileAutoFill?.gstin },
                { key: "udyamNumber", label: "Udyam Registration No.", value: profileAutoFill?.udyamNumber },
                { key: "registeredAddress", label: "Registered Address", value: profileAutoFill?.registeredAddress, full: true },
                { key: "state", label: "State", value: profileAutoFill?.state },
                { key: "city", label: "City", value: profileAutoFill?.city },
              ].map(field => (
                <div key={field.key} className={field.full ? "sm:col-span-2" : ""}>
                  <label className="text-[11px] font-medium text-[var(--foreground-secondary)] mb-1 block">{field.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formValues[field.key] || field.value || ""}
                      onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                      disabled={isSubmitted}
                      className="flex-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60 transition-colors"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                    {formValues[field.key] || field.value ? (
                      <button onClick={() => copyToClipboard(formValues[field.key] || field.value || "", field.key)} className="p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg transition-colors cursor-pointer shrink-0">
                        {copiedField === field.key ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--foreground-tertiary)]">
              <Info className="w-3 h-3" />
              Values come from your organization profile. Update at /bidder/profile to change.
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 2: Required Documents ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <button onClick={() => toggleSection("docs")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Required Documents</h2>
              <p className="text-[10px] text-[var(--foreground-tertiary)]">{stats.documentsAttached}/{stats.totalRequirements} attached · {stats.missingMandatory} mandatory missing</p>
            </div>
          </div>
          {expandedSections.docs ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
        </button>
        {expandedSections.docs && (
          <div className="border-t border-[var(--border)]">
            {reqs.map((req: any, idx: number) => {
              const isMissing = req.missing;
              const isAttached = req.hasDocuments;
              return (
                <div key={req.requirementCode} className={`px-5 py-4 ${idx > 0 ? "border-t border-[var(--border)]" : ""} ${isMissing ? "bg-[var(--danger-light)]/30" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isAttached ? "bg-[var(--success-light)]" : "bg-[var(--danger-light)]"}`}>
                      {isAttached ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /> : <XCircle className="w-3.5 h-3.5 text-[var(--danger)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-[var(--foreground-tertiary)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">{req.requirementCode}</span>
                        <span className="text-sm font-medium text-[var(--foreground)]">{req.requirementTitle}</span>
                        {req.mandatory && <span className="text-[9px] font-bold text-[var(--danger)] bg-[var(--danger-light)] px-1.5 py-0.5 rounded">Mandatory</span>}
                        {!req.mandatory && <span className="text-[9px] text-[var(--foreground-tertiary)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">Optional</span>}
                      </div>
                      <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5">{req.description}</p>

                      {/* Attached documents */}
                      {req.attachedDocuments?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {req.attachedDocuments.map((doc: any) => (
                            <div key={doc.id} className="flex items-center gap-2 bg-[var(--success-light)]/50 rounded-lg px-3 py-1.5 group">
                              <FileCheck className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                              <span className="text-[11px] text-[var(--foreground)] truncate flex-1">{doc.fileName || doc.fileNameSnapshot}</span>
                              <span className="text-[9px] text-[var(--success)] shrink-0">{doc.matchType}</span>
                              {!isSubmitted && (
                                <button onClick={() => detachDocument(doc.id)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] hover:text-[var(--danger)] p-0.5 rounded transition-opacity cursor-pointer" title="Remove document">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload / Vault buttons */}
                      {!isSubmitted && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {uploading === req.requirementCode ? (
                            <span className="text-[11px] text-[var(--warning)] flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                            </span>
                          ) : uploadSuccess === req.requirementCode ? (
                            <span className="text-[11px] text-[var(--success)] flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Uploaded
                            </span>
                          ) : (
                            <>
                              <label className="text-[11px] font-medium text-[var(--accent)] hover:opacity-80 cursor-pointer flex items-center gap-1 bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors">
                                <Upload className="w-3 h-3" /> Upload File
                                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={(e) => uploadMissingDoc(req.requirementCode, e.target.files)} />
                              </label>
                              <button onClick={() => openVaultModal(req.requirementCode)} className="text-[11px] font-medium text-[var(--success)] bg-[var(--success-light)] hover:opacity-80 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                                <Shield className="w-3 h-3" /> From Vault
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Section 3: Review & Submit ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <button onClick={() => toggleSection("review")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <Scale className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Review & Submit</h2>
              <p className="text-[10px] text-[var(--foreground-tertiary)]">Validate and submit your application</p>
            </div>
          </div>
          {expandedSections.review ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
        </button>
        {expandedSections.review && (
          <div className="px-5 pb-5 border-t border-[var(--border)] space-y-4 mt-4">
            {/* Validation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--foreground)]">Pre-Submission Check</h3>
                <button onClick={runValidation} disabled={validating} className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 cursor-pointer">
                  {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {validation ? "Re-check" : "Run Check"}
                </button>
              </div>
              {validation ? (
                <div className="space-y-3">
                  <div className={`rounded-xl p-3 ${validation.overallStatus === "READY_TO_SUBMIT" ? "bg-[var(--success-light)] border border-[var(--success)]/30" : validation.overallStatus === "READY_WITH_WARNINGS" ? "bg-[var(--warning-light)] border border-[var(--warning)]/30" : "bg-[var(--danger-light)] border border-[var(--danger)]/30"}`}>
                    <div className="flex items-center gap-2">
                      {validation.overallStatus === "READY_TO_SUBMIT" ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : validation.overallStatus === "READY_WITH_WARNINGS" ? <AlertTriangle className="w-4 h-4 text-[var(--warning)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                      <span className={`text-sm font-semibold ${validation.overallStatus === "READY_TO_SUBMIT" ? "text-[var(--success)]" : validation.overallStatus === "READY_WITH_WARNINGS" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>
                        {validation.overallStatus === "READY_TO_SUBMIT" ? "READY TO SUBMIT" : validation.overallStatus === "READY_WITH_WARNINGS" ? "READY WITH WARNINGS" : "ACTION REQUIRED"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--foreground-secondary)] mt-1">{validation.overallMessage}</p>
                  </div>
                  <div className="space-y-1.5">
                    {validation.requirementChecks?.map((check: any) => (
                      <div key={check.requirementCode} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${check.status === "FAIL" ? "bg-[var(--danger-light)]" : check.status === "WARNING" ? "bg-[var(--warning-light)]" : "bg-[var(--success-light)]"}`}>
                        {check.status === "PASS" ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] mt-0.5 shrink-0" /> : check.status === "WARNING" ? <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)] mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-[var(--danger)] mt-0.5 shrink-0" />}
                        <div>
                          <span className="font-medium text-[var(--foreground)]">{check.requirementTitle}</span>
                          {check.reason && <span className="text-[var(--foreground-secondary)] ml-1">— {check.reason}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--foreground-tertiary)] text-center py-3">Click "Run Check" to validate before submission.</p>
              )}
            </div>

            {/* Submit */}
            {!isSubmitted ? (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-xs text-[var(--foreground-secondary)] mb-3">Once submitted, you cannot modify your application. Officer will review documents and compliance.</p>
                <button
                  onClick={submitApplication}
                  disabled={submitting || (validation && !validation.canSubmit)}
                  className="btn-primary text-sm !px-6 !py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
                {validation && !validation.canSubmit && (
                  <span className="text-[11px] text-[var(--danger)] flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3" /> Fix mandatory issues first
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-[var(--success-light)] border border-[var(--success)]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                  <span className="text-sm font-semibold text-[var(--success)]">Application Submitted</span>
                </div>
                <p className="text-xs text-[var(--foreground-secondary)]">Your application has been submitted for review. You will receive notifications as it progresses.</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {a.bidSubmissionId && <Link href={`/bidder/bids/${a.bidSubmissionId}`} className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] bg-[var(--accent-light)] px-3 py-1.5 rounded-lg flex items-center gap-1">View My Bid →</Link>}
                  <Link href="/bidder/bids" className="text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)]">All Bids →</Link>
                  <Link href="/bidder/notifications" className="text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)]">Notifications →</Link>
                  {a.status !== "WITHDRAWN" && a.status !== "DECIDED" && (
                    <button onClick={withdrawBid} disabled={withdrawing} className="text-xs text-[var(--danger)] hover:text-[var(--danger)]/80 flex items-center gap-1 cursor-pointer disabled:opacity-50">
                      {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                      {withdrawing ? "Withdrawing..." : "Withdraw Bid"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vault Modal */}
      {showVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowVaultModal(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">Attach from Vault</h3>
                <p className="text-[10px] text-[var(--foreground-tertiary)]">Requirement: {showVaultModal}</p>
              </div>
              <button onClick={() => setShowVaultModal(null)} className="p-1.5 text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-9 pr-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
              {vaultLoading ? (
                <div className="px-5 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent)] mx-auto" /></div>
              ) : vaultDocs.filter((d: any) => !vaultSearch || d.fileName.toLowerCase().includes(vaultSearch.toLowerCase()) || d.docType.toLowerCase().includes(vaultSearch.toLowerCase())).length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-[var(--foreground-tertiary)] mb-2">No documents found in vault.</p>
                  <Link href="/bidder/documents" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]" onClick={() => setShowVaultModal(null)}>Upload documents →</Link>
                </div>
              ) : (
                vaultDocs
                  .filter((d: any) => !vaultSearch || d.fileName.toLowerCase().includes(vaultSearch.toLowerCase()) || d.docType.toLowerCase().includes(vaultSearch.toLowerCase()))
                  .map((doc: any) => (
                    <div key={doc.id} className="px-5 py-3 hover:bg-[var(--surface-2)] flex items-center gap-3">
                      <FileCheck className="w-5 h-5 text-[var(--accent)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">{doc.fileName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--foreground-tertiary)]">
                          <span>{doc.docType.replace(/_/g, " ")}</span>
                          <span>·</span>
                          <span className={doc.verificationStatus === "VERIFIED" ? "text-[var(--success)]" : doc.verificationStatus === "NEEDS_REVIEW" ? "text-[var(--warning)]" : "text-[var(--foreground-tertiary)]"}>
                            {doc.verificationStatus || "NOT_VERIFIED"} {doc.intelligenceScore != null ? `(${doc.intelligenceScore}/100)` : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => attachFromVault(showVaultModal, doc.id)}
                        className="text-xs bg-[var(--success-light)] text-[var(--success)] px-3 py-1.5 rounded-lg hover:opacity-80 transition-colors shrink-0 cursor-pointer"
                      >
                        Attach
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
