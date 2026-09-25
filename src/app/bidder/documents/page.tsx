"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  FileText, FileCheck, Upload, AlertTriangle, Lock, Info, Clock,
  Shield, Eye, Trash2, RefreshCw, Plus, Search,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Calendar,
  Building2, Hash, BookOpen, Tag, Star, Copy, FolderOpen,
  File, Image, FileSpreadsheet, Archive, GripVertical, X, Check,
  AlertCircle, Zap, Building, Scale, Award, Wrench, MoreHorizontal,
} from "lucide-react";

type VaultDoc = any;
type VaultStats = any;

const CATEGORIES = [
  { key: "ALL", label: "All Documents", icon: FolderOpen, color: "text-[var(--foreground)]" },
  { key: "IDENTITY", label: "Identity & Organization", icon: Building2, color: "text-[var(--accent)]", desc: "PAN, GST, Udyam, Incorporation, Address proof" },
  { key: "FINANCIAL", label: "Financial & Compliance", icon: Scale, color: "text-[var(--success)]", desc: "ITR, Turnover, Financial statements, Bank details" },
  { key: "EXPERIENCE", label: "Experience & Projects", icon: Award, color: "text-[var(--warning)]", desc: "Work orders, Completion certs, Experience certs" },
  { key: "TECHNICAL", label: "Technical & Quality", icon: Wrench, color: "text-[#bf5af2]", desc: "OEM auth, ISO, Test certs, Datasheets" },
  { key: "OTHER", label: "Other Documents", icon: MoreHorizontal, color: "text-[var(--foreground-secondary)]", desc: "Declarations, Custom documents" },
];

const DOC_TYPES_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
  IDENTITY: [
    { value: "PAN_CARD", label: "PAN Card" },
    { value: "GST_CERTIFICATE", label: "GST Registration Certificate" },
    { value: "UDYAM_CERTIFICATE", label: "Udyam / MSME Certificate" },
    { value: "COMPANY_CERTIFICATE", label: "Certificate of Incorporation" },
  ],
  FINANCIAL: [
    { value: "TURNOVER_PROOF", label: "Turnover Proof (CA Certificate)" },
    { value: "OTHER", label: "ITR Document" },
    { value: "OTHER", label: "Financial Statements" },
    { value: "OTHER", label: "Bank Certificate" },
  ],
  EXPERIENCE: [
    { value: "EXPERIENCE_CERTIFICATE", label: "Experience Certificate" },
    { value: "OTHER", label: "Work Order / Purchase Order" },
    { value: "OTHER", label: "Completion Certificate" },
    { value: "OTHER", label: "Performance Certificate" },
  ],
  TECHNICAL: [
    { value: "OEM_AUTHORIZATION", label: "OEM Authorization Letter" },
    { value: "COMPANY_CERTIFICATE", label: "ISO Certificate" },
    { value: "TECHNICAL_DATASHEET", label: "Technical Datasheet" },
    { value: "OTHER", label: "Test Certificate" },
  ],
  OTHER: [
    { value: "LOCAL_CONTENT_DECLARATION", label: "Local Content Declaration" },
    { value: "OTHER", label: "Custom Document" },
  ],
};

