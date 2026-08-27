"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight, Clock, CheckCircle2, AlertTriangle, Wallet, Send, Loader2 } from "lucide-react";

export default function BidderApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bidder/applications")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setApplications(d.data.applications || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6 max-w-4xl">
      <div className="h-10 w-56 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    DRAFT: { color: "text-[var(--foreground-secondary)]", bg: "bg-[var(--surface-2)]", label: "Draft" },
    IN_PROGRESS: { color: "text-[var(--warning)]", bg: "bg-[var(--warning)]/10", label: "In Progress" },
    READY: { color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/12", label: "Ready" },
    SUBMITTED: { color: "text-[var(--success)]", bg: "bg-[var(--success)]/10", label: "Submitted" },
    UNDER_REVIEW: { color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/12", label: "Under Review" },
    DECIDED: { color: "text-[var(--success)]", bg: "bg-[var(--success)]/10", label: "Decided" },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">My Applications</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Track your tender applications and their progress.</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center">
          <Wallet className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
          <h3 className="font-semibold text-[var(--foreground)] mb-2">No Applications Yet</h3>
          <p className="text-sm text-[var(--foreground-secondary)] mb-4">Start by browsing tenders and clicking "Apply With My Documents".</p>
          <Link href="/bidder/tenders" className="text-sm text-[var(--accent)] hover:opacity-80 font-medium">Browse Tenders →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const st = statusConfig[app.status] || statusConfig.DRAFT;
            const tender = app.tender;
            return (
              <Link key={app.id} href={`/bidder/applications/${app.id}`} className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[var(--foreground-tertiary)]">{app.applicationNumber}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    </div>
                    <h3 className="font-medium text-[var(--foreground)] mb-1">{tender?.title || "Tender"}</h3>
                    <p className="text-xs text-[var(--foreground-secondary)]">{tender?.tenderNumber} · {tender?.buyerOrganization}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="text-xs text-[var(--foreground-secondary)]">
                        {app.documents?.length || 0} document(s) · {Math.round(app.progressPercent || 0)}% complete
                      </div>
                      {app.submittedAt && (
                        <span className="text-[10px] text-[var(--foreground-tertiary)]">Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden max-w-[200px]">
                      <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--success)] rounded-full" style={{ width: `${app.progressPercent || 0}%` }} />
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0 mt-2" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
