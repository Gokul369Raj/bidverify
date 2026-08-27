"use client";
import { useEffect, useState, useRef } from "react";
import AdminGate from "@/components/AdminGate";
import Link from "next/link";
import {
  Shield, Users, FileText, BarChart3, Activity, Search, ChevronDown,
  ChevronUp, Eye, EyeOff, Phone, Mail, Clock, TrendingUp, CheckCircle2,
  AlertCircle, Settings, Loader2, Building2, IndianRupee, Plus, Zap,
  Play, Scale, ClipboardList, BadgeCheck, Landmark, RefreshCw, Check,
  X, FileCheck, AlertTriangle, BarChart, ShieldCheck, Database, Cpu,
} from "lucide-react";

// ───────────── Types ─────────────
interface UserData {
  id: string; name: string; email: string; phone: string | null; aadharNumber: string | null;
  role: string; authProvider: string; isActive: boolean; loginCount: number;
  lastLoginAt: string | null; lastLoginIp: string | null; emailVerifiedAt: string | null;
  organization: { id: string; legalName: string; gstin: string | null; pan: string | null; udyamNumber: string | null } | null;
  notificationCount: number; auditLogCount: number; createdAt: string;
}
interface TenderData {
  id: string; tenderNumber: string; title: string; description?: string;
  buyerOrganization: string; category: string | null; state: string | null; city: string | null;
  closingDate: string; status: string; estimatedValueLakh: number | null;
  requirementCount: number; bidCount: number;
  requirements: { id: string; code: string; type: string; title: string; mandatory: boolean; status: string; description?: string }[];
  bids: { id: string; bidNumber: string; status: string; complianceScore: number | null; riskLevel: string | null;
    organization: { legalName: string; gstin: string | null }; createdAt: string }[];
}
interface Analytics {
  users: { total: number; bidders: number; officers: number; admins: number };
  tenders: { total: number; active: number };
  bids: { total: number; submitted: number; verified: number };
  organizations: number; requirements: number; complianceResults: number; auditLogs: number;
  notifications: { total: number; unread: number }; aiRuns: number;
  recentLogins: { actorEmail: string; action: string; createdAt: string; ip: string | null }[];
  topUsers: { name: string; email: string; loginCount: number; role: string }[];
}
interface AuditEntry {
  id: string; actorEmail: string; actorRole: string; action: string;
  entityType: string; entityId: string | null; createdAt: string;
}
interface RuleData {
  id: string; code: string; name: string; requirementType: string; weight: number;
  version: number; active: boolean; source: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-900/40 text-red-400 border border-red-800/50", PROCUREMENT_OFFICER: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
  BID_EVALUATION_OFFICER: "bg-indigo-900/40 text-indigo-400 border border-indigo-800/50", COMPLIANCE_REVIEWER: "bg-purple-900/40 text-purple-400 border border-purple-800/50",
  AUDITOR: "bg-amber-900/40 text-amber-400 border border-amber-800/50", SYSTEM_ADMIN: "bg-red-900/40 text-red-400 border border-red-800/50", BIDDER: "bg-green-900/40 text-green-400 border border-green-800/50",
};

type Tab = "tenders" | "bids" | "verification" | "compliance" | "users" | "rules" | "audit" | "settings" | "stats" | "applications" | "documents";

const EDIT_INP = "w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none bg-[var(--surface)]";

