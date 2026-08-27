"use client";
import { useEffect, useState } from "react";
import { Settings, Shield, Save, Loader2, CheckCircle2 } from "lucide-react";

const inp = "w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[14px] text-white placeholder:text-[#86868b] focus:border-[#2997ff] focus:outline-none transition-colors";
const lbl = "block text-[12px] font-medium text-[#a1a1a6] mb-1.5";

export default function OfficerAdminPage() {
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<"tenders" | "users" | "ai" | "rules" | "integrations">("tenders");
  const [tenders, setTenders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/rules").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/tenders?limit=100").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/users?limit=50").then((r) => r.json()).catch(() => null),
    ]).then(([s, r, t, u]) => {
      if (s?.ok) setAiSettings(s.data.ai);
      if (r?.ok) setRules(r.data.rules);
      if (t?.ok) setTenders(t.data.tenders ?? t.data ?? []);
      if (u?.ok) setUsers(u.data.users ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      const res = await fetch(`/api/admin/tenders/${editing.id}`, {
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
      // Instant local update — no page refresh needed.
      setTenders((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...d.data.tender } : t)));
      setEditing(null);
      flash(`Tender ${d.data.tender.tenderNumber} updated — live for all users instantly.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTender(t: any) {
    if (!window.confirm(`Delete tender ${t.tenderNumber} permanently?\n\nThis removes its ${t._count?.bids ?? 0} bid(s), documents, verifications and audit-linked records.`)) return;
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/tenders/${t.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setTenders((prev) => prev.filter((x) => x.id !== t.id));
      flash(`Tender ${d.tenderNumber} deleted — removed from the site instantly.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function saveAiSettings() {
    setSaving(true);
    await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ai: aiSettings }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-[#a1a1a6] animate-pulse">Loading settings...</div></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-sm text-[#a1a1a6] mt-1">Configure AI providers, verification integrations, and compliance rules.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161617] border border-white/10 rounded-xl p-1">
        {[
          { id: "tenders" as const, label: `Tenders (${tenders.length})` },
          { id: "users" as const, label: `Users & Organizations (${users.length})` },
          { id: "ai" as const, label: "AI Settings" },
          { id: "rules" as const, label: `Rules (${rules.length})` },
          { id: "integrations" as const, label: "Integrations" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-[#2997ff]/12 text-[#64b5ff]" : "text-[#a1a1a6] hover:bg-white/5"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Flash notice */}
      {notice && (
        <div className="bg-[#30d158]/10 border border-[#30d158]/30 rounded-xl px-4 py-3 text-sm text-[#30d158]">{notice}</div>
      )}

      {/* ═══ Tender Management ═══ */}
      {tab === "tenders" && (
        <div className="space-y-3">
          <p className="text-xs text-[#86868b]">Edits and deletions propagate to every user instantly — no refresh needed.</p>
          {tenders.length === 0 && <div className="card-flat p-8 text-center text-sm text-[#86868b]">No tenders yet.</div>}
          {tenders.map((t: any) => (
            <div key={t.id} className="card-flat p-5">
              {editing?.id === t.id ? (
                /* ── Edit mode ── */
                <div className="space-y-4">
                  <h3 className="headline !text-[17px]">Editing {t.tenderNumber}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className={lbl}>Title</label><input className={inp} value={editForm.title} onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                    <div><label className={lbl}>Buyer Organization</label><input className={inp} value={editForm.buyerOrganization} onChange={e => setEditForm((p: any) => ({ ...p, buyerOrganization: e.target.value }))} /></div>
                    <div><label className={lbl}>Status</label>
                      <select className={inp + " cursor-pointer"} value={editForm.status} onChange={e => setEditForm((p: any) => ({ ...p, status: e.target.value }))}>
                        {["ACTIVE", "CLOSED", "CANCELLED"].map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>Category</label><input className={inp} value={editForm.category ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, category: e.target.value }))} /></div>
                    <div><label className={lbl}>State</label><input className={inp} value={editForm.state ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, state: e.target.value }))} /></div>
                    <div><label className={lbl}>City</label><input className={inp} value={editForm.city ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, city: e.target.value }))} /></div>
                    <div><label className={lbl}>Value (₹ Lakh)</label><input type="number" className={inp} value={editForm.estimatedValueLakh ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, estimatedValueLakh: e.target.value }))} /></div>
                    <div><label className={lbl}>Closing Date</label><input type="date" className={inp} value={editForm.closingDate?.slice(0, 10)} onChange={e => setEditForm((p: any) => ({ ...p, closingDate: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditing(null)} className="btn-apple-ghost !py-2 !px-5 !text-sm cursor-pointer">Cancel</button>
                    <button onClick={saveEdit} disabled={busyId === t.id} className="btn-apple !py-2 !px-5 !text-sm disabled:opacity-50 cursor-pointer">
                      {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Row mode ── */
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-[11px] text-[#64b5ff] bg-[#2997ff]/10 px-2 py-0.5 rounded-md">{t.tenderNumber}</span>
                      <span className={`badge text-[10px] ${t.status === "ACTIVE" ? "badge-green" : t.status === "CLOSED" ? "badge-gray" : "badge-red"}`}>{t.status}</span>
                    </div>
                    <div className="text-sm font-medium text-white truncate max-w-xl">{t.title}</div>
                    <div className="text-xs text-[#86868b] mt-1">
                      {t.buyerOrganization} · {t._count?.requirements ?? 0} reqs · {t._count?.bids ?? 0} bids · closes {new Date(t.closingDate).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditing(t); setEditForm({ ...t, estimatedValueLakh: t.estimatedValueLakh != null ? String(t.estimatedValueLakh) : "" }); }}
                      className="text-sm font-medium text-white bg-white/8 hover:bg-white/15 px-4 py-2 rounded-full transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTender(t)}
                      disabled={busyId === t.id}
                      className="text-sm font-medium text-[#ff6961] bg-[#ff453a]/10 hover:bg-[#ff453a]/25 px-4 py-2 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ Users & Organizations ═══ */}
      {tab === "users" && (
        <div className="space-y-3">
          <p className="text-xs text-[#86868b]">Every registered bidder with their full organization details as submitted.</p>
          {users.filter((u: any) => u.organization).length === 0 && <div className="card-flat p-8 text-center text-sm text-[#86868b]">No organizations yet.</div>}
          {users.filter((u: any) => u.organization).map((u: any) => {
            const o = u.organization;
            return (
              <details key={u.id} className="card-flat overflow-hidden group">
                <summary className="p-5 cursor-pointer flex items-center justify-between gap-4 hover:bg-white/[0.03] select-none">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white">{o.legalName}</span>
                    <span className="text-xs text-[#86868b] ml-3">{o.state || "—"}{o.city ? `, ${o.city}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {o.pan && <span className="badge badge-blue !text-[10px]">PAN</span>}
                    {o.gstin && <span className="badge badge-blue !text-[10px]">GST</span>}
                    {o.isMsme && <span className="badge badge-purple !text-[10px]">MSME</span>}
                    {o.isStartup && <span className="badge badge-gray !text-[10px]">Startup</span>}
                  </div>
                </summary>
                <div className="border-t border-white/10 p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {[
                    ["Legal Name", o.legalName], ["Trade Name", o.tradeName], ["PAN", o.pan],
                    ["GSTIN", o.gstin], ["Udyam", o.udyamNumber], ["CIN", o.cin],
                    ["Type", o.organizationType], ["Category", o.businessCategory],
                    ["Address", o.registeredAddress], ["City", o.city], ["State", o.state], ["PIN", o.pincode],
                    ["Phone", o.phone], ["Turnover (₹L)", o.annualTurnoverLakh],
                    ["Incorporated", o.incorporationDate ? new Date(o.incorporationDate).toLocaleDateString("en-IN") : null],
                  ].map(([l, v]) => v ? (
                    <div key={l as string} className="bg-white/[0.03] rounded-lg p-3">
                      <div className="text-[11px] text-[#86868b]">{l}</div>
                      <div className="text-[13px] text-white mt-0.5 break-words">{String(v)}</div>
                    </div>
                  ) : null)}
                  <div className="sm:col-span-2 lg:col-span-3 pt-1 text-xs text-[#86868b]">
                    Account owner: {u.name} · {u.email} · sign-in via {u.authProvider ?? "EMAIL"}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* AI Settings */}
      {tab === "ai" && aiSettings && (
        <div className="bg-[#161617] border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2997ff]" /> AI Provider Configuration
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#d6d6d7] mb-1">Primary Provider</label>
              <select value={aiSettings.provider} onChange={(e) => setAiSettings((p: any) => ({ ...p, provider: e.target.value }))} className="w-full px-3 py-2 border border-white/12 rounded-lg text-sm">
                <option value="auto">Auto (first configured)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="openai">OpenAI</option>
                <option value="local">Local Model (Ollama)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#d6d6d7] mb-1">Temperature</label>
              <input type="number" step="0.1" min="0" max="1" value={aiSettings.temperature ?? 0.2} onChange={(e) => setAiSettings((p: any) => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-white/12 rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#d6d6d7]">
                <input type="checkbox" checked={aiSettings.visionEnabled} onChange={(e) => setAiSettings((p: any) => ({ ...p, visionEnabled: e.target.checked }))} className="rounded" />
                Vision Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-[#d6d6d7]">
                <input type="checkbox" checked={aiSettings.documentAnalysisEnabled} onChange={(e) => setAiSettings((p: any) => ({ ...p, documentAnalysisEnabled: e.target.checked }))} className="rounded" />
                Document Analysis
              </label>
            </div>
          </div>
          <button onClick={saveAiSettings} disabled={saving} className="bg-blue-700 text-white font-medium px-4 py-2 rounded-lg hover:bg-[#64b5ff] text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      )}

      {/* Rules */}
      {tab === "rules" && (
        <div className="bg-[#161617] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left">
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Code</th>
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Name</th>
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Type</th>
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Version</th>
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Weight</th>
                  <th className="px-5 py-3 font-medium text-[#a1a1a6]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-5 py-3 font-mono text-xs text-[#c7c7cc]">{r.code}</td>
                    <td className="px-5 py-3 text-white">{r.name}</td>
                    <td className="px-5 py-3"><span className="badge badge-blue text-[10px]">{r.requirementType}</span></td>
                    <td className="px-5 py-3 text-[#c7c7cc]">v{r.version}</td>
                    <td className="px-5 py-3 text-[#c7c7cc]">{r.weight}</td>
                    <td className="px-5 py-3"><span className={`badge text-[10px] ${r.active ? "badge-green" : "badge-gray"}`}>{r.active ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrations */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {[
            { name: "GST Verification", env: "GST_API_KEY", status: process.env.GST_API_KEY ? "Configured" : "Not configured" },
            { name: "PAN Verification", env: "PAN_API_KEY", status: process.env.PAN_API_KEY ? "Configured" : "Not configured" },
            { name: "Udyam Verification", env: "UDYAM_API_KEY", status: process.env.UDYAM_API_KEY ? "Configured" : "Not configured" },
            { name: "DigiLocker", env: "DIGILOCKER_CLIENT_ID", status: process.env.DIGILOCKER_CLIENT_ID ? "Configured" : "Not configured" },
            { name: "Google OAuth", env: "GOOGLE_CLIENT_ID", status: process.env.GOOGLE_CLIENT_ID ? "Configured" : "Not configured" },
            { name: "GeM Integration", env: "GEM_API_KEY", status: process.env.GEM_API_KEY ? "Configured" : "Not configured" },
          ].map((i) => (
            <div key={i.name} className="bg-[#161617] border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{i.name}</div>
                <div className="text-xs text-[#a1a1a6]">Environment variable: {i.env}</div>
              </div>
              <span className={`badge text-[10px] ${i.status === "Configured" ? "badge-green" : "badge-gray"}`}>{i.status}</span>
            </div>
          ))}
          <div className="bg-[#ffd60a]/10 border border-[#ffd60a]/30 rounded-xl p-4">
            <p className="text-xs text-[#ffd60a]">
              Configure API credentials in the <code className="bg-[#ffd60a]/20 px-1 rounded">.env</code> file. 
              Without credentials, all verification providers use clearly-labelled mock simulators. 
              Never expose API keys to the frontend.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
