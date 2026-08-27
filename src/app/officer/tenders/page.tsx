"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Clock, Users, CheckCircle2, Upload, X, Loader2, ArrowRight, Save } from "lucide-react";

const inp2 = "w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none";
const lbl2 = "block text-[11px] font-medium text-[var(--foreground-secondary)] mb-1";

export default function OfficerTendersPage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "", tenderNumber: "", buyerOrganization: "", description: "",
    department: "", category: "", state: "", city: "", closingDate: "",
    emdAmount: "", estimatedValueLakh: "", tenderText: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  async function loadTenders() {
    setLoading(true);
    const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", limit: 50 }) });
    const data = await res.json();
    if (data.ok) setTenders(data.data.tenders);
    setLoading(false);
  }

  useEffect(() => { loadTenders(); }, []);

  // ── Edit / Delete existing tenders (what bidders see) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }

  async function saveEdit(t: any) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/tenders/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          buyerOrganization: editForm.buyerOrganization,
          category: editForm.category || null,
          state: editForm.state || null,
          city: editForm.city || null,
          status: editForm.status,
          estimatedValueLakh: editForm.estimatedValueLakh ? parseFloat(editForm.estimatedValueLakh) : null,
          closingDate: new Date(editForm.closingDate).toISOString(),
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setTenders((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...d.data.tender } : x)));
      setEditingId(null);
      flash(`✓ ${t.tenderNumber} updated — live on the site instantly.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTender(t: any) {
    if (!window.confirm(`Delete ${t.tenderNumber} permanently?\nThis also removes its bids, documents and verification records.`)) return;
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/tenders/${t.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setTenders((prev) => prev.filter((x) => x.id !== t.id));
      flash(`✓ ${d.tenderNumber} deleted — removed from the site instantly.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const inp = "w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none";

  async function createTender(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (uploadFile) fd.append("file", uploadFile);
    const res = await fetch("/api/tenders", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) {
      setShowCreate(false);
      setForm({ title: "", tenderNumber: "", buyerOrganization: "", description: "", department: "", category: "", state: "", city: "", closingDate: "", emdAmount: "", estimatedValueLakh: "", tenderText: "" });
      setUploadFile(null);
      loadTenders();
    }
    setCreating(false);
  }

  const input = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const label = "block text-sm font-medium text-[var(--foreground-secondary)] mb-1";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Tenders</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">Create, manage, and track procurement tenders.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-[var(--accent)] text-white font-medium px-4 py-2 rounded-lg hover:opacity-90 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Tender
        </button>
      </div>

      {/* Create Tender Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20 px-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Create New Tender</h2>
              <button onClick={() => setShowCreate(false)} className="text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createTender} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={label}>Tender Title *</label>
                  <input className={input} required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Supply and Installation of..." />
                </div>
                <div>
                  <label className={label}>Tender Number *</label>
                  <input className={input} required value={form.tenderNumber} onChange={(e) => setForm((p) => ({ ...p, tenderNumber: e.target.value }))} placeholder="CPCL/PUMP/2026/014" />
                </div>
                <div>
                  <label className={label}>Buyer Organization *</label>
                  <input className={input} required value={form.buyerOrganization} onChange={(e) => setForm((p) => ({ ...p, buyerOrganization: e.target.value }))} placeholder="Chennai Petroleum Corporation Ltd" />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Description</label>
                  <textarea className={`${input} h-24 resize-none`} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Detailed tender description..." />
                </div>
                <div>
                  <label className={label}>Category</label>
                  <input className={input} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Industrial Pumps" />
                </div>
                <div>
                  <label className={label}>Closing Date *</label>
                  <input className={input} type="date" required value={form.closingDate} onChange={(e) => setForm((p) => ({ ...p, closingDate: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>State</label>
                  <input className={input} value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>City</label>
                  <input className={input} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>EMD Amount (₹)</label>
                  <input className={input} type="number" value={form.emdAmount} onChange={(e) => setForm((p) => ({ ...p, emdAmount: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>Estimated Value (₹ Lakh)</label>
                  <input className={input} type="number" value={form.estimatedValueLakh} onChange={(e) => setForm((p) => ({ ...p, estimatedValueLakh: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Tender Text (paste content or upload PDF for AI extraction)</label>
                  <textarea className={`${input} h-32 resize-none font-mono text-xs`} value={form.tenderText} onChange={(e) => setForm((p) => ({ ...p, tenderText: e.target.value }))} placeholder="Paste tender document text here..." />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Upload Tender Document (PDF)</label>
                  <input type="file" accept=".pdf" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="text-sm text-[var(--foreground)]" />
                  {uploadFile && <p className="text-xs text-[var(--foreground-secondary)] mt-1">Selected: {uploadFile.name}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[var(--border)] text-[var(--foreground-secondary)] font-medium py-2.5 rounded-lg hover:bg-[var(--surface-2)] text-sm">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-[var(--accent)] text-white font-medium py-2.5 rounded-lg hover:opacity-90 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Create & Analyze
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tender List */}
      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--foreground-tertiary)] animate-pulse">Loading tenders...</div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Tender</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Category</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Reqs</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Bids</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">Closing</th>
                  <th className="px-5 py-3 font-medium text-[var(--foreground-secondary)]">AI</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tenders.map((t: any) => {
                  const daysLeft = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
                  return (
                    <Fragment key={t.id}>
                    <tr className="hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[var(--foreground)] max-w-xs truncate">{t.title}</div>
                        <div className="text-xs text-[var(--foreground-tertiary)] font-mono">{t.tenderNumber}</div>
                      </td>
                      <td className="px-5 py-3"><span className="badge badge-blue text-[10px]">{t.category || "—"}</span></td>
                      <td className="px-5 py-3 text-[var(--foreground-secondary)]">{t._count?.requirements || 0}</td>
                      <td className="px-5 py-3 text-[var(--foreground-secondary)]">{t._count?.bids || 0}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-[var(--danger)]" : daysLeft <= 14 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                          {daysLeft > 0 ? `${daysLeft}d` : "Closed"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge text-[10px] ${t.dataLabel === "DEMO_SIMULATED" ? "badge-yellow" : "badge-green"}`}>
                          {t.dataLabel === "DEMO_SIMULATED" ? "DEMO" : "LIVE"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {editingId === t.id ? (
                          <span className="text-xs text-[var(--foreground-tertiary)]">editing below ↓</span>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => {
                                setEditingId(t.id);
                                setEditForm({
                                  title: t.title,
                                  buyerOrganization: t.buyerOrganization || "",
                                  category: t.category || "",
                                  state: t.state || "",
                                  city: t.city || "",
                                  status: t.status || "ACTIVE",
                                  estimatedValueLakh: t.estimatedValueLakh != null ? String(t.estimatedValueLakh) : "",
                                  closingDate: new Date(t.closingDate).toISOString(),
                                });
                              }}
                              className="text-xs font-medium text-[var(--foreground)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTender(t)}
                              disabled={busyId === t.id}
                              className="text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Delete
                            </button>
                            <Link href={`/officer/tenders/${t.id}`} className="text-[var(--accent)] hover:opacity-80 ml-1">
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                    {editingId === t.id && editForm && (
                      <tr>
                        <td colSpan={8} className="bg-[var(--surface-2)] p-5 border-l-4 !border-l-[var(--accent)]">
                          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Editing {t.tenderNumber} — goes live for bidders instantly</h4>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="sm:col-span-2"><label className={lbl2}>Title</label><input className={inp2} value={editForm.title} onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                            <div><label className={lbl2}>Buyer Org</label><input className={inp2} value={editForm.buyerOrganization} onChange={(e) => setEditForm((p: any) => ({ ...p, buyerOrganization: e.target.value }))} /></div>
                            <div><label className={lbl2}>Status</label>
                              <select className={inp2 + " cursor-pointer"} value={editForm.status} onChange={(e) => setEditForm((p: any) => ({ ...p, status: e.target.value }))}>
                                {["ACTIVE", "CLOSED", "CANCELLED"].map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </div>
                            <div><label className={lbl2}>Category</label><input className={inp2} value={editForm.category} onChange={(e) => setEditForm((p: any) => ({ ...p, category: e.target.value }))} /></div>
                            <div><label className={lbl2}>State</label><input className={inp2} value={editForm.state} onChange={(e) => setEditForm((p: any) => ({ ...p, state: e.target.value }))} /></div>
                            <div><label className={lbl2}>City</label><input className={inp2} value={editForm.city} onChange={(e) => setEditForm((p: any) => ({ ...p, city: e.target.value }))} /></div>
                            <div><label className={lbl2}>Value (₹L)</label><input type="number" className={inp2} value={editForm.estimatedValueLakh} onChange={(e) => setEditForm((p: any) => ({ ...p, estimatedValueLakh: e.target.value }))} /></div>
                            <div><label className={lbl2}>Closing Date</label><input type="date" className={inp2} value={editForm.closingDate?.slice(0, 10)} onChange={(e) => setEditForm((p: any) => ({ ...p, closingDate: e.target.value }))} /></div>
                          </div>
                          <div className="flex gap-3 mt-4">
                            <button onClick={() => saveEdit(t)} disabled={busyId === t.id} className="btn-apple !py-2 !px-5 !text-sm disabled:opacity-50 cursor-pointer">
                              {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Go Live
                            </button>
                            <button onClick={() => setEditingId(null)} className="btn-apple-ghost !py-2 !px-5 !text-sm cursor-pointer">Cancel</button>
                            <button onClick={() => deleteTender({ ...t })} disabled={busyId === t.id} className="ml-auto text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] px-4 py-2 rounded-full transition-colors disabled:opacity-50 cursor-pointer">Delete permanently</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tenders.length === 0 && <div className="text-center py-10 text-sm text-[var(--foreground-tertiary)]">No tenders yet. Create one to get started.</div>}
        </div>
      )}
    </div>
  );
}
