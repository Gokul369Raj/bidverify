"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, FileText, Download, ArrowRight, AlertTriangle } from "lucide-react";

export default function OfficerReportsPage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTenders(d.data.tenders); setLoading(false); });
  }, []);

  async function generateTenderReport(tenderId: string) {
    setGenerating(tenderId);
    setReport(null);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenderId, kind: "OFFICER_EVALUATION", format: "PDF_PRINT" }) });
    const data = await res.json();
    if (data.ok) setReport(data.data);
    setGenerating(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--foreground-secondary)] animate-pulse">Loading...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">Generate compliance evaluation reports for tenders.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Tender Evaluation Reports</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tenders.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--foreground)] truncate">{t.title}</div>
                  <div className="text-xs text-[var(--foreground-secondary)]">{t.tenderNumber} · {t._count?.bids || 0} bids</div>
                </div>
                <button onClick={() => generateTenderReport(t.id)} disabled={generating === t.id} className="text-sm text-[var(--accent)] hover:opacity-80 font-medium flex items-center gap-1 disabled:opacity-50">
                  {generating === t.id ? "Generating..." : <><Download className="w-4 h-4" /> Generate</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        {report && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
              Generated Report
            </h2>
            <div className="space-y-3">
              <div className="bg-[var(--surface-2)] rounded-lg p-3">
                <div className="text-xs text-[var(--foreground-tertiary)]">Tender</div>
                <div className="text-sm font-medium text-[var(--foreground)]">{report.title || report.tenderTitle}</div>
                <div className="text-xs text-[var(--foreground-secondary)]">{report.tenderNumber}</div>
              </div>
              <div className="bg-[var(--surface-2)] rounded-lg p-3">
                <div className="text-xs text-[var(--foreground-tertiary)]">Generated</div>
                <div className="text-sm text-[var(--foreground)]">{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "—"}</div>
              </div>
              {report.bidders && (
                <div>
                  <div className="text-xs text-[var(--foreground-tertiary)] mb-2">Bidder Comparison</div>
                  <div className="space-y-2">
                    {report.bidders.map((b: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-[var(--surface-2)] rounded-lg px-3 py-2">
                        <span className="text-sm text-[var(--foreground)]">{b.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{b.score != null ? `${b.score}/100` : "—"}</span>
                          {b.risk && <span className={`badge text-[10px] ${b.risk === "LOW" ? "badge-green" : b.risk === "MEDIUM" ? "badge-yellow" : "badge-red"}`}>{b.risk}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 text-xs text-[var(--foreground-tertiary)]">
              Full PDF/DOCX export available in production deployment.
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-1 text-[var(--foreground)]">
          <AlertTriangle className="w-4 h-4" />
          Report Generation
        </div>
        <p className="text-xs text-[var(--warning)]">
          Reports are generated as structured data. PDF and DOCX export functionality is available when deployed with the appropriate libraries.
          Currently, reports can be viewed and downloaded as JSON.
        </p>
      </div>
    </div>
  );
}