function AdminContent() {
  const [tab, setTab] = useState<Tab>("tenders");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [tenders, setTenders] = useState<TenderData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [rules, setRules] = useState<RuleData[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [adminDocs, setAdminDocs] = useState<any>({ documents: [], userSummaries: [], stats: {}, users: [] });
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTender, setExpandedTender] = useState<string | null>(null);
  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [showAadhar, setShowAadhar] = useState<Record<string, boolean>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [verifying, setVerifying] = useState<string | null>(null);

  // Tender creation
  const [showCreateTender, setShowCreateTender] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState("");
  const [tenderForm, setTenderForm] = useState({ title: "", tenderNumber: "", buyerOrganization: "", description: "", category: "", state: "", city: "", closingDate: "", estimatedValueLakh: "", tenderText: "" });
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [ocrUploading, setOcrUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [editingTender, setEditingTender] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState("");
  const [expandedAdminDoc, setExpandedAdminDoc] = useState<string | null>(null);

  function flash(msg: string) {
    setAdminNotice(msg);
    setTimeout(() => setAdminNotice(""), 3500);
  }

  async function saveTenderEdit(id: string, tenderNumber: string) {
    if (!editForm) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/tenders/${id}`, {
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
      // Instant local update — bidders see the change without any refresh/deploy.
      setTenders((prev) => prev.map((t) => (t.id === id ? { ...t, ...d.data.tender } : t)));
      setEditingTender(null);
      flash(`✓ ${tenderNumber} updated — live on the site instantly.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTender(t: TenderData) {
    if (!window.confirm(`Delete ${t.tenderNumber} permanently?\nThis removes its bids, documents and verification records.`)) return;
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

  // Compliance results
  const [complianceResults, setComplianceResults] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [aRes, uRes, tRes, alRes, rRes, appsRes, docsRes] = await Promise.all([
      fetch("/api/admin/analytics"),
      fetch("/api/admin/users?limit=50"),
      fetch("/api/admin/tenders?limit=50"),
      fetch("/api/audit"),
      fetch("/api/admin/rules"),
      fetch("/api/officer/applications").catch(() => ({ json: () => ({ ok: false }) })),
      fetch("/api/admin/documents").catch(() => ({ json: () => ({ ok: false, data: { documents: [], userSummaries: [], stats: {}, users: [] } }) })),
    ]);
    const [a, u, t, al, r, apps, docs] = await Promise.all([aRes.json(), uRes.json(), tRes.json(), alRes.json(), rRes.json(), appsRes.json(), docsRes.json()]);
    if (a.ok) setAnalytics(a.data);
    if (u.ok) setUsers(u.data.users);
    if (t.ok) setTenders(t.data.tenders);
    if (al.ok) setAuditLogs(al.data.logs ?? []);
    if (r.ok) setRules(r.data.rules ?? []);
    if (apps.ok) setApplications(apps.data.applications ?? []);
    if (docs.ok) setAdminDocs(docs.data);
    setLoading(false);
  }

  async function handleCreateTender(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateSuccess("");
    try {
      const form = new FormData();
      Object.entries(tenderForm).forEach(([k, v]) => { if (v) form.append(k, v); });
      if (tenderFile) form.append("file", tenderFile);
      form.append("runAi", "true");
      if (requiredDocs.length > 0) form.append("requiredDocs", JSON.stringify(requiredDocs));
      const res = await fetch("/api/tenders", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCreateSuccess(`Tender ${data.data.tenderNumber} created! ${data.data.requirementCount} requirements extracted by AI.`);
      setTenderForm({ title: "", tenderNumber: "", buyerOrganization: "", description: "", category: "", state: "", city: "", closingDate: "", estimatedValueLakh: "", tenderText: "" });
      setRequiredDocs([]);
      setTenderFile(null);
      loadAll();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : "Failed"); }
    setCreating(false);
  }

  async function handleOcrUpload() {
    if (!tenderFile) { alert("Please select a PDF file first."); return; }
    if (!tenderForm.tenderNumber || !tenderForm.title || !tenderForm.buyerOrganization || !tenderForm.closingDate) {
      alert("Please fill in Tender Number, Title, Buyer Organization, and Closing Date first.");
      return;
    }
    setOcrUploading(true);
    try {
      const form = new FormData();
      form.append("file", tenderFile);
      form.append("title", tenderForm.title);
      form.append("tenderNumber", tenderForm.tenderNumber);
      form.append("buyerOrganization", tenderForm.buyerOrganization);
      form.append("closingDate", tenderForm.closingDate);
      form.append("description", tenderForm.description);
      form.append("category", tenderForm.category);
      form.append("state", tenderForm.state);
      form.append("city", tenderForm.city);
      form.append("estimatedValueLakh", tenderForm.estimatedValueLakh);
      form.append("requiredDocs", JSON.stringify(requiredDocs));
      const res = await fetch("/api/tenders/ocr", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setOcrResult(data.data);
      setCreateSuccess(`Tender ${data.data.tenderNumber} created with ${data.data.requirementCount} requirements via OCR. ${data.data.ocrPreview ? "Text extracted successfully." : ""}`);
      setTenderForm({ title: "", tenderNumber: "", buyerOrganization: "", description: "", category: "", state: "", city: "", closingDate: "", estimatedValueLakh: "", tenderText: "" });
      setRequiredDocs([]);
      setTenderFile(null);
      setScanResult(null);
      loadAll();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : "OCR upload failed"); }
    setOcrUploading(false);
  }

  async function handleScanPdf(file: File) {
    setScanning(true);
    setScanResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tenders/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setScanResult(data.data);
      const f = data.data.fields;
      setTenderForm((p) => ({
        ...p,
        tenderNumber: f.tenderNumber || p.tenderNumber,
        title: f.title || p.title,
        buyerOrganization: f.buyerOrganization || p.buyerOrganization,
        category: f.category || p.category,
        state: f.state || p.state,
        closingDate: f.closingDate || p.closingDate,
        estimatedValueLakh: f.estimatedValueLakh || p.estimatedValueLakh,
      }));
      if (f.requiredDocs?.length > 0) setRequiredDocs(f.requiredDocs);
    } catch (err: unknown) {
      console.error("Scan failed:", err);
    }
    setScanning(false);
  }

  async function approveAllReqs(tenderId: string) {
    await fetch(`/api/tenders/${tenderId}/requirements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approveAll" }) });
    loadAll();
  }

  async function runVerification(bidId: string) {
    setVerifying(bidId);
    await fetch(`/api/bids/${bidId}/verify`, { method: "POST" });
    setVerifying(null);
    loadAll();
  }

  async function recordDecision(bidId: string, decision: string, isChange = false) {
    const label = decision === "COMPLIANT" ? "PASS" : decision === "CONDITIONAL" ? "HOLD" : "FAIL";
    if (!confirm(`Are you sure you want to ${isChange ? "change decision to" : ""} ${label} this bid?\nThe bidder will be notified immediately.`)) return;
    const body: any = { decision, notes: `Decided from admin panel — ${label}` };
    if (isChange) body.changeDecision = true;
    await fetch(`/api/bids/${bidId}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadAll();
  }

  function handleUserSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (userSearch) params.set("q", userSearch);
    if (userRole) params.set("role", userRole);
    fetch(`/api/admin/users?${params}`).then((r) => r.json()).then((d) => { if (d.ok) setUsers(d.data.users); setLoading(false); });
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--accent)] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><Landmark className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-base font-bold text-white">BIDGUARD AI — Admin Control Center</h1><p className="text-[10px] text-white/70">Government Procurement Control Center</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg hover:bg-white/30 flex items-center gap-1 font-medium"><RefreshCw className="w-3 h-3" /> Refresh</button>
            <Link href="/" className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg hover:bg-white/30">← Back to Site</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[var(--surface-2)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-0.5 overflow-x-auto">
          {([
            { id: "tenders" as Tab, label: "Tenders", icon: FileText },
            { id: "bids" as Tab, label: "Review Bids", icon: BadgeCheck },
            { id: "applications" as Tab, label: "Applications", icon: FileCheck },
            { id: "verification" as Tab, label: "Verification", icon: ShieldCheck },
            { id: "compliance" as Tab, label: "Compliance", icon: Scale },
            { id: "users" as Tab, label: "Users", icon: Users },
            { id: "rules" as Tab, label: "Rules", icon: ClipboardList },
            { id: "audit" as Tab, label: "Audit", icon: Activity },
            { id: "stats" as Tab, label: "Stats", icon: BarChart3 },
            { id: "documents" as Tab, label: "Documents", icon: FileText },
            { id: "settings" as Tab, label: "Settings", icon: Settings },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5" : "border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>}

        {/* ═══════ TENDERS & BIDS ═══════ */}
        {tab === "tenders" && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Active Tenders", value: tenders.filter((t) => t.status === "ACTIVE").length, color: "text-[var(--accent)]", icon: FileText },
                { label: "Total Bidders", value: analytics?.users.bidders ?? 0, color: "text-[var(--success)]", icon: Users },
                { label: "Bids Submitted", value: analytics?.bids.submitted ?? 0, color: "text-[var(--warning)]", icon: BadgeCheck },
                { label: "Verified Bids", value: analytics?.bids.verified ?? 0, color: "text-[var(--accent)]", icon: CheckCircle2 },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"><div className="flex items-center gap-2 mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-[var(--foreground-tertiary)]">{s.label}</span></div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></div>
              ))}
            </div>

            {/* Create Tender */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <button onClick={() => setShowCreateTender(!showCreateTender)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--surface-2)] transition-colors">
                <div className="flex items-center gap-2"><div className="w-8 h-8 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4 text-[var(--accent)]" /></div><span className="font-semibold text-[var(--foreground)] text-sm">Create New Tender</span></div>
                {showCreateTender ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
              </button>
              {showCreateTender && (
                <div className="border-t border-[var(--border)] p-5">
                  {createSuccess && <div className="mb-4 bg-[var(--success-light)] border border-[var(--success)] text-[var(--success)] text-sm rounded-lg px-4 py-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {createSuccess}</div>}
                  <form onSubmit={handleCreateTender} className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Tender Number *</label><input required className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.tenderNumber} onChange={(e) => setTenderForm((p) => ({ ...p, tenderNumber: e.target.value }))} placeholder="CPCL/PUMP/2026/014" /></div>
                      <div className="md:col-span-2"><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Title *</label><input required className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.title} onChange={(e) => setTenderForm((p) => ({ ...p, title: e.target.value }))} placeholder="Supply and Installation of..." /></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Buyer Organization *</label><input required className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.buyerOrganization} onChange={(e) => setTenderForm((p) => ({ ...p, buyerOrganization: e.target.value }))} placeholder="Chennai Petroleum Corporation Ltd" /></div>
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Category</label><input className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.category} onChange={(e) => setTenderForm((p) => ({ ...p, category: e.target.value }))} placeholder="Industrial Pumps" /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">State</label><input className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.state} onChange={(e) => setTenderForm((p) => ({ ...p, state: e.target.value }))} placeholder="Tamil Nadu" /></div>
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">City</label><input className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.city} onChange={(e) => setTenderForm((p) => ({ ...p, city: e.target.value }))} placeholder="Chennai" /></div>
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Closing Date *</label><input required type="date" className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.closingDate} onChange={(e) => setTenderForm((p) => ({ ...p, closingDate: e.target.value }))} /></div>
                      <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Est. Value (Lakh)</label><input type="number" className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" value={tenderForm.estimatedValueLakh} onChange={(e) => setTenderForm((p) => ({ ...p, estimatedValueLakh: e.target.value }))} placeholder="2500" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-2">Required Documents (select all that apply)</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { value: "GST_CERTIFICATE", label: "GST Certificate" },
                          { value: "PAN_CARD", label: "PAN Card" },
                          { value: "UDYAM_CERTIFICATE", label: "Udyam / MSME" },
                          { value: "EXPERIENCE_CERTIFICATE", label: "Experience Certificate" },
                          { value: "TURNOVER_PROOF", label: "Turnover Proof" },
                          { value: "COMPANY_CERTIFICATE", label: "Company Certificate" },
                          { value: "TECHNICAL_DATASHEET", label: "Technical Datasheet" },
                          { value: "OEM_AUTHORIZATION", label: "OEM Authorization" },
                          { value: "LOCAL_CONTENT_DECLARATION", label: "Local Content" },
                          { value: "FINANCIAL", label: "Financial Docs" },
                          { value: "EMD", label: "EMD / Security" },
                          { value: "BIS_CERTIFICATION", label: "BIS Certification" },
                        ].map((d) => (
                          <label key={d.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${requiredDocs.includes(d.value) ? "bg-[var(--accent-light)] border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--accent)]/50"}`}>
                            <input type="checkbox" className="sr-only" checked={requiredDocs.includes(d.value)} onChange={(e) => setRequiredDocs((p) => e.target.checked ? [...p, d.value] : p.filter((x) => x !== d.value))} />
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${requiredDocs.includes(d.value) ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)]"}`}>
                              {requiredDocs.includes(d.value) && <Check className="w-2.5 h-2.5" />}
                            </span>
                            {d.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Tender Text (paste for AI extraction)</label><textarea className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 h-28 resize-none" value={tenderForm.tenderText} onChange={(e) => setTenderForm((p) => ({ ...p, tenderText: e.target.value }))} placeholder="Paste tender document text here — AI will extract requirements..." /></div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-2">Upload Tender PDF — fields auto-fill</label>
                      <div className="relative border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-6 text-center transition-colors bg-[var(--surface-2)] cursor-pointer group" onClick={() => fileRef.current?.click()}>
                        <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setTenderFile(file);
                          if (file) handleScanPdf(file);
                        }} className="hidden" />
                        {tenderFile ? (
                          <div className="flex items-center justify-center gap-3">
                            <FileText className="w-8 h-8 text-[var(--accent)]" />
                            <div className="text-left">
                              <div className="text-sm font-medium text-[var(--foreground)]">{tenderFile.name}</div>
                              <div className="text-xs text-[var(--foreground-tertiary)]">{(tenderFile.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <FileText className="w-10 h-10 text-[var(--foreground-tertiary)] group-hover:text-[var(--accent)] mx-auto mb-2 transition-colors" />
                            <p className="text-sm font-medium text-[var(--foreground-secondary)]">Click to choose PDF or drag & drop</p>
                            <p className="text-xs text-[var(--foreground-tertiary)] mt-1">Auto-extracts tender number, title, buyer, dates & requirements</p>
                          </>
                        )}
                      </div>
                      {scanning && <div className="mt-2 text-xs text-[var(--accent)] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Scanning PDF and extracting fields...</div>}
                      {scanResult && !scanning && <div className="mt-2 text-xs text-[var(--success)] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> All fields auto-filled from PDF — review below</div>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={creating} className="bg-[var(--accent)] text-[var(--background)] font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm flex items-center gap-2 disabled:opacity-50">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {creating ? "Creating & AI Extracting..." : "Create Tender with AI Extraction"}
                      </button>
                      {tenderFile && (
                        <button type="button" onClick={handleOcrUpload} disabled={ocrUploading} className="bg-[var(--success)] text-white font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm flex items-center gap-2 disabled:opacity-50">
                          {ocrUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          {ocrUploading ? "Creating Tender..." : "Create Tender from PDF"}
                        </button>
                      )}
                    </div>
                  </form>

                  {/* OCR Extracted Text Preview */}
                  {scanResult?.ocrText && (
                    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCheck className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-xs font-medium text-[var(--foreground-secondary)]">Extracted Text from PDF (first 1500 chars)</span>
                      </div>
                      <pre className="text-[11px] text-[var(--foreground-tertiary)] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed font-mono">{scanResult.ocrText.slice(0, 1500)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tender List */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="px-5 py-4 border-b border-[var(--border)]"><h3 className="font-semibold text-[var(--foreground)] text-sm">All Tenders ({tenders.length})</h3></div>
              {adminNotice && (
        <div className="m-4 rounded-xl border border-[var(--success)] bg-[var(--success-light)] px-4 py-3 text-sm text-[var(--success)]">{adminNotice}</div>
      )}
<div className="divide-y divide-[var(--border)]">
                {tenders.map((t) => {
                  const isExp = expandedTender === t.id;
                  const days = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / 86400000);
                  const pendingReqs = t.requirements.filter((r) => r.status === "DRAFT").length;
                  return (
                    <div key={t.id} className="px-5 py-3">
                      <button onClick={() => setExpandedTender(isExp ? null : t.id)} className="w-full text-left">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-xs text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded">{t.tenderNumber}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.status === "ACTIVE" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{t.status}</span>
                              {pendingReqs > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--warning-light)] text-[var(--warning)] font-medium">{pendingReqs} pending reqs</span>}
                              <span className={`text-[10px] font-medium ${days <= 3 ? "text-[var(--danger)]" : days <= 7 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>{days}d left</span>
                            </div>
                            <div className="text-sm font-medium text-[var(--foreground)] truncate">{t.title}</div>
                            <div className="text-xs text-[var(--foreground-tertiary)] mt-0.5">{t.buyerOrganization} · {t.category} · {[t.city, t.state].filter(Boolean).join(", ")}</div>
                          </div>
                          <div className="text-right shrink-0"><div className="text-sm font-semibold text-[var(--foreground-secondary)]">{t.requirementCount} reqs</div><div className="text-xs text-[var(--foreground-tertiary)]">{t.bidCount} bids</div></div>
                          {isExp ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                        </div>
                      </button>
                      {isExp && (
                        <div className="mt-4 ml-4 space-y-4">
                          {/* ── Manage: Edit / Delete (affects bidder site instantly) ── */}
                          {editingTender === t.id && editForm ? (
                            <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-light)] p-4 space-y-3">
                              <h4 className="text-sm font-semibold text-[var(--foreground)]">Edit tender — changes go live for bidders instantly</h4>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2"><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Title</label><input className={EDIT_INP} value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Buyer Organization</label><input className={EDIT_INP} value={editForm.buyerOrganization} onChange={(e) => setEditForm((p) => ({ ...p, buyerOrganization: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Status</label>
                                  <select className={EDIT_INP + " cursor-pointer"} value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                                    {["ACTIVE", "CLOSED", "CANCELLED"].map((x) => <option key={x} value={x}>{x}</option>)}
                                  </select>
                                </div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Category</label><input className={EDIT_INP} value={editForm.category ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">State</label><input className={EDIT_INP} value={editForm.state ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">City</label><input className={EDIT_INP} value={editForm.city ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Value (₹ Lakh)</label><input type="number" className={EDIT_INP} value={editForm.estimatedValueLakh ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, estimatedValueLakh: e.target.value }))} /></div>
                                <div><label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Closing Date</label><input type="date" className={EDIT_INP} value={editForm.closingDate?.slice(0, 10)} onChange={(e) => setEditForm((p) => ({ ...p, closingDate: e.target.value }))} /></div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => saveTenderEdit(t.id, t.tenderNumber)} disabled={busyId === t.id} className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                                  {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save & Go Live
                                </button>
                                <button onClick={() => setEditingTender(null)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--foreground-secondary)] text-sm hover:bg-[var(--surface-2)]">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingTender(t.id);
                                  setEditForm({
                                    title: t.title, buyerOrganization: t.buyerOrganization,
                                    category: t.category ?? "", state: t.state ?? "", city: t.city ?? "",
                                    status: t.status,
                                    estimatedValueLakh: t.estimatedValueLakh != null ? String(t.estimatedValueLakh) : "",
                                    closingDate: new Date(t.closingDate).toISOString(),
                                  });
                                }}
                                className="px-4 py-1.5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90"
                              >
                                ✏️ Edit tender
                              </button>
                              <button
                                onClick={() => deleteTender(t)}
                                disabled={busyId === t.id}
                                className="px-4 py-1.5 rounded-full bg-[var(--danger-light)] border border-[var(--danger)] text-[var(--danger)] text-xs font-medium hover:opacity-80 disabled:opacity-50"
                              >
                                🗑 Delete tender
                              </button>
                              <span className="text-[11px] text-[var(--foreground-tertiary)]">Edits and deletes reflect on the bidder site immediately.</span>
                            </div>
                          )}
                          {t.requirements.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-[var(--foreground-secondary)]">Requirements ({t.requirements.length})</h4>
                                {pendingReqs > 0 && <button onClick={() => approveAllReqs(t.id)} className="text-[10px] bg-[var(--success-light)] text-[var(--success)] px-3 py-1 rounded-full font-medium hover:opacity-80"><Check className="w-3 h-3 inline" /> Approve All ({pendingReqs})</button>}
                              </div>
                              <div className="grid md:grid-cols-2 gap-1.5">
                                {t.requirements.map((r) => (
                                  <div key={r.id} className="flex items-center gap-2 text-xs bg-[var(--surface-2)] px-3 py-1.5 rounded">
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${r.mandatory ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface)] text-[var(--foreground-secondary)]"}`}>{r.mandatory ? "M" : "O"}</span>
                                    <span className="font-mono text-[var(--foreground-tertiary)]">{r.code}</span>
                                    <span className="text-[var(--foreground-secondary)] truncate flex-1">{r.title}</span>
                                    <span className={`text-[10px] font-medium ${r.status === "APPROVED" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{r.status}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {t.bids.length > 0 ? (
                            <div className="flex items-center justify-between bg-[var(--surface-2)] rounded-lg px-4 py-2.5">
                              <span className="text-xs text-[var(--foreground-secondary)]">{t.bids.length} bid(s) submitted</span>
                              <button onClick={() => setTab("bids")} className="text-[10px] text-[var(--accent)] hover:opacity-80 font-medium">View in Review Bids →</button>
                            </div>
                          ) : <p className="text-xs text-[var(--foreground-tertiary)] text-center py-2">No bids yet</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ REVIEW BIDS ═══════ */}
        {tab === "bids" && !loading && (
          <div className="space-y-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="font-semibold text-[var(--foreground)] text-sm">All Submitted Bids</h3>
                <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5">Newest bids appear first. Click a bid to view full details, documents, scores, and take action.</p>
              </div>
              {(() => {
                const allBids = tenders.flatMap((t) => t.bids.map((b: any) => ({ ...b, tenderNumber: t.tenderNumber, tenderTitle: t.title, closingDate: t.closingDate, requirements: t.requirements }))).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                if (allBids.length === 0) {
                  return <div className="px-5 py-8 text-center text-sm text-[var(--foreground-tertiary)]">No bids submitted yet.</div>;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Tender</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Bidder</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Submitted</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Required Documents</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Status</th>
                          <th className="text-right py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Score</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Decision</th>
                          <th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allBids.map((b: any) => (
                          <tr key={b.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer" onClick={() => window.location.href = `/admin/bids/${b.id}`}>
                            <td className="py-2 px-3">
                              <div className="font-mono text-[var(--accent)]">{b.tenderNumber}</div>
                              <div className="text-[var(--foreground-tertiary)] truncate max-w-[150px]">{b.tenderTitle}</div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-medium text-[var(--foreground)]">{b.organization.legalName}</div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="text-[var(--foreground-secondary)]">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                              <div className="text-[10px] text-[var(--foreground-tertiary)]">{new Date(b.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                            </td>
                            <td className="py-2 px-3">
                              {b.requirements && b.requirements.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[260px]">
                                  {b.requirements.map((r: any) => (
                                    <span key={r.id} className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${r.mandatory ? "bg-[var(--danger-light)]/50 text-[var(--danger)] border-[var(--danger)]/30" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)]"}`}>
                                      {r.title || r.code}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-[var(--foreground-tertiary)]">—</span>}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${b.status === "VERIFIED" ? "bg-[var(--success-light)] text-[var(--success)]" : b.status === "SUBMITTED" ? "bg-[var(--accent-light)] text-[var(--accent)]" : b.status === "WITHDRAWN" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{b.status}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold">{b.complianceScore != null ? b.complianceScore : "—"}</td>
                            <td className="py-2 px-3">
                              {b.officerDecision ? (
                                <span className={`font-medium ${b.officerDecision === "COMPLIANT" ? "text-[var(--success)]" : b.officerDecision === "CONDITIONAL" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>{b.officerDecision === "COMPLIANT" ? "APPROVED" : b.officerDecision === "CONDITIONAL" ? "HOLD" : "REJECTED"}</span>
                              ) : <span className="text-[var(--foreground-tertiary)]">—</span>}
                            </td>
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 items-center flex-wrap">
                                <a href={`/admin/bids/${b.id}`} className="text-[10px] bg-[var(--accent-light)] text-[var(--accent)] px-2 py-0.5 rounded font-medium hover:opacity-80 flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" /> View
                                </a>
                                {(b.status === "SUBMITTED" || b.status === "VERIFIED") && !b.officerDecision && (
                                  <>
                                    <button onClick={() => recordDecision(b.id, "COMPLIANT")} className="text-[10px] bg-[var(--success)] text-white px-2 py-0.5 rounded font-bold hover:opacity-90 flex items-center gap-0.5 shadow-sm">
                                      <Check className="w-3 h-3" /> PASS
                                    </button>
                                    <button onClick={() => recordDecision(b.id, "CONDITIONAL")} className="text-[10px] bg-[var(--warning)] text-[var(--background)] px-2 py-0.5 rounded font-bold hover:opacity-90 flex items-center gap-0.5 shadow-sm">
                                      HOLD
                                    </button>
                                    <button onClick={() => recordDecision(b.id, "NON_COMPLIANT")} className="text-[10px] bg-[var(--danger)] text-white px-2 py-0.5 rounded font-bold hover:opacity-90 flex items-center gap-0.5 shadow-sm">
                                      <X className="w-3 h-3" /> FAIL
                                    </button>
                                  </>
                                )}
                                {b.officerDecision && b.status === "DECIDED" && (
                                  <div className="flex gap-1 items-center flex-wrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${b.officerDecision === "COMPLIANT" ? "bg-[var(--success-light)] text-[var(--success)]" : b.officerDecision === "CONDITIONAL" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>
                                      {b.officerDecision === "COMPLIANT" ? "APPROVED" : b.officerDecision === "CONDITIONAL" ? "HOLD" : "REJECTED"}
                                    </span>
                                    {b.officerDecision !== "COMPLIANT" && (
                                      <button onClick={() => recordDecision(b.id, "COMPLIANT", true)} className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-1.5 py-0.5 rounded font-medium hover:bg-[var(--success)]/30 border border-[var(--success)]/30">
                                        → PASS
                                      </button>
                                    )}
                                    {b.officerDecision !== "CONDITIONAL" && (
                                      <button onClick={() => recordDecision(b.id, "CONDITIONAL", true)} className="text-[10px] bg-[var(--warning)]/20 text-[var(--warning)] px-1.5 py-0.5 rounded font-medium hover:bg-[var(--warning)]/30 border border-[var(--warning)]/30">
                                        → HOLD
                                      </button>
                                    )}
                                    {b.officerDecision !== "NON_COMPLIANT" && (
                                      <button onClick={() => recordDecision(b.id, "NON_COMPLIANT", true)} className="text-[10px] bg-[var(--danger)]/20 text-[var(--danger)] px-1.5 py-0.5 rounded font-medium hover:bg-[var(--danger)]/30 border border-[var(--danger)]/30">
                                        → FAIL
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Bid Detail Panel */}
              {expandedBid && (() => {
                const allBids = tenders.flatMap((t) => t.bids.map((b: any) => ({ ...b, tenderNumber: t.tenderNumber, tenderTitle: t.title, closingDate: t.closingDate, requirements: t.requirements })));
                const bid = allBids.find((b: any) => b.id === expandedBid);
                if (!bid) return null;
                return (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-[var(--foreground)] text-sm">{bid.organization.legalName} — {bid.tenderNumber}</h4>
                        <p className="text-xs text-[var(--foreground-secondary)]">{bid.tenderTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {bid.complianceScore != null && (
                          <div className={`text-2xl font-bold ${bid.complianceScore >= 75 ? "text-[var(--success)]" : bid.complianceScore >= 45 ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>
                            {bid.complianceScore}/100
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Requirements checklist */}
                    {bid.requirements && bid.requirements.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-2">Tender Requirements</h5>
                        <div className="grid md:grid-cols-2 gap-1.5">
                          {bid.requirements.map((r: any) => (
                            <div key={r.id} className="flex items-center gap-2 text-xs bg-[var(--surface)] px-3 py-1.5 rounded border border-[var(--border)]">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${r.mandatory ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{r.mandatory ? "M" : "O"}</span>
                              <span className="font-mono text-[var(--foreground-tertiary)]">{r.code}</span>
                              <span className="text-[var(--foreground-secondary)] truncate flex-1">{r.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
                      {(bid.status === "SUBMITTED" || bid.status === "VERIFIED") && !bid.officerDecision && (
                        <>
                          <button onClick={() => recordDecision(bid.id, "COMPLIANT")} className="bg-[var(--success)] text-white px-4 py-1.5 rounded text-xs font-bold hover:opacity-90 flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3" /> PASS
                          </button>
                          <button onClick={() => recordDecision(bid.id, "CONDITIONAL")} className="bg-[var(--warning)] text-[var(--background)] px-4 py-1.5 rounded text-xs font-bold hover:opacity-90 flex items-center gap-1 shadow-sm">
                            HOLD
                          </button>
                          <button onClick={() => recordDecision(bid.id, "NON_COMPLIANT")} className="bg-[var(--danger)] text-white px-4 py-1.5 rounded text-xs font-bold hover:opacity-90 flex items-center gap-1 shadow-sm">
                            <X className="w-3 h-3" /> FAIL
                          </button>
                        </>
                      )}
                      {bid.officerDecision && bid.status === "DECIDED" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-medium px-3 py-1.5 rounded ${bid.officerDecision === "COMPLIANT" ? "bg-[var(--success-light)] text-[var(--success)]" : bid.officerDecision === "CONDITIONAL" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>
                            Decision: {bid.officerDecision === "COMPLIANT" ? "APPROVED" : bid.officerDecision === "CONDITIONAL" ? "HOLD" : "REJECTED"}
                          </span>
                          {bid.officerDecision !== "COMPLIANT" && (
                            <button onClick={() => recordDecision(bid.id, "COMPLIANT", true)} className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-2 py-1 rounded font-medium hover:bg-[var(--success)]/30 border border-[var(--success)]/30">
                              → Change to PASS
                            </button>
                          )}
                          {bid.officerDecision !== "CONDITIONAL" && (
                            <button onClick={() => recordDecision(bid.id, "CONDITIONAL", true)} className="text-[10px] bg-[var(--warning)]/20 text-[var(--warning)] px-2 py-1 rounded font-medium hover:bg-[var(--warning)]/30 border border-[var(--warning)]/30">
                              → Change to HOLD
                            </button>
                          )}
                          {bid.officerDecision !== "NON_COMPLIANT" && (
                            <button onClick={() => recordDecision(bid.id, "NON_COMPLIANT", true)} className="text-[10px] bg-[var(--danger)]/20 text-[var(--danger)] px-2 py-1 rounded font-medium hover:bg-[var(--danger)]/30 border border-[var(--danger)]/30">
                              → Change to FAIL
                            </button>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-[var(--foreground-tertiary)] ml-auto">{bid.documentCount} document(s)</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ═══════ VERIFICATION QUEUE ═══════ */}
        {tab === "verification" && !loading && (
          <div className="space-y-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[var(--accent)]" /> Verification Queue</h3>
              {tenders.flatMap((t) => t.bids.filter((b) => b.status === "SUBMITTED" || b.status === "DRAFT").map((b) => ({ ...b, tenderNumber: t.tenderNumber, tenderTitle: t.title }))).length === 0 ? (
                <div className="text-center py-8 text-[var(--foreground-tertiary)] text-sm">No bids pending verification</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Tender</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Bidder</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Status</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Action</th></tr></thead>
                    <tbody>
                      {tenders.flatMap((t) => t.bids.filter((b) => b.status === "SUBMITTED" || b.status === "DRAFT").map((b) => ({ ...b, tenderNumber: t.tenderNumber, tenderTitle: t.title }))).map((b) => (
                        <tr key={b.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                          <td className="py-2 px-3"><div className="font-medium text-[var(--foreground)]">{b.tenderNumber}</div><div className="text-[var(--foreground-tertiary)] truncate max-w-[200px]">{b.tenderTitle}</div></td>
                          <td className="py-2 px-3 font-medium text-[var(--foreground)]">{b.organization.legalName}</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{b.status}</span></td>
                          <td className="py-2 px-3"><button onClick={() => runVerification(b.id)} disabled={verifying === b.id} className="bg-[var(--warning)] text-[var(--background)] px-3 py-1 rounded text-[10px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1">{verifying === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run Verification</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Already Verified */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Verified Bids</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Tender</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Bidder</th><th className="text-right py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Score</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Risk</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Decision</th><th className="text-left py-2 px-3 font-semibold text-[var(--foreground-secondary)]">Action</th></tr></thead>
                  <tbody>
                    {tenders.flatMap((t) => t.bids.filter((b) => b.status === "VERIFIED" || b.status === "DECIDED").map((b) => ({ ...b, tenderNumber: t.tenderNumber }))).map((b) => (
                      <tr key={b.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                        <td className="py-2 px-3 font-mono text-[var(--foreground-secondary)]">{b.tenderNumber}</td>
                        <td className="py-2 px-3 font-medium text-[var(--foreground)]">{b.organization.legalName}</td>
                        <td className="py-2 px-3 text-right font-bold text-lg">{b.complianceScore ?? "—"}</td>
                        <td className="py-2 px-3"><span className={`font-medium ${b.riskLevel === "LOW" ? "text-[var(--success)]" : b.riskLevel === "MEDIUM" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>{b.riskLevel ?? "—"}</span></td>
                        <td className="py-2 px-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${b.status === "DECIDED" ? "bg-purple-900/40 text-purple-400 border border-purple-800/50" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{b.status}</span></td>
                        <td className="py-2 px-3 flex gap-1">
                          {!b.riskLevel && <button onClick={() => runVerification(b.id)} className="text-[10px] bg-[var(--warning-light)] text-[var(--warning)] px-2 py-0.5 rounded font-medium">Re-verify</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ COMPLIANCE ═══════ */}
        {tab === "compliance" && !loading && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><Scale className="w-4 h-4 text-[var(--accent)]" /> Compliance Overview</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Compliance Results", value: analytics?.complianceResults ?? 0, color: "text-[var(--accent)]" },
                { label: "Requirements Tracked", value: analytics?.requirements ?? 0, color: "text-[var(--accent)]" },
                { label: "AI Runs", value: analytics?.aiRuns ?? 0, color: "text-[var(--warning)]" },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--surface-2)] rounded-lg p-4"><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div><div className="text-xs text-[var(--foreground-secondary)]">{s.label}</div></div>
              ))}
            </div>
            <div className="text-sm text-[var(--foreground-secondary)]">
              <p>Compliance results are generated automatically when verification is run on a bid.</p>
              <p className="mt-2">Each requirement is evaluated against: documents, verification results, and deterministic rules.</p>
              <p className="mt-2">Go to <strong>Tenders & Bids</strong> tab to expand a tender and view requirement compliance details.</p>
            </div>
          </div>
        )}

        {/* ═══════ USERS ═══════ */}
        {tab === "users" && !loading && (
          <div className="space-y-4">
            <form onSubmit={handleUserSearch} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative"><Search className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name, email, phone, or Aadhar..." className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] bg-[var(--surface-2)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" /></div>
              <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface)] text-[var(--foreground)]"><option value="">All Roles</option>{Object.keys(ROLE_COLORS).map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</select>
              <button type="submit" className="bg-[var(--accent)] text-[var(--background)] px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">Search</button>
            </form>
            <div className="space-y-3">{users.map((u) => {
              const isExp = expandedUser === u.id;
              return (
                <div key={u.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedUser(isExp ? null : u.id)} className="w-full text-left p-4 hover:bg-[var(--surface-2)] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[var(--surface-2)] rounded-full flex items-center justify-center text-sm font-bold text-[var(--foreground-secondary)]">{u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-semibold text-[var(--foreground)] text-sm">{u.name}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{u.role.replace(/_/g, " ")}</span></div><div className="text-xs text-[var(--foreground-tertiary)] flex items-center gap-3 mt-0.5"><span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>{u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span>}</div></div>
                      <div className="text-right shrink-0"><div className="text-sm font-bold text-[var(--accent)]">{u.loginCount} logins</div><div className="text-[10px] text-[var(--foreground-tertiary)]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : "Never"}</div></div>
                      {isExp ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                    </div>
                  </button>
                  {isExp && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-5">
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div><h4 className="text-xs font-semibold text-[var(--foreground-secondary)] uppercase mb-3">Personal</h4><div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Name</span><span className="font-medium text-[var(--foreground)]">{u.name}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Email</span><span className="font-medium text-[var(--foreground)]">{u.email}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Phone</span><span className="font-medium text-[var(--foreground)]">{u.phone ?? "—"}</span></div>
                          <div className="flex justify-between items-center"><span className="text-[var(--foreground-secondary)]">Aadhar</span><span className="font-mono text-[var(--foreground)] flex items-center gap-1">{u.aadharNumber ? (showAadhar[u.id] ? u.aadharNumber : "XXXX-XXXX-" + u.aadharNumber.slice(-4)) : "—"}{u.aadharNumber && <button onClick={(e) => { e.stopPropagation(); setShowAadhar((p) => ({ ...p, [u.id]: !p[u.id] })); }} className="text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]">{showAadhar[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>}</span></div>
                        </div></div>
                        <div><h4 className="text-xs font-semibold text-[var(--foreground-secondary)] uppercase mb-3">Activity</h4><div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Logins</span><span className="font-bold text-[var(--accent)]">{u.loginCount}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Last Login</span><span className="font-medium text-[var(--foreground)]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : "Never"}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Status</span><span className={`font-medium ${u.isActive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{u.isActive ? "Active" : "Inactive"}</span></div>
                        </div></div>
                        <div><h4 className="text-xs font-semibold text-[var(--foreground-secondary)] uppercase mb-3">Organization</h4>
                          {u.organization ? <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Legal Name</span><span className="font-medium text-[var(--foreground)] text-right max-w-[180px]">{u.organization.legalName}</span></div><div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">GSTIN</span><span className="font-mono text-xs">{u.organization.gstin ?? "—"}</span></div><div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">PAN</span><span className="font-mono text-xs">{u.organization.pan ?? "—"}</span></div></div> : <p className="text-sm text-[var(--foreground-tertiary)]">No organization</p>}
                          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--foreground-tertiary)]">Joined: {new Date(u.createdAt).toLocaleDateString("en-IN")}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}</div>
          </div>
        )}

        {/* ═══════ RULES ═══════ */}
        {tab === "rules" && !loading && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)]"><h3 className="font-semibold text-[var(--foreground)] text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[var(--accent)]" /> Compliance Rules ({rules.length})</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Code</th><th className="text-left py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Name</th><th className="text-left py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Type</th><th className="text-right py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Weight</th><th className="text-right py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Version</th><th className="text-left py-2 px-4 font-semibold text-[var(--foreground-secondary)]">Status</th></tr></thead>
                <tbody>{rules.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="py-2 px-4 font-mono text-[var(--foreground-secondary)]">{r.code}</td>
                    <td className="py-2 px-4 font-medium text-[var(--foreground)]">{r.name}</td>
                    <td className="py-2 px-4 text-[var(--foreground-secondary)]">{r.requirementType}</td>
                    <td className="py-2 px-4 text-right font-bold">{r.weight}</td>
                    <td className="py-2 px-4 text-right">v{r.version}</td>
                    <td className="py-2 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.active ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"}`}>{r.active ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════ AUDIT ═══════ */}
        {tab === "audit" && !loading && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)]"><h3 className="font-semibold text-[var(--foreground)] text-sm">Audit Trail ({auditLogs.length})</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)]"><th className="text-left py-2 px-4 text-xs font-semibold text-[var(--foreground-secondary)]">Actor</th><th className="text-left py-2 px-4 text-xs font-semibold text-[var(--foreground-secondary)]">Action</th><th className="text-left py-2 px-4 text-xs font-semibold text-[var(--foreground-secondary)]">Entity</th><th className="text-left py-2 px-4 text-xs font-semibold text-[var(--foreground-secondary)]">Time</th></tr></thead>
                <tbody>{auditLogs.slice(0, 50).map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]"><td className="py-2 px-4 text-xs text-[var(--foreground)]">{l.actorEmail}</td><td className="py-2 px-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{l.action}</span></td><td className="py-2 px-4 text-xs text-[var(--foreground-secondary)]">{l.entityType}</td><td className="py-2 px-4 text-xs text-[var(--foreground-tertiary)]">{new Date(l.createdAt).toLocaleString("en-IN")}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════ STATS ═══════ */}
        {tab === "stats" && !loading && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: analytics.users.total, sub: `${analytics.users.bidders} bidders, ${analytics.users.officers} officers`, color: "text-[var(--accent)]" },
                { label: "Active Tenders", value: analytics.tenders.active, sub: `${analytics.tenders.total} total`, color: "text-[var(--accent)]" },
                { label: "Total Bids", value: analytics.bids.total, sub: `${analytics.bids.verified} verified`, color: "text-[var(--success)]" },
                { label: "Organizations", value: analytics.organizations, sub: `${analytics.requirements} requirements`, color: "text-[var(--warning)]" },
              ].map((s) => <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"><div className="text-xs text-[var(--foreground-tertiary)] mb-1">{s.label}</div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div><div className="text-xs text-[var(--foreground-tertiary)] mt-1">{s.sub}</div></div>)}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"><h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--accent)]" /> Most Active Users</h3><div className="space-y-3">{analytics.topUsers.map((u, i) => <div key={i} className="flex items-center gap-3"><div className="w-8 h-8 bg-[var(--surface-2)] rounded-full flex items-center justify-center text-xs font-bold text-[var(--foreground-secondary)]">{i + 1}</div><div className="flex-1 min-w-0"><div className="text-sm font-medium text-[var(--foreground)] truncate">{u.name}</div><div className="text-xs text-[var(--foreground-tertiary)]">{u.email}</div></div><div className="text-sm font-bold text-[var(--accent)]">{u.loginCount}</div></div>)}</div></div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"><h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-[var(--accent)]" /> Recent Logins</h3><div className="space-y-3">{analytics.recentLogins.map((l, i) => <div key={i} className="flex items-center gap-3 text-sm"><div className={`w-2 h-2 rounded-full ${l.action === "LOGIN_GOOGLE" ? "bg-[var(--success)]" : "bg-[var(--accent)]"}`} /><div className="flex-1 min-w-0"><span className="text-[var(--foreground)] truncate">{l.actorEmail}</span></div><div className="text-xs text-[var(--foreground-tertiary)] shrink-0">{new Date(l.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div></div>)}</div></div>
            </div>
          </div>
        )}

        {/* ═══════ APPLICATIONS ═══════ */}
        {tab === "applications" && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Applications", value: applications.length, color: "text-[var(--accent)]" },
                { label: "Submitted", value: applications.filter((a: any) => a.status === "SUBMITTED").length, color: "text-[var(--success)]" },
                { label: "In Progress", value: applications.filter((a: any) => ["DRAFT", "IN_PROGRESS"].includes(a.status)).length, color: "text-[var(--warning)]" },
                { label: "Decided", value: applications.filter((a: any) => a.status === "DECIDED").length, color: "text-purple-400" },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-[var(--foreground-secondary)]">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="font-semibold text-[var(--foreground)] text-sm flex items-center gap-2"><FileCheck className="w-4 h-4 text-[var(--accent)]" /> Tender Applications</h3>
              </div>
              {applications.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--foreground-tertiary)]">No applications submitted yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {applications.map((app: any) => (
                    <div key={app.id} className="px-5 py-3 hover:bg-[var(--surface-2)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-[var(--foreground)]">{app.applicationNumber}</div>
                          <div className="text-xs text-[var(--foreground-secondary)]">{app.tender?.title} · {app.tender?.tenderNumber}</div>
                          <div className="text-xs text-[var(--foreground-tertiary)] mt-0.5">Bidder: {app.organization?.legalName} · {app.documentCount} doc(s) · {Math.round(app.progressPercent || 0)}%</div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          app.status === "SUBMITTED" ? "bg-[var(--success-light)] text-[var(--success)]" :
                          app.status === "DECIDED" ? "bg-purple-900/40 text-purple-400 border border-purple-800/50" :
                          "bg-[var(--warning-light)] text-[var(--warning)]"
                        }`}>{app.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ DOCUMENTS ═══════ */}
        {tab === "documents" && !loading && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Documents", value: adminDocs.stats?.total ?? 0, color: "text-[var(--accent)]", bg: "bg-[var(--accent-light)]" },
                { label: "Verified", value: adminDocs.stats?.verified ?? 0, color: "text-[var(--success)]", bg: "bg-[var(--success-light)]" },
                { label: "Processed", value: adminDocs.stats?.processed ?? 0, color: "text-[var(--accent)]", bg: "bg-[var(--accent-light)]" },
                { label: "Failed", value: adminDocs.stats?.failed ?? 0, color: "text-[var(--danger)]", bg: "bg-[var(--danger-light)]" },
                { label: "Expired", value: adminDocs.stats?.expired ?? 0, color: "text-[var(--warning)]", bg: "bg-[var(--warning-light)]" },
                { label: "Needs Review", value: adminDocs.stats?.needsReview ?? 0, color: "text-[var(--warning)]", bg: "bg-[var(--warning-light)]" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-[var(--border)] rounded-xl p-4`}><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div><div className="text-xs text-[var(--foreground-secondary)] mt-0.5">{s.label}</div></div>
              ))}
            </div>

            {/* User-wise Document Summary */}
            {adminDocs.userSummaries && adminDocs.userSummaries.length > 0 && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                <div className="px-5 py-4 border-b border-[var(--border)]">
                  <h3 className="font-semibold text-[var(--foreground)] text-sm flex items-center gap-2"><Users className="w-4 h-4 text-[var(--accent)]" /> User Document Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">User</th>
                      <th className="text-left py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Email</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Total</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Verified</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Processed</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Failed</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Expired</th>
                      <th className="text-left py-2.5 px-4 font-semibold text-[var(--foreground-secondary)]">Document Types</th>
                    </tr></thead>
                    <tbody>
                      {adminDocs.userSummaries.map((u: any) => (
                        <tr key={u.userId} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                          <td className="py-2.5 px-4 font-medium text-[var(--foreground)]">{u.name}</td>
                          <td className="py-2.5 px-4 text-[var(--foreground-secondary)]">{u.email}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[var(--foreground)]">{u.totalDocs}</td>
                          <td className="py-2.5 px-4 text-right"><span className="text-[var(--success)] font-medium">{u.verified}</span></td>
                          <td className="py-2.5 px-4 text-right"><span className="text-[var(--accent)] font-medium">{u.processed}</span></td>
                          <td className="py-2.5 px-4 text-right"><span className={u.failed > 0 ? "text-[var(--danger)] font-medium" : "text-[var(--foreground-tertiary)]"}>{u.failed}</span></td>
                          <td className="py-2.5 px-4 text-right"><span className={u.expired > 0 ? "text-[var(--warning)] font-medium" : "text-[var(--foreground-tertiary)]"}>{u.expired}</span></td>
                          <td className="py-2.5 px-4"><div className="flex flex-wrap gap-1">{u.docTypes.map((dt: string) => <span key={dt} className="text-[9px] bg-[var(--surface-2)] text-[var(--foreground-secondary)] px-1.5 py-0.5 rounded">{dt.replace(/_/g, " ")}</span>)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Documents Detail */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-semibold text-[var(--foreground)] text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--accent)]" /> All Uploaded Documents ({adminDocs.documents?.length ?? 0})</h3>
              </div>
              {(!adminDocs.documents || adminDocs.documents.length === 0) ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--foreground-tertiary)]">No documents uploaded yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {adminDocs.documents.map((doc: any) => {
                    const isExp = expandedAdminDoc === doc.id;
                    const score = doc.intelligenceScore;
                    return (
                      <div key={doc.id}>
                        <button onClick={() => setExpandedAdminDoc(isExp ? null : doc.id)} className="w-full text-left px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="font-medium text-[var(--foreground)] text-sm">{doc.fileName}</span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                  doc.status === "PROCESSED" ? "bg-[var(--accent-light)] text-[var(--accent)]" :
                                  doc.status === "FAILED" ? "bg-[var(--danger-light)] text-[var(--danger)]" :
                                  "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"
                                }`}>{doc.status}</span>
                                {score != null && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  score >= 80 ? "bg-[var(--success-light)] text-[var(--success)]" :
                                  score >= 50 ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--danger-light)] text-[var(--danger)]"
                                }`}>Score: {score}</span>}
                              </div>
                              <div className="text-xs text-[var(--foreground-tertiary)] flex items-center gap-3 flex-wrap">
                                <span>{doc.uploadedBy?.name ?? "—"} ({doc.uploadedBy?.email})</span>
                                <span>·</span>
                                <span>{doc.organization?.legalName}</span>
                                <span>·</span>
                                <span className="text-[10px] bg-[var(--surface-2)] text-[var(--foreground-secondary)] px-1.5 py-0.5 rounded">{doc.docType.replace(/_/g, " ")}</span>
                                <span>·</span>
                                <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                <span>·</span>
                                <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {isExp ? <ChevronUp className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)] shrink-0" />}
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-5 pb-5 space-y-4 border-t border-[var(--border)]">
                            <div className="pt-3 grid md:grid-cols-2 gap-4">
                              {/* Left: PDF Viewer */}
                              <div>
                                {doc.fileName.toLowerCase().endsWith(".pdf") ? (
                                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                                    <div className="bg-[var(--surface-2)] px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
                                      <span className="text-xs font-semibold text-[var(--foreground-secondary)]">PDF Preview</span>
                                      <a href={`/api/bidder/vault/${doc.id}/file?download=true`} target="_blank" className="text-[10px] text-[var(--accent)] hover:underline">Download PDF</a>
                                    </div>
                                    <iframe src={`/api/bidder/vault/${doc.id}/file`} className="w-full h-[400px] bg-[var(--surface)]" title="PDF Preview" />
                                  </div>
                                ) : [".png", ".jpg", ".jpeg"].some(ext => doc.fileName.toLowerCase().endsWith(ext)) ? (
                                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                                    <img src={`/api/bidder/vault/${doc.id}/file`} alt={doc.fileName} className="w-full max-h-[300px] object-contain bg-[var(--surface-2)]" />
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-[var(--border)] p-8 text-center text-[var(--foreground-tertiary)] text-sm">Preview not available for this file type</div>
                                )}
                              </div>

                              {/* Right: Intelligence Report */}
                              <div className="space-y-3">
                                {/* Score Card */}
                                {score != null && (
                                  <div className={`rounded-xl p-3 border ${
                                    score >= 80 ? "bg-[var(--success-light)] border-[var(--success)]" :
                                    score >= 50 ? "bg-[var(--warning-light)] border-[var(--warning)]" : "bg-[var(--danger-light)] border-[var(--danger)]"
                                  }`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-bold">Document Intelligence Score</span>
                                      <span className={`text-xl font-bold ${
                                        score >= 80 ? "text-[var(--success)]" : score >= 50 ? "text-[var(--warning)]" : "text-[var(--danger)]"
                                      }`}>{score}/100</span>
                                    </div>
                                    <div className="w-full h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${
                                        score >= 80 ? "bg-[var(--success)]" : score >= 50 ? "bg-[var(--warning)]" : "bg-[var(--danger)]"
                                      }`} style={{ width: `${score}%` }} />
                                    </div>
                                  </div>
                                )}

                                {/* Metadata */}
                                <div className="rounded-xl border border-[var(--border)] p-3">
                                  <h4 className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase mb-2">Document Info</h4>
                                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    {doc.gstin && <div><span className="text-[var(--foreground-tertiary)]">GSTIN:</span> <span className="font-mono font-medium">{doc.gstin}</span></div>}
                                    {doc.pan && <div><span className="text-[var(--foreground-tertiary)]">PAN:</span> <span className="font-mono font-medium">{doc.pan}</span></div>}
                                    {doc.documentNumber && <div><span className="text-[var(--foreground-tertiary)]">Doc No:</span> <span className="font-mono">{doc.documentNumber}</span></div>}
                                    {doc.issuingOrg && <div><span className="text-[var(--foreground-tertiary)]">Issued by:</span> <span className="font-medium">{doc.issuingOrg}</span></div>}
                                    {doc.issueDate && <div><span className="text-[var(--foreground-tertiary)]">Issue Date:</span> {new Date(doc.issueDate).toLocaleDateString()}</div>}
                                    {doc.expiryDate && <div><span className="text-[var(--foreground-tertiary)]">Expiry:</span> {new Date(doc.expiryDate).toLocaleDateString()}</div>}
                                    <div><span className="text-[var(--foreground-tertiary)]">SHA-256:</span> <span className="font-mono text-[10px]">{doc.sha256.slice(0, 20)}...</span></div>
                                  </div>
                                </div>

                                {/* Verification Pipeline */}
                                {doc.intelligenceData?.pipeline?.layers && (
                                  <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-light)] p-3">
                                    <h4 className="text-[10px] font-bold text-[var(--accent)] uppercase mb-2">
                                      Verification Pipeline — {doc.intelligenceData.pipeline.layers.filter((l: any) => l.status === "PASSED").length} / {doc.intelligenceData.pipeline.layers.length} Layers
                                    </h4>
                                    <div className="text-xs text-[var(--accent)] font-semibold mb-2">
                                      Decision: {doc.intelligenceData.pipeline.decision} | Score: {doc.intelligenceData.pipeline.overallScore}/100
                                    </div>
                                    {doc.intelligenceData.pipeline.textExtractionMode && (
                                      <div className="text-[10px] text-[var(--foreground-secondary)] mb-2">Text Mode: {doc.intelligenceData.pipeline.textExtractionMode.replace(/_/g, " ")}</div>
                                    )}
                                    <div className="space-y-0.5">
                                      {doc.intelligenceData.pipeline.layers.map((layer: any) => (
                                        <div key={layer.id} className="flex items-center gap-2 text-[11px]">
                                          <span className={layer.status === "PASSED" ? "text-[var(--success)]" : layer.status === "FAILED" ? "text-[var(--danger)]" : layer.status === "WARNING" ? "text-[var(--warning)]" : "text-[var(--foreground-tertiary)]"}>
                                            {layer.status === "PASSED" ? "✓" : layer.status === "FAILED" ? "✗" : layer.status === "WARNING" ? "⚠" : layer.status === "BLOCKED" ? "⏸" : layer.status === "NOT_APPLICABLE" ? "—" : layer.status === "WAITING_FOR_USER" ? "🔒" : "○"}
                                          </span>
                                          <span className="text-[var(--foreground-secondary)] flex-1">{layer.name}</span>
                                          <span className="text-[var(--foreground-secondary)]">{layer.score}/{layer.maxScore}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {doc.intelligenceData.pipeline.humanMessage && (
                                      <div className="mt-2 text-xs text-[var(--foreground-secondary)] italic">{doc.intelligenceData.pipeline.humanMessage}</div>
                                    )}
                                    {doc.intelligenceData.pipeline.reasonCodes?.length > 0 && (
                                      <div className="mt-1 text-[10px] text-[var(--warning)]">Reasons: {doc.intelligenceData.pipeline.reasonCodes.join(", ")}</div>
                                    )}
                                  </div>
                                )}

                                {/* Forensic Signals */}
                                {doc.intelligenceData?.forensicSignals && doc.intelligenceData.forensicSignals.length > 0 && (
                                  <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-light)] p-3">
                                    <h4 className="text-[10px] font-bold text-[var(--danger)] uppercase mb-2">Forensic Signals</h4>
                                    <div className="space-y-1">
                                      {doc.intelligenceData.forensicSignals.map((sig: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            sig.severity === "HIGH" ? "bg-[var(--danger-light)] text-[var(--danger)]" :
                                            sig.severity === "MEDIUM" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"
                                          }`}>{sig.severity}</span>
                                          <span className="text-[var(--foreground-secondary)]">{sig.detail}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Content Validation */}
                                {doc.intelligenceData?.contentValidation && (
                                  <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-light)] p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="text-[10px] font-bold text-[var(--accent)] uppercase">Content Validation Report</h4>
                                      {doc.intelligenceData.contentValidation.verdict && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          doc.intelligenceData.contentValidation.verdict === "AUTHENTIC" ? "bg-[var(--success-light)] text-[var(--success)]" :
                                          doc.intelligenceData.contentValidation.verdict === "SUSPICIOUS" ? "bg-[var(--warning-light)] text-[var(--warning)]" :
                                          doc.intelligenceData.contentValidation.verdict === "REJECTED" ? "bg-[var(--danger-light)] text-[var(--danger)]" :
                                          "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"
                                        }`}>{doc.intelligenceData.contentValidation.verdict}</span>
                                      )}
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[var(--foreground-secondary)]">Declared:</span>
                                        <span className="font-bold text-[var(--foreground)]">{doc.intelligenceData.contentValidation.declaredType?.replace(/_/g, " ")}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[var(--foreground-secondary)]">Detected:</span>
                                        <span className={`font-bold ${doc.intelligenceData.contentValidation.typeMatch ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{doc.intelligenceData.contentValidation.detectedContentType?.replace(/_/g, " ")}</span>
                                        {!doc.intelligenceData.contentValidation.typeMatch && <span className="text-[10px] bg-[var(--danger-light)] text-[var(--danger)] px-1.5 py-0.5 rounded font-bold">TYPE MISMATCH</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[var(--foreground-secondary)]">Text Content:</span>
                                        <span className={doc.intelligenceData.contentValidation.hasTextContent ? "text-[var(--success)]" : "text-[var(--danger)]"}>{doc.intelligenceData.contentValidation.hasTextContent ? "Present (" + doc.intelligenceData.contentValidation.textLength + " chars)" : "No text content — OCR needed"}</span>
                                      </div>
                                      {doc.intelligenceData.contentValidation.overallScore != null && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[var(--foreground-secondary)]">Content Score:</span>
                                          <span className="font-bold">{doc.intelligenceData.contentValidation.overallScore}/100</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-[var(--foreground-secondary)]">Confidence:</span>
                                        <span className="font-bold">{(doc.intelligenceData.contentValidation.contentConfidence * 100).toFixed(0)}%</span>
                                      </div>
                                      {/* Missing Checks */}
                                      {doc.intelligenceData.contentValidation.missingChecks?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-[var(--accent)] space-y-1">
                                          <div className="text-[9px] font-bold text-[var(--danger)] uppercase">Missing Verification Checks</div>
                                          {doc.intelligenceData.contentValidation.missingChecks.map((mc: any, i: number) => (
                                            <div key={i} className="flex items-start gap-2 text-[10px]">
                                              <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${
                                                mc.severity === "CRITICAL" ? "bg-[var(--danger-light)] text-[var(--danger)]" :
                                                mc.severity === "HIGH" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--surface-2)] text-[var(--foreground-secondary)]"
                                              }`}>{mc.severity}</span>
                                              <span className="text-[var(--foreground-secondary)]">{mc.description}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* Format Validations */}
                                      {doc.intelligenceData.contentValidation.formatValidations?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-[var(--accent)] space-y-1">
                                          <div className="text-[9px] font-bold text-[var(--accent)] uppercase">Format Validation</div>
                                          {doc.intelligenceData.contentValidation.formatValidations.map((fv: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                              <span className={fv.valid ? "text-[var(--success)]" : "text-[var(--danger)]"}>{fv.valid ? "✓" : "✗"}</span>
                                              <span className="text-[var(--foreground-secondary)] w-20 truncate uppercase font-medium">{fv.field}</span>
                                              <span className="text-[var(--foreground-secondary)] truncate flex-1">{fv.detail}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {doc.intelligenceData.contentValidation.missingKeywords?.length > 0 && (
                                        <div className="text-[var(--danger)] text-[10px]">Missing: {doc.intelligenceData.contentValidation.missingKeywords.join(", ")}</div>
                                      )}
                                      {doc.intelligenceData.contentValidation.reasons?.map((r: string, i: number) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--foreground-secondary)]">
                                          <span className="text-[var(--warning)] shrink-0">⚠</span> {r}
                                        </div>
                                      ))}
                                      {/* Field verification in admin */}
                                      {doc.intelligenceData.contentValidation.fieldValidation?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-[var(--accent)] space-y-1">
                                          <div className="text-[9px] font-bold text-[var(--accent)] uppercase">Field Presence Check</div>
                                          {doc.intelligenceData.contentValidation.fieldValidation.map((fv: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                              <span className={fv.found ? "text-[var(--success)]" : "text-[var(--danger)]"}>{fv.found ? "✓" : "✗"}</span>
                                              <span className="text-[var(--foreground-secondary)] w-20 truncate">{fv.field}</span>
                                              <span className="text-[var(--foreground-secondary)] truncate flex-1">{fv.value?.slice(0, 40)}</span>
                                              <span className="text-[var(--foreground-tertiary)] shrink-0">{(fv.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Identifier Validations */}
                                {doc.intelligenceData?.validators && doc.intelligenceData.validators.length > 0 && (
                                  <div className="rounded-xl border border-[var(--border)] p-3">
                                    <h4 className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase mb-2">Identifier Checks</h4>
                                    <div className="space-y-2">
                                      {doc.intelligenceData.validators.map((v: any, i: number) => (
                                        <div key={i} className="text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${v.valid ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                                            <span className="font-bold uppercase">{v.field}</span>
                                            <span className="text-[var(--foreground-secondary)]">{v.value}</span>
                                            <span className={`ml-auto text-[10px] font-bold ${v.valid ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{v.valid ? "VALID" : "INVALID"}</span>
                                          </div>
                                          {v.errors && v.errors.length > 0 && v.errors.map((e: string, j: number) => (
                                            <div key={j} className="ml-4 text-[10px] text-[var(--danger)]">⚠ {e}</div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Extracted Data */}
                                {doc.extractions && doc.extractions.length > 0 && (
                                  <div className="rounded-xl border border-[var(--border)] p-3">
                                    <h4 className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase mb-2">Extracted Data ({doc.extractions.length} fields)</h4>
                                    <div className="space-y-0.5">
                                      {doc.extractions.slice(0, 8).map((e: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-[11px] py-0.5 border-b border-[var(--border)] last:border-0">
                                          <span className="text-[var(--foreground-tertiary)] shrink-0 w-28 truncate">{e.field}</span>
                                          <span className="text-[var(--foreground-secondary)] flex-1 break-all">{e.value?.slice(0, 60)}</span>
                                          {e.confidence != null && <span className="text-[var(--foreground-tertiary)] shrink-0">{(e.confidence * 100).toFixed(0)}%</span>}
                                        </div>
                                      ))}
                                      {doc.extractions.length > 8 && <div className="text-[10px] text-[var(--foreground-tertiary)] pt-1">+{doc.extractions.length - 8} more fields</div>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ SETTINGS ═══════ */}
        {tab === "settings" && !loading && (
          <div className="space-y-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-[var(--accent)]" /> AI Provider</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-lg p-4"><div className="text-xs text-[var(--success)] font-medium mb-1">Status</div><div className="text-sm font-bold text-[var(--success)]">Gemini Connected</div><div className="text-xs text-[var(--success)] mt-1">Model: gemini-2.5-flash</div></div>
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-4"><div className="text-xs text-[var(--foreground-secondary)] font-medium mb-1">OpenAI</div><div className="text-sm font-medium text-[var(--foreground-secondary)]">Not configured</div><div className="text-xs text-[var(--foreground-tertiary)] mt-1">Backup provider</div></div>
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-4"><div className="text-xs text-[var(--foreground-secondary)] font-medium mb-1">Local AI</div><div className="text-sm font-medium text-[var(--foreground-secondary)]">Disabled</div><div className="text-xs text-[var(--foreground-tertiary)] mt-1">Ollama not running</div></div>
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-[var(--accent)]" /> Database</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-lg p-4"><div className="text-xs text-[var(--success)] font-medium mb-1">Provider</div><div className="text-sm font-bold text-[var(--success)]">Supabase PostgreSQL</div><div className="text-xs text-[var(--success)] mt-1">Connected &amp; synced</div></div>
                <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-lg p-4"><div className="text-xs text-[var(--success)] font-medium mb-1">Schema</div><div className="text-sm font-bold text-[var(--success)]">25+ Models</div><div className="text-xs text-[var(--success)] mt-1">All migrations applied</div></div>
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-[var(--accent)]" /> Security</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Password hashing (bcrypt)</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> JWT session management</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> RBAC enforcement</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Rate limiting</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Audit logging</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Admin panel password gate</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import ChatBot from "@/components/ChatBot";

export default function AdminPage() {
  return <AdminGate><AdminContent /><ChatBot context="admin" /></AdminGate>;
}
