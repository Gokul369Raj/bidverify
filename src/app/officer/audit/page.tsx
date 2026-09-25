"use client";
import { useEffect, useState } from "react";
import { Shield, Filter, ChevronLeft, ChevronRight } from "lucide-react";

export default function OfficerAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityType) params.set("entityType", entityType);
    const res = await fetch(`/api/audit?${params}`);
    const data = await res.json();
    if (data.ok) { setLogs(data.data.logs); setTotal(data.data.total); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, entityType]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Trail</h1>
        <p className="text-sm text-[var(--foreground-tertiary)] mt-1">Immutable log of all system actions. {total} total entries.</p>
      </div>

      <div className="flex items-center gap-3">
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm">
          <option value="">All entity types</option>
          <option value="User">User</option>
          <option value="Tender">Tender</option>
          <option value="BidSubmission">Bid Submission</option>
          <option value="BidDocument">Document</option>
          <option value="TenderRequirement">Requirement</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--foreground-tertiary)] animate-pulse">Loading...</div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--foreground-tertiary)]">Time</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-tertiary)]">Actor</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-tertiary)]">Action</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-tertiary)]">Entity</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-tertiary)]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--navy-50)]">
                    <td className="px-5 py-3 text-xs text-[var(--foreground-tertiary)] whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-[var(--foreground)]">{log.actorEmail}</div>
                      <div className="text-[10px] text-[var(--foreground-tertiary)]">{log.actorRole}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge text-[10px] ${
                        log.action.includes("FAIL") || log.action.includes("MISMATCH") || log.action.includes("QUARANTINE") ? "badge-red" :
                        log.action.includes("APPROVED") || log.action.includes("PASS") || log.action.includes("COMPLETED") ? "badge-green" :
                        log.action.includes("DECISION") ? "badge-blue" :
                        "badge-gray"
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-[var(--foreground-tertiary)]">{log.entityType}</span>
                      {log.entityId && <div className="text-[10px] text-[var(--foreground-tertiary)] font-mono truncate max-w-[100px]">{log.entityId}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {log.afterJson && <div className="text-xs text-[var(--foreground-secondary)] max-w-xs truncate">{log.afterJson.slice(0, 120)}</div>}
                      {log.reason && <div className="text-xs text-[var(--foreground-tertiary)] italic">{log.reason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && <div className="text-center py-10 text-sm text-[var(--foreground-tertiary)]">No audit entries found.</div>}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--foreground-tertiary)]">Page {page} of {Math.ceil(total / 50) || 1}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-[var(--border)] rounded-lg disabled:opacity-50 hover:bg-[var(--navy-50)]"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 text-sm border border-[var(--border)] rounded-lg disabled:opacity-50 hover:bg-[var(--navy-50)]"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
