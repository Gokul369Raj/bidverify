"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, MapPin, Tag, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, Shield, Info, BookOpen, FileCheck,
  Building2, Zap, Wallet, Eye, XCircle, RefreshCw
} from "lucide-react";

type Tab = "overview" | "eligibility" | "technical" | "documents";

export default function BidderTenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tender, setTender] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [user, setUser] = useState<any>(null);
  const [creatingApp, setCreatingApp] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/tenders/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTender(d.data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.data) setUser(d.data); })
      .catch(() => {});
  }, [params.id]);

  const daysLeft = tender ? Math.ceil((new Date(tender.closingDate).getTime() - Date.now()) / 86400000) : 0;
  const requirements = tender?.requirements?.filter((r: any) => r.status === "APPROVED" || r.status === "DRAFT") || [];

  async function applyWithMyDocuments() {
    if (!user?.organization) {
      setMessage({ type: "error", text: "Complete your organization profile first" });
      return;
    }
    setCreatingApp(true);
    try {
      // Check for existing application first
      const appsRes = await fetch("/api/bidder/applications");
      const appsData = await appsRes.json();
      if (appsData.ok) {
        const existing = appsData.data.applications?.find((a: any) => a.tenderId === tender.id);
        if (existing) {
          router.push(`/bidder/applications/${existing.id}`);
          return;
        }
      }
      // Create new application
      const res = await fetch("/api/bidder/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId: tender.id }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/bidder/applications/${data.data.applicationId}`);
      else setMessage({ type: "error", text: data.error });
    } catch { setMessage({ type: "error", text: "Failed to create application" }); }
    setCreatingApp(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading tender...</div></div>;
  if (!tender) return <div className="text-center py-20 text-[var(--foreground-secondary)]">Tender not found</div>;

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "eligibility", label: "Eligibility", icon: CheckCircle2, badge: requirements.length.toString() },
    { id: "technical", label: "Technical", icon: BookOpen },
    { id: "documents", label: "Tender Docs", icon: FileText },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/bidder/tenders" className="text-sm text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tenders
        </Link>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{tender.tenderNumber}</span>
                {tender.dataLabel === "DEMO_SIMULATED" && <span className="badge badge-yellow text-[10px]">DEMO DATA</span>}
              </div>
              <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">{tender.title}</h1>
              <p className="text-sm text-[var(--foreground-secondary)]">{tender.buyerOrganization}</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-2xl font-bold ${daysLeft <= 7 ? "text-[var(--danger)]" : daysLeft <= 14 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                {daysLeft > 0 ? `${daysLeft} days` : "Closed"}
              </div>
              <div className="text-xs text-[var(--foreground-tertiary)]">until closing</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 text-xs text-[var(--foreground-secondary)]">
            {tender.category && <span className="flex items-center gap-1 bg-[var(--surface-2)] px-2 py-1 rounded"><Tag className="w-3 h-3" />{tender.category}</span>}
            {(tender.state || tender.city) && <span className="flex items-center gap-1 bg-[var(--surface-2)] px-2 py-1 rounded"><MapPin className="w-3 h-3" />{[tender.city, tender.state].filter(Boolean).join(", ")}</span>}
            {tender.estimatedValueLakh && <span className="bg-[var(--surface-2)] px-2 py-1 rounded">Est. Value: ₹{tender.estimatedValueLakh.toLocaleString()} Lakh</span>}
            {tender.emdAmount && <span className="bg-[var(--surface-2)] px-2 py-1 rounded">EMD: ₹{tender.emdAmount.toLocaleString()}</span>}
          </div>

          {/* Apply CTA */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--warning)]" /> Ready to apply?
                </p>
                <p className="text-xs text-[var(--foreground-secondary)] mt-0.5">Click below to start your application. Your org profile and vault documents will be loaded automatically.</p>
              </div>
              <button onClick={applyWithMyDocuments} disabled={creatingApp || !user?.organization} className="btn-primary text-sm !px-6 !py-2.5 flex items-center gap-2 disabled:opacity-50">
                {creatingApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {creatingApp ? "Preparing..." : "Apply With My Documents"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${message.type === "success" ? "bg-[var(--success-light)] border border-[var(--success)]/30 text-[var(--success)]" : "bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)]"}`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto"><span className="text-xs">dismiss</span></button>
        </div>
      )}

      <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-2)]"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.badge && <span className="text-[10px] bg-[var(--border)] px-1.5 py-0.5 rounded-full">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-[var(--foreground)] mb-2">Description</h2>
            <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{tender.description || "No description provided."}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[var(--surface-2)] rounded-lg p-4">
              <div className="text-xs text-[var(--foreground-tertiary)] mb-1">Publish Date</div>
              <div className="text-sm font-medium text-[var(--foreground)]">{new Date(tender.publishDate).toLocaleDateString()}</div>
            </div>
            <div className="bg-[var(--surface-2)] rounded-lg p-4">
              <div className="text-xs text-[var(--foreground-tertiary)] mb-1">Closing Date</div>
              <div className="text-sm font-medium text-[var(--foreground)]">{new Date(tender.closingDate).toLocaleDateString()}</div>
            </div>
            <div className="bg-[var(--surface-2)] rounded-lg p-4">
              <div className="text-xs text-[var(--foreground-tertiary)] mb-1">Source</div>
              <div className="text-sm font-medium text-[var(--foreground)]">{tender.source?.replace(/_/g, " ")}</div>
            </div>
            <div className="bg-[var(--surface-2)] rounded-lg p-4">
              <div className="text-xs text-[var(--foreground-tertiary)] mb-1">Requirements</div>
              <div className="text-sm font-medium text-[var(--foreground)]">{requirements.length} requirements</div>
            </div>
          </div>
        </div>
      )}

      {tab === "eligibility" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Eligibility Requirements ({requirements.length})</h2>
            <p className="text-xs text-[var(--foreground-secondary)] mt-1">Requirements extracted by AI and approved by the procurement officer.</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {requirements.map((r: any) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.mandatory ? "bg-[var(--danger-light)]" : "bg-[var(--surface-2)]"}`}>
                    <span className="text-xs font-bold text-[var(--foreground-secondary)]">{r.code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--foreground)]">{r.title}</span>
                      {r.mandatory && <span className="badge badge-red text-[10px]">Mandatory</span>}
                      {!r.mandatory && <span className="badge badge-gray text-[10px]">Optional</span>}
                    </div>
                    <p className="text-xs text-[var(--foreground-secondary)] mt-1">{r.description}</p>
                    {r.sourceText && <p className="text-xs text-[var(--foreground-tertiary)] mt-1 italic line-clamp-2">&quot;{r.sourceText}&quot;</p>}
                  </div>
                </div>
              </div>
            ))}
            {requirements.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--foreground-tertiary)]">No requirements listed for this tender.</div>}
          </div>
        </div>
      )}

      {tab === "technical" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Technical Requirements</h2>
          <div className="space-y-3">
            {requirements.filter((r: any) => ["TECHNICAL_SPEC", "CERTIFICATE", "DECLARATION"].includes(r.type)).map((r: any) => (
              <div key={r.id} className="bg-[var(--surface-2)] rounded-lg p-4">
                <div className="text-sm font-medium text-[var(--foreground)]">{r.title}</div>
                <div className="text-xs text-[var(--foreground-secondary)] mt-1">{r.description}</div>
              </div>
            ))}
            {requirements.filter((r: any) => ["TECHNICAL_SPEC", "CERTIFICATE", "DECLARATION"].includes(r.type)).length === 0 && (
              <p className="text-sm text-[var(--foreground-tertiary)]">No technical requirements in this tender.</p>
            )}
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="font-semibold text-[var(--foreground)] mb-2">Tender Documents</h2>
          <p className="text-sm text-[var(--foreground-secondary)] mb-4">Documents uploaded by the procurement officer.</p>
          <div className="space-y-2">
            {(tender.documents || []).map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 bg-[var(--surface-2)] rounded-lg p-3">
                <FileText className="w-5 h-5 text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--foreground)] truncate">{d.fileName}</div>
                  <div className="text-xs text-[var(--foreground-tertiary)]">{(d.fileSize / 1024).toFixed(1)} KB · {d.fileType}</div>
                </div>
              </div>
            ))}
            {(!tender.documents || tender.documents.length === 0) && <p className="text-sm text-[var(--foreground-tertiary)] text-center py-4">No documents attached.</p>}
          </div>
        </div>
      )}

    </div>
  );
}