const statusConfig: Record<string, { color: string; bg: string; label: string; border: string }> = {
  PROCESSED: { color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/12", label: "Processed", border: "border-[var(--accent)]/20" },
  VERIFIED: { color: "text-[var(--success)]", bg: "bg-[var(--success)]/10", label: "Verified", border: "border-[var(--success)]/20" },
  NEEDS_REVIEW: { color: "text-[var(--warning)]", bg: "bg-[var(--warning)]/10", label: "Needs Review", border: "border-[var(--warning)]/20" },
  REVIEW_REQUIRED: { color: "text-[var(--danger)]", bg: "bg-[var(--danger)]/10", label: "Review Required", border: "border-[var(--danger)]/20" },
  EXPIRED: { color: "text-[var(--danger)]", bg: "bg-[var(--danger)]/10", label: "Expired", border: "border-[var(--danger)]/20" },
  FAILED: { color: "text-[var(--danger)]", bg: "bg-[var(--danger)]/10", label: "Failed", border: "border-[var(--danger)]/20" },
  NOT_VERIFIED: { color: "text-[var(--foreground-tertiary)]", bg: "bg-[var(--surface-2)]", label: "Not Verified", border: "border-[var(--border)]" },
  UPLOADED: { color: "text-[var(--foreground-secondary)]", bg: "bg-[var(--surface-2)]", label: "Uploaded", border: "border-[var(--border)]" },
  PROCESSING: { color: "text-[var(--warning)]", bg: "bg-[var(--warning)]/10", label: "Processing", border: "border-[var(--warning)]/20" },
  BLOCKED: { color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/10", label: "Blocked", border: "border-[var(--accent)]/20" },
  PASSWORD_REQUIRED: { color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/10", label: "Password Required", border: "border-[var(--accent)]/20" },
};

const docTypeLabels: Record<string, string> = {
  GST_CERTIFICATE: "GST Certificate", PAN_CARD: "PAN Card", UDYAM_CERTIFICATE: "Udyam Certificate",
  OEM_AUTHORIZATION: "OEM Authorization", EXPERIENCE_CERTIFICATE: "Experience Certificate",
  TURNOVER_PROOF: "Turnover Proof", LOCAL_CONTENT_DECLARATION: "Local Content Declaration",
  TECHNICAL_DATASHEET: "Technical Datasheet", COMPANY_CERTIFICATE: "Company Certificate",
  OTHER: "Other Document", UNKNOWN: "Unknown",
};

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return FileText;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return Image;
  if (["xlsx", "xls", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "rar"].includes(ext)) return Archive;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function BidderDocumentsPage() {
  const [vaultData, setVaultData] = useState<{ documents: VaultDoc[]; stats: VaultStats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedDoc, setSelectedDoc] = useState<VaultDoc | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("IDENTITY");
  const [uploadDocType, setUploadDocType] = useState("GST_CERTIFICATE");
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pdfPassword, setPdfPassword] = useState("");
  const [isEncryptedPdf, setIsEncryptedPdf] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<VaultDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainFileInputRef = useRef<HTMLInputElement>(null);

  const loadVault = useCallback(async () => {
    try {
      const res = await fetch("/api/bidder/vault");
      const d = await res.json();
      if (d.ok) setVaultData(d.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadVault(); }, [loadVault]);

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // Fetch document file as blob URL for preview (sends cookies properly)
  useEffect(() => {
    if (!viewingDoc) { setPreviewUrl(null); return; }
    const abort = new AbortController();
    let blobUrl: string | null = null;
    setPreviewLoading(true);
    fetch(`/api/bidder/vault/${viewingDoc.id}/file`, { credentials: "include", signal: abort.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { blobUrl = URL.createObjectURL(blob); setPreviewUrl(blobUrl); })
      .catch(() => setPreviewUrl(null))
      .finally(() => setPreviewLoading(false));
    return () => { abort.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [viewingDoc?.id]);

  const [uploadPhase, setUploadPhase] = useState("");

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setMessage(null);
    setUploadPhase("Uploading...");
    const form = new FormData();
    form.append("docType", uploadDocType);
    form.append("category", uploadCategory);
    if (pdfPassword) form.append("pdfPassword", pdfPassword);
    for (const f of pendingFiles) form.append("files", f);
    try {
      setUploadPhase("Reading document...");
      const phaseTimer = setTimeout(() => setUploadPhase("Extracting text..."), 800);
      const phaseTimer2 = setTimeout(() => setUploadPhase("Running verification..."), 2000);
      const phaseTimer3 = setTimeout(() => setUploadPhase("Calculating score..."), 3500);

      const res = await fetch("/api/bidder/vault", { method: "POST", body: form });
      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      setUploadPhase("Finalizing...");

      const data = await res.json();
      if (data.ok) {
        const count = data.data.documents.length;
        const dupes = data.data.documents.filter((d: any) => d.duplicateOf).length;
        const failed = data.data.documents.filter((d: any) => d.status === "FAILED").length;
        let text = `${count} document(s) uploaded and verified!`;
        if (dupes > 0) text += ` (${dupes} duplicate(s) detected)`;
        if (failed > 0) text += ` (${failed} failed verification)`;
        setMessage({ type: "success", text });
        loadVault();
      } else {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      }
    } catch { setMessage({ type: "error", text: "Upload failed — please try again" }); }
    setUploading(false);
    setUploadPhase("");
    setShowUploadModal(false);
    setPendingFiles([]);
    setPdfPassword("");
  }

  async function checkPdfEncryption(files: File[]) {
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const slice = f.slice(0, 262144);
        const buf = await slice.arrayBuffer();
        const latin = new TextDecoder("latin1").decode(buf);
        if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(latin)) {
          setIsEncryptedPdf(true);
          return;
        }
      } catch {}
    }
    setIsEncryptedPdf(false);
  }

  async function deleteDocument(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    const res = await fetch(`/api/bidder/vault/${docId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { setMessage({ type: "success", text: "Document deleted" }); loadVault(); setSelectedDoc(null); }
    else setMessage({ type: "error", text: data.error });
  }

  const documents = vaultData?.documents || [];
  const stats = vaultData?.stats || { total: 0, verified: 0, needsAttention: 0, expired: 0, byCategory: {} };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = !searchQuery || 
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (docTypeLabels[doc.docType] || doc.docType).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.gstin || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.pan || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "ALL" || doc.documentCategory === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryDocs = (catKey: string) => {
    if (catKey === "ALL") return documents;
    return documents.filter(d => d.documentCategory === catKey);
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-10 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg animate-pulse" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent-light)] rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-[var(--accent)]" />
            </div>
            Document Vault
          </h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1 ml-13">
            Upload documents once — reuse across all tender applications. AI-powered classification & extraction.
          </p>
        </div>
        <button 
          onClick={() => { setShowUploadModal(true); setPendingFiles([]); setIsEncryptedPdf(false); }}
          className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--navy-700)] text-white font-semibold px-4 sm:px-5 py-2.5 rounded-lg transition-colors text-sm shadow-lg shadow-[var(--accent)]/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Upload Document</span><span className="sm:hidden">Upload</span>
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-3 transition-all ${
          message.type === "success" ? "bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)]" : "bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)]"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Documents", value: stats.total, icon: FileText, color: "var(--accent)" },
          { label: "Verified", value: stats.verified, icon: Shield, color: "var(--success)" },
          { label: "Needs Attention", value: stats.needsAttention, icon: AlertTriangle, color: "var(--warning)" },
          { label: "Expired", value: stats.expired, icon: XCircle, color: "var(--danger)" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--foreground-tertiary)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">{s.value}</div>
                <div className="text-xs text-[var(--foreground-tertiary)]">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expiry Warning */}
      {(stats.expired > 0 || stats.needsAttention > 0) && (
        <div className="bg-[var(--danger)]/8 border border-[var(--danger)]/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-sm font-semibold text-[var(--danger)]">{stats.expired + stats.needsAttention} document(s) need attention</span>
          </div>
          <div className="space-y-1 ml-6">
            {documents.filter(d => d.expiryStatus === "EXPIRED").map(d => (
              <div key={d.id} className="text-xs text-[var(--danger)]/80">• {d.fileName} — Expired {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : ""}</div>
            ))}
            {documents.filter(d => d.expiryStatus === "EXPIRING_7D").map(d => (
              <div key={d.id} className="text-xs text-[var(--warning)]/80">• {d.fileName} — Expires within 7 days ({d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : ""})</div>
            ))}
            {documents.filter(d => d.expiryStatus === "EXPIRING_30D").map(d => (
              <div key={d.id} className="text-xs text-[var(--warning)]/80">• {d.fileName} — Expires within 30 days ({d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : ""})</div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-tertiary)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          placeholder="Search by name, type, GSTIN, PAN..."
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const count = categoryDocs(cat.key).length;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? "bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent)]"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:border-[var(--foreground-tertiary)]"
              }`}
            >
              <CatIcon className="w-4 h-4" />
              {cat.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--foreground-tertiary)]"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Documents List */}
      {filteredDocs.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 sm:p-12 text-center">
          <div className="w-16 h-16 bg-[var(--surface-2)] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-[var(--foreground-tertiary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {documents.length === 0 ? "Your Document Vault is Empty" : "No Matching Documents"}
          </h3>
          <p className="text-sm text-[var(--foreground-secondary)] mb-5 max-w-md mx-auto">
            {documents.length === 0
              ? "Upload your organization documents — PAN, GST, Udyam, ISO certificates, and more. They'll be available for all tender applications."
              : "Try adjusting your search or category filter."}
          </p>
          {documents.length === 0 && (
            <button onClick={() => { setShowUploadModal(true); setPendingFiles([]); setIsEncryptedPdf(false); }} className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--navy-700)] text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm cursor-pointer">
              <Plus className="w-4 h-4" /> Upload Your First Document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const st = statusConfig[doc.status] || statusConfig.UPLOADED;
            const isExpiring = doc.expiryStatus === "EXPIRING_7D" || doc.expiryStatus === "EXPIRING_30D";
            const isExpired = doc.expiryStatus === "EXPIRED";
            const isSelected = selectedDoc?.id === doc.id;
            const FileIcon = getFileIcon(doc.fileName);
            return (
              <div
                key={doc.id}
                className={`bg-[var(--surface)] border rounded-lg overflow-hidden transition-all ${
                  isExpired ? "border-[var(--danger)]/20" : isExpiring ? "border-[var(--warning)]/20" : isSelected ? "border-[var(--accent)]/30" : "border-[var(--border)] hover:border-[var(--foreground-tertiary)]"
                }`}
              >
                <button 
                  onClick={() => setSelectedDoc(isSelected ? null : doc)}
                  className="w-full text-left p-4 flex items-center gap-3 sm:gap-4"
                >
                  {/* File icon */}
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${st.bg}`}>
                    <FileIcon className={`w-5 h-5 ${st.color}`} />
                  </div>
                  
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-[300px]">{doc.fileName}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      {doc.version > 1 && <span className="text-[10px] text-[var(--foreground-tertiary)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">v{doc.version}</span>}
                      {isExpired && <span className="text-[10px] text-[var(--danger)] font-semibold">EXPIRED</span>}
                      {isExpiring && <span className="text-[10px] text-[var(--warning)] font-semibold">EXPIRING</span>}
                    </div>
                    <div className="hidden sm:flex items-center gap-3 mt-1 text-xs text-[var(--foreground-tertiary)]">
                      <span className="text-[var(--foreground-secondary)]">{docTypeLabels[doc.docType] || doc.docType}</span>
                      <span>·</span>
                      <span>{formatSize(doc.fileSize)}</span>
                      <span>·</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      {doc.gstin && <><span>·</span><span className="font-mono text-[var(--foreground-tertiary)]">{doc.gstin}</span></>}
                      {doc.pan && <><span>·</span><span className="font-mono text-[var(--foreground-tertiary)]">{doc.pan}</span></>}
                      {doc.intelligenceScore != null && <><span>·</span><span className={`font-bold ${
                        doc.verificationStatus === "VERIFIED" ? "text-[var(--success)]" :
                        doc.verificationStatus === "NEEDS_REVIEW" ? "text-[var(--warning)]" :
                        doc.verificationStatus === "FAILED" ? "text-[var(--danger)]" :
                        "text-[var(--foreground-tertiary)]"
                      }`}>Score: {doc.intelligenceScore}</span></>}
                      {doc.usedInApplications > 0 && <><span>·</span><span className="text-[var(--accent)]">{doc.usedInApplications} app(s)</span></>}
                    </div>
                    {/* Mobile: show score inline */}
                    <div className="sm:hidden flex items-center gap-2 mt-1 text-xs">
                      {doc.intelligenceScore != null && <span className={`font-bold ${
                        doc.verificationStatus === "VERIFIED" ? "text-[var(--success)]" :
                        doc.verificationStatus === "NEEDS_REVIEW" ? "text-[var(--warning)]" :
                        doc.verificationStatus === "FAILED" ? "text-[var(--danger)]" :
                        "text-[var(--foreground-tertiary)]"
                      }`}>Score: {doc.intelligenceScore}</span>}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setViewingDoc(doc); }} className="p-2 cursor-pointer text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg transition-colors" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(doc.sha256); setMessage({ type: "success", text: "SHA-256 hash copied!" }); }} className="p-2 cursor-pointer text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg transition-colors hidden sm:flex" title="Copy Hash">
                      <Copy className="w-4 h-4" />
                    </button>
                    {isSelected ? <ChevronDown className="w-4 h-4 text-[var(--foreground-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--foreground-tertiary)]" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isSelected && (
                  <div className="px-4 pb-4 border-t border-[var(--border-light)] pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {doc.documentNumber && <MetaRow icon={Hash} label="Document Number" value={doc.documentNumber} />}
                      {doc.registrationNumber && <MetaRow icon={BookOpen} label="Registration No." value={doc.registrationNumber} />}
                      {doc.gstin && <MetaRow icon={Building2} label="GSTIN" value={doc.gstin} />}
                      {doc.pan && <MetaRow icon={Tag} label="PAN" value={doc.pan} />}
                      {doc.issuingOrg && <MetaRow icon={Building2} label="Issuing Organization" value={doc.issuingOrg} />}
                      {doc.issueDate && <MetaRow icon={Calendar} label="Issue Date" value={new Date(doc.issueDate).toLocaleDateString()} />}
                      {doc.expiryDate && <MetaRow icon={Clock} label="Expiry Date" value={new Date(doc.expiryDate).toLocaleDateString()} />}
                      {doc.authorizedPerson && <MetaRow icon={Star} label="Authorized Person" value={doc.authorizedPerson} />}
                      <MetaRow icon={Hash} label="SHA-256" value={doc.sha256.slice(0, 20) + "..."} />
                      <MetaRow icon={File} label="File Size" value={formatSize(doc.fileSize)} />
                      <MetaRow icon={Calendar} label="Uploaded" value={new Date(doc.createdAt).toLocaleString()} />
                    </div>

                    {/* Extracted fields */}
                    {doc.extractions && doc.extractions.length > 0 && (
                      <div className="bg-[var(--surface-2)] rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-2 flex items-center gap-1.5">
                          <Zap className="w-3 h-3" /> Extracted Data ({doc.extractions[0]?.source === "SIMULATED" ? "Simulated — not from document" : "AI Vision"})
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-1">
                          {doc.extractions.slice(0, 10).map((e: any, i: number) => (
                            <div key={i} className="text-xs flex gap-2 px-2 py-1 rounded bg-[var(--background)]">
                              <span className="text-[var(--foreground-tertiary)] shrink-0">{e.field}:</span>
                              <span className="text-[var(--foreground)] truncate">{e.value?.slice(0, 60)}</span>
                              {e.source === "SIMULATED" && <span className="text-[10px] text-[var(--warning)] shrink-0">SIM</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {doc.extractions && doc.extractions.length === 0 && doc.status === "PROCESSED" && (
                      <div className="bg-[var(--surface-2)] rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-[var(--foreground-tertiary)] flex items-center gap-1.5">
                          <Zap className="w-3 h-3" /> No fields extracted — AI could not extract data from this document
                        </h4>
                        <p className="text-[11px] text-[var(--foreground-tertiary)]/60 mt-1">The document may not contain machine-readable text or the AI extraction service is unavailable.</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => deleteDocument(doc.id)} className="flex items-center gap-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 px-3 py-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <button onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.png,.jpg,.jpeg"; inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files; if (f && f[0]) replaceDoc(doc.id, f[0]); }; inp.click(); }} className="flex items-center gap-1.5 text-xs text-[var(--warning)] hover:bg-[var(--warning)]/10 px-3 py-1.5 rounded-lg transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Replace (New Version)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/70 backdrop-blur-sm p-4" onClick={() => { setShowUploadModal(false); setPendingFiles([]); setIsEncryptedPdf(false); }}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--accent-light)] rounded-lg flex items-center justify-center">
                  <Upload className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)]">Upload to Vault</h2>
                  <p className="text-[11px] text-[var(--foreground-tertiary)]">AI will classify & extract data automatically</p>
                </div>
              </div>
              <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); setIsEncryptedPdf(false); }} className="p-1.5 text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-4 sm:px-6 py-5 space-y-4">
              {/* Category Select */}
              <div>
                <label className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1.5 block">Document Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter(c => c.key !== "ALL").map(cat => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => {
                          setUploadCategory(cat.key);
                          const types = DOC_TYPES_BY_CATEGORY[cat.key];
                          if (types?.length) setUploadDocType(types[0].value);
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                          uploadCategory === cat.key
                            ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
                            : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--foreground-tertiary)]"
                        }`}
                      >
                        <CatIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Document Type Select */}
              <div>
                <label className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1.5 block">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] cursor-pointer focus:border-[var(--accent)] focus:outline-none"
                >
                  {(DOC_TYPES_BY_CATEGORY[uploadCategory] || []).map(t => (
                    <option key={t.value + t.label} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--foreground-tertiary)] mt-1 ml-1">{CATEGORIES.find(c => c.key === uploadCategory)?.desc}</p>
              </div>

              {/* Drop Zone / File Selection */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const files = Array.from(e.dataTransfer.files); setPendingFiles(prev => { const next = [...prev, ...files]; checkPdfEncryption(next); return next; }); }}
                className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-all cursor-pointer ${
                  dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--foreground-tertiary)]"
                }`}
                onClick={() => mainFileInputRef.current?.click()}
              >
                <div className="w-12 h-12 bg-[var(--surface-2)] rounded-lg flex items-center justify-center mx-auto mb-3">
                  {uploading ? <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" /> : <Upload className="w-6 h-6 text-[var(--foreground-tertiary)]" />}
                </div>
                {pendingFiles.length === 0 ? (
                  <>
                    <p className="text-sm text-[var(--foreground-secondary)] font-medium">Drag & drop files here, or click to browse</p>
                    <p className="text-xs text-[var(--foreground-tertiary)] mt-1">PDF, PNG, JPG, DOCX, XLSX — Max 25MB per file</p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--success)] font-medium">{pendingFiles.length} file(s) selected</p>
                )}
                <input ref={mainFileInputRef} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt,.md" onChange={(e) => { if (e.target.files) { const files = Array.from(e.target.files); setPendingFiles(prev => { const next = [...prev, ...files]; checkPdfEncryption(next); return next; }); } }} />
              </div>

              {/* Pending files list */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[var(--surface-2)] rounded-lg px-3 py-2 text-xs">
                      {(() => { const Ic = getFileIcon(f.name); return <Ic className="w-3.5 h-3.5 text-[var(--foreground-tertiary)] shrink-0" />; })()}
                      <span className="text-[var(--foreground)] truncate flex-1">{f.name}</span>
                      <span className="text-[var(--foreground-tertiary)] shrink-0">{formatSize(f.size)}</span>
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-[var(--foreground-tertiary)] hover:text-[var(--danger)]"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PDF Password (shown only when encrypted PDF detected) */}
              {isEncryptedPdf && (
                <div className="px-4 sm:px-6">
                  <label className="text-xs font-semibold text-[var(--foreground-secondary)] mb-1.5 block">
                    <Lock className="w-3 h-3 inline mr-1" />
                    PDF Password (if encrypted)
                  </label>
                  <input
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="Enter password if PDF is protected"
                    className="w-full px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <p className="text-[10px] text-[var(--foreground-tertiary)] mt-1 ml-1">Leave empty if not encrypted</p>
                </div>
              )}

              {/* Modal Footer with Upload Button */}
            <div className="px-4 sm:px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
              <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); setIsEncryptedPdf(false); }} className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] px-4 py-2 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={pendingFiles.length === 0 || uploading}
                className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--navy-700)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 sm:px-6 py-2.5 rounded-lg transition-colors text-sm shadow-lg shadow-[var(--accent)]/20 cursor-pointer"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">{uploadPhase || "Processing..."}</span><span className="sm:hidden">...</span></>
                ) : (
                  <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload {pendingFiles.length > 0 ? `${pendingFiles.length} File(s)` : ""}</span><span className="sm:hidden">Upload</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/70 backdrop-blur-sm sm:p-4" onClick={() => setViewingDoc(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full sm:max-w-4xl sm:mx-4 shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
              <div className="flex items-center gap-3 min-w-0">
                {(() => { const Ic = getFileIcon(viewingDoc.fileName); return <Ic className="w-5 h-5 text-[var(--accent)] shrink-0" />; })()}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[var(--foreground)] truncate">{viewingDoc.fileName}</h2>
                  <p className="text-[11px] text-[var(--foreground-tertiary)]">{docTypeLabels[viewingDoc.docType]} · {formatSize(viewingDoc.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/api/bidder/vault/${viewingDoc.id}/file?download=true`} target="_blank" className="text-xs bg-[var(--accent-light)] text-[var(--accent)] px-3 py-1.5 rounded-lg hover:opacity-80 transition-colors">Download</a>
                <button onClick={() => setViewingDoc(null)} className="p-1.5 text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-5 space-y-5">
              {/* Verification Result — New Pipeline */}
              {viewingDoc.intelligenceData && (
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  {/* Score Header */}
                  <div className={`px-4 sm:px-5 py-4 ${
                    viewingDoc.intelligenceScore >= 75 ? "bg-[var(--success)]/8" :
                    viewingDoc.intelligenceScore >= 45 ? "bg-[var(--warning)]/8" :
                    "bg-[var(--danger)]/8"
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className={`w-5 h-5 ${
                        viewingDoc.intelligenceScore >= 75 ? "text-[var(--success)]" :
                        viewingDoc.intelligenceScore >= 45 ? "text-[var(--warning)]" : "text-[var(--danger)]"
                      }`} />
                      <span className="text-sm font-bold text-[var(--foreground)]">Verification Result</span>
                      <span className={`text-xl font-bold ml-auto ${
                        viewingDoc.intelligenceScore >= 75 ? "text-[var(--success)]" :
                        viewingDoc.intelligenceScore >= 45 ? "text-[var(--warning)]" : "text-[var(--danger)]"
                      }`}>{viewingDoc.intelligenceScore}/100</span>
                    </div>
                    {/* Score bar */}
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${
                        viewingDoc.intelligenceScore >= 75 ? "bg-[var(--success)]" :
                        viewingDoc.intelligenceScore >= 45 ? "bg-[var(--warning)]" : "bg-[var(--danger)]"
                      }`} style={{ width: `${viewingDoc.intelligenceScore}%` }} />
                    </div>
                    {/* Status badge */}
                    {viewingDoc.intelligenceData.status && (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        viewingDoc.intelligenceData.status === "VERIFIED" ? "bg-[var(--success)]/15 text-[var(--success)]" :
                        viewingDoc.intelligenceData.status === "NEEDS_REVIEW" ? "bg-[var(--warning)]/15 text-[var(--warning)]" :
                        viewingDoc.intelligenceData.status === "PASSWORD_REQUIRED" ? "bg-[var(--accent)]/15 text-[var(--accent)]" :
                        "bg-[var(--danger)]/15 text-[var(--danger)]"
                      }`}>
                        {viewingDoc.intelligenceData.status === "VERIFIED" ? "✓" :
                         viewingDoc.intelligenceData.status === "NEEDS_REVIEW" ? "⚠" :
                         viewingDoc.intelligenceData.status === "PASSWORD_REQUIRED" ? "🔒" : "✗"}
                        {viewingDoc.intelligenceData.status.replace(/_/g, " ")}
                      </div>
                    )}
                    {/* Human message */}
                    {viewingDoc.intelligenceData.humanMessage && (
                      <p className="text-xs text-[var(--foreground)] mt-2">{viewingDoc.intelligenceData.humanMessage}</p>
                    )}
                    {viewingDoc.intelligenceData.actionMessage && (
                      <p className="text-xs text-[var(--warning)] mt-1">{viewingDoc.intelligenceData.actionMessage}</p>
                    )}
                  </div>

                  {/* Evidence Breakdown */}
                  {viewingDoc.intelligenceData.evidence && (
                    <div className="px-4 sm:px-5 py-4 space-y-3">
                      <div className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Evidence Breakdown</div>
                      {Object.entries(viewingDoc.intelligenceData.evidence).map(([key, ev]: [string, any]) => (
                        <div key={key} className="flex items-start gap-3 text-xs">
                          <span className={`shrink-0 w-4 text-center mt-0.5 ${
                            ev.status === "PASS" ? "text-[var(--success)]" :
                            ev.status === "FAIL" ? "text-[var(--danger)]" :
                            ev.status === "WARN" ? "text-[var(--warning)]" :
                            "text-[var(--foreground-tertiary)]"
                          }`}>
                            {ev.status === "PASS" ? "✓" :
                             ev.status === "FAIL" ? "✗" :
                             ev.status === "WARN" ? "⚠" : "—"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--foreground)]">{ev.label}</span>
                              <span className={`text-[10px] font-bold ${
                                ev.status === "PASS" ? "text-[var(--success)]" :
                                ev.status === "FAIL" ? "text-[var(--danger)]" :
                                ev.status === "WARN" ? "text-[var(--warning)]" :
                                "text-[var(--foreground-tertiary)]"
                              }`}>{ev.score}/{ev.maxScore}</span>
                            </div>
                            <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5">{ev.detail}</p>
                            {ev.source && <p className="text-[10px] text-[var(--foreground-tertiary)]/60 mt-0.5">Source: {ev.source}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extracted Fields */}
                  {viewingDoc.intelligenceData.extractedFields && viewingDoc.intelligenceData.extractedFields.length > 0 && (
                    <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-light)]">
                      <div className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider mb-2">Extracted Fields</div>
                      <div className="space-y-1">
                        {viewingDoc.intelligenceData.extractedFields.map((f: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-xs py-1">
                            <span className={f.verified ? "text-[var(--success)]" : "text-[var(--danger)]"}>{f.verified ? "✓" : "✗"}</span>
                            <span className="text-[var(--foreground-tertiary)] w-28 truncate shrink-0">{f.field}</span>
                            <span className="text-[var(--foreground)] truncate flex-1 font-mono">{f.value}</span>
                            <span className="text-[10px] text-[var(--foreground-tertiary)] shrink-0">{f.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Info */}
                  {viewingDoc.intelligenceData.processing && (
                    <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-light)]">
                      <div className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider mb-2">Processing Details</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div><span className="text-[var(--foreground-tertiary)]">Text Mode:</span> <span className="text-[var(--foreground)]">{viewingDoc.intelligenceData.processing.textExtractionMode}</span></div>
                        <div><span className="text-[var(--foreground-tertiary)]">Text Length:</span> <span className="text-[var(--foreground)]">{viewingDoc.intelligenceData.processing.textLength} chars</span></div>
                        <div><span className="text-[var(--foreground-tertiary)]">OCR Confidence:</span> <span className="text-[var(--foreground)]">{viewingDoc.intelligenceData.processing.ocrConfidence?.toFixed(1)}%</span></div>
                        <div><span className="text-[var(--foreground-tertiary)]">Encrypted:</span> <span className={viewingDoc.intelligenceData.processing.wasEncrypted ? "text-[var(--warning)]" : "text-[var(--success)]"}>{viewingDoc.intelligenceData.processing.wasEncrypted ? "Yes" : "No"}</span></div>
                        <div><span className="text-[var(--foreground-tertiary)]">Pages:</span> <span className="text-[var(--foreground)]">{viewingDoc.intelligenceData.processing.pageCount}</span></div>
                        <div><span className="text-[var(--foreground-tertiary)]">Time:</span> <span className="text-[var(--foreground)]">{viewingDoc.intelligenceData.processing.processingTimeMs}ms</span></div>
                      </div>
                    </div>
                  )}

                  {/* Audit Trail */}
                  {viewingDoc.intelligenceData.audit && viewingDoc.intelligenceData.audit.length > 0 && (
                    <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-light)]">
                      <div className="text-[10px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider mb-2">Audit Trail</div>
                      <div className="space-y-1">
                        {viewingDoc.intelligenceData.audit.map((entry: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <span className="text-[var(--foreground-tertiary)] shrink-0 font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            <span className="text-[var(--accent)] shrink-0 font-semibold w-28 truncate">{entry.step}</span>
                            <span className="text-[var(--foreground-tertiary)] flex-1">{entry.detail}</span>
                            {entry.durationMs != null && <span className="text-[var(--foreground-tertiary)]/60 shrink-0">{entry.durationMs}ms</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PDF Viewer */}
              {viewingDoc.fileName.toLowerCase().endsWith(".pdf") && (
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="bg-[var(--surface-2)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--foreground-secondary)]">Document Preview</span>
                    {previewUrl && <a href={previewUrl} target="_blank" className="text-[10px] text-[var(--accent)] hover:underline">Open in new tab</a>}
                  </div>
                  {previewLoading ? (
                    <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-[var(--surface-2)]">
                      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : previewUrl ? (
                    <iframe src={previewUrl} className="w-full h-[300px] sm:h-[400px] bg-white" title="Document Preview" />
                  ) : (
                    <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-[var(--surface-2)] text-[var(--foreground-tertiary)] text-xs">
                      Unable to load preview — try downloading instead
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview */}
              {[".png", ".jpg", ".jpeg"].some(ext => viewingDoc.fileName.toLowerCase().endsWith(ext)) && (
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="bg-[var(--surface-2)] px-4 py-2 border-b border-[var(--border)]">
                    <span className="text-xs font-semibold text-[var(--foreground-secondary)]">Image Preview</span>
                  </div>
                  {previewLoading ? (
                    <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-[var(--background)]">
                      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : previewUrl ? (
                    <img src={previewUrl} alt={viewingDoc.fileName} className="w-full max-h-[300px] sm:max-h-[400px] object-contain bg-[var(--background)]" />
                  ) : (
                    <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-[var(--background)] text-[var(--foreground-tertiary)] text-xs">
                      Unable to load preview — try downloading instead
                    </div>
                  )}
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-3 flex-wrap">
                {(() => { const st = statusConfig[viewingDoc.status] || statusConfig.UPLOADED; return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>; })()}
                {viewingDoc.verificationStatus === "VERIFIED" && <span className="text-xs text-[var(--success)] flex items-center gap-1"><Shield className="w-3 h-3" /> Verified</span>}
                {viewingDoc.verificationStatus === "NEEDS_REVIEW" && <span className="text-xs text-[var(--warning)] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Needs Review</span>}
                {viewingDoc.verificationStatus === "REVIEW_REQUIRED" && <span className="text-xs text-[var(--danger)] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Review Required</span>}
                <span className="text-xs text-[var(--foreground-tertiary)]">Version {viewingDoc.version || 1}</span>
              </div>
              
              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {viewingDoc.gstin && <MetaRow icon={Building2} label="GSTIN" value={viewingDoc.gstin} />}
                {viewingDoc.pan && <MetaRow icon={Tag} label="PAN" value={viewingDoc.pan} />}
                {viewingDoc.documentNumber && <MetaRow icon={Hash} label="Document No." value={viewingDoc.documentNumber} />}
                {viewingDoc.registrationNumber && <MetaRow icon={BookOpen} label="Registration No." value={viewingDoc.registrationNumber} />}
                {viewingDoc.issuingOrg && <MetaRow icon={Building2} label="Issuing Organization" value={viewingDoc.issuingOrg} />}
                {viewingDoc.issueDate && <MetaRow icon={Calendar} label="Issue Date" value={new Date(viewingDoc.issueDate).toLocaleDateString()} />}
                {viewingDoc.expiryDate && <MetaRow icon={Clock} label="Expiry Date" value={new Date(viewingDoc.expiryDate).toLocaleDateString()} />}
                {viewingDoc.authorizedPerson && <MetaRow icon={Star} label="Authorized Person" value={viewingDoc.authorizedPerson} />}
                <MetaRow icon={Calendar} label="Uploaded" value={new Date(viewingDoc.createdAt).toLocaleString()} />
                <MetaRow icon={Hash} label="SHA-256" value={viewingDoc.sha256} />
              </div>

              {/* Extracted fields */}
              {viewingDoc.extractions && viewingDoc.extractions.length > 0 && (
                <div className="bg-[var(--surface-2)] rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-[var(--foreground-secondary)] mb-3 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> Extracted Data ({viewingDoc.extractions.length} fields)
                    {viewingDoc.extractions[0]?.source === "SIMULATED" && <span className="text-[10px] text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full ml-2">Simulated — not from actual document</span>}
                    {viewingDoc.extractions[0]?.source === "VISION" && <span className="text-[10px] text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full ml-2">AI Vision Extracted</span>}
                  </h4>
                  <div className="space-y-1">
                    {viewingDoc.extractions.map((e: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 text-xs py-1.5 border-b border-[var(--border-light)] last:border-0">
                        <span className="text-[var(--foreground-tertiary)] shrink-0 w-32 truncate">{e.field}</span>
                        <span className="text-[var(--foreground)] flex-1 break-all">{e.value}</span>
                        {e.confidence != null && <span className="text-[var(--foreground-tertiary)] shrink-0">{(e.confidence * 100).toFixed(0)}%</span>}
                        {e.source === "SIMULATED" && <span className="text-[10px] text-[var(--warning)] shrink-0">SIM</span>}
                        {e.source === "VISION" && <span className="text-[10px] text-[var(--success)] shrink-0">AI</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { deleteDocument(viewingDoc.id); setViewingDoc(null); }} className="flex items-center gap-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 px-4 py-2 rounded-lg transition-colors border border-[var(--danger)]/20">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={() => { navigator.clipboard.writeText(viewingDoc.sha256); setMessage({ type: "success", text: "SHA-256 hash copied!" }); }} className="flex items-center gap-1.5 text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] px-4 py-2 rounded-lg transition-colors border border-[var(--border)]">
                  <Copy className="w-3.5 h-3.5" /> Copy Hash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-[var(--accent)]/8 border border-[var(--accent)]/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-semibold mb-1">
          <Info className="w-4 h-4" /> How Document Vault Works
        </div>
        <p className="text-xs text-[var(--foreground-tertiary)] leading-relaxed">
          Upload your organization documents once and reuse them across all tender applications. 
          AI automatically classifies, extracts data, and verifies your documents. 
          When you apply to a tender, eligible documents are automatically attached — no re-uploading needed.
        </p>
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-[var(--surface-2)] rounded-lg px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-[var(--foreground-tertiary)] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-[var(--foreground-tertiary)]">{label}</div>
        <div className="text-xs text-[var(--foreground)] truncate font-mono">{value}</div>
      </div>
    </div>
  );
}

async function replaceDoc(docId: string, file: File) {
  const form = new FormData();
  form.append("files", file);
  try {
    const res = await fetch(`/api/bidder/vault/${docId}`, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      window.location.reload();
    }
  } catch {}
}
