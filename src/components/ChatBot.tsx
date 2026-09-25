"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, RefreshCw } from "lucide-react";
import { useSession } from "@/lib/useSession";
import { getSessionClient } from "@/lib/session";

/* ────────────────────────────────────────────────────────────────
   BIDGUARD AI Assistant v3 — Fully Context-Aware
   Knows: user profile, org, applications, bids, vault, compliance
   ──────────────────────────────────────────────────────────────── */

interface Message { id: string; role: "user" | "assistant"; content: string; ts: number; followUps?: string[]; }
interface UserCtx {
  user: { name: string; email: string; role: string } | null;
  organization: { legalName: string; gstin: string; pan: string; udyamNumber: string; state: string; city: string; isMsme: boolean; businessCategory: string } | null;
  applications: { id: string; number: string; status: string; progress: number; tenderNumber: string; tenderTitle: string; documentsAttached: number; requiredDocs: { code: string; file: string; type: string; status: string }[] }[];
  bids: { id: string; number: string; status: string; decision: string; decisionNotes: string; complianceScore: number; riskLevel: string; tenderNumber: string; tenderTitle: string; documents: { name: string; type: string; verification: string }[]; complianceChecks: { requirement: string; status: string; notes: string }[] }[];
  vaultDocuments: { name: string; type: string; verification: string; score: number; status: string }[];
  notifications: { title: string; body: string; read: boolean; date: string }[];
  stats: { totalApplications: number; submittedApplications: number; totalBids: number; totalVaultDocs: number; verifiedVaultDocs: number; unreadNotifications: number };
}

const CTX_KEY = "bidguard_chatbot_ctx";
const GREETING_KEY = "bidguard_chatbot_greeted";

/* ── Intent detection ── */
function detectIntent(q: string, ctx: UserCtx | null): { intent: string; params: string[] } {
  const lower = q.toLowerCase();
  const params: string[] = [];

  // Application / form queries
  if (/mera.*form|form.*submit|application.*kya|apply.*kya|kitne.*apply|apply.*status|application.*status/.test(lower)) return { intent: "my_applications", params };
  if (/form.*reject|form.*reject.*hua|application.*reject|kyu.*reject|kyu.*nahi.*hua|reject.*karan|problem.*kya/.test(lower)) return { intent: "rejection_reason", params };
  if (/progress|kitna.*hua|comple.*hai|draft.*hai|ready.*hai/.test(lower)) return { intent: "application_progress", params };

  // Bid queries
  if (/mera.*bid|bid.*status|bid.*kya|bid.*decid|bid.*compli|score.*kya|compliance.*score|mera.*score/.test(lower)) return { intent: "my_bids", params };
  if (/bid.*reject|bid.*fail|bid.*conditional|bid.*pass|decision.*kya|kya.*hua.*bid/.test(lower)) return { intent: "bid_decision", params };

  // Document / vault queries
  if (/mera.*document|document.*kya|vault.*kya|kitne.*document|document.*upload|mera.*pan|mera.*gstin|mera.*udyam/.test(lower)) return { intent: "my_documents", params };
  if (/pan.*reject|pan.*kya|gstin.*reject|gstin.*kya|udyam.*kya|document.*verify|document.*status/.test(lower)) return { intent: "document_status", params };

  // Compliance checks
  if (/compliance.*check|check.*kya|compliance.*result|kya.*check.*hua/.test(lower)) return { intent: "compliance_details", params };

  // Notification queries
  if (/notification|message|kya.*aaya|alert|notify/.test(lower)) return { intent: "my_notifications", params };

  // Profile / org queries
  if (/mera.*profile|profile.*kya|organization.*kya|company.*kya|mera.*naam|mera.*data/.test(lower)) return { intent: "my_profile", params };

  // General (fallback to static topics)
  return { intent: "general", params };
}

/* ── Context-aware responses ── */
function respondWithContext(intent: string, q: string, ctx: UserCtx | null): { text: string; followUps: string[] } {
  if (!ctx || !ctx.user) {
    return { text: "Aap login nahi hain. Pehle login karein phir main aapka data dikha sakta hoon.", followUps: ["Login kaise karu?", "Account kaise banau?"] };
  }

  const name = ctx.user.name?.split(" ")[0] || "aap";

  switch (intent) {
    case "my_applications": {
      if (ctx.applications.length === 0) {
        return {
          text: `${name}, abhi aapne koi application submit nahi ki hai.\n\nDashboard par jaake koi tender dhoondh kar "Apply With My Documents" click karein.`,
          followUps: ["Tenders kaise dhoondhu?", "Documents kya chahiye?"],
        };
      }
      const lines = ctx.applications.map((a) => {
        const statusEmoji = a.status === "SUBMITTED" ? "✅" : a.status === "DECIDED" ? "🏁" : a.status === "DRAFT" ? "📝" : "⏳";
        return `${statusEmoji} **${a.number}** — ${a.tenderTitle || a.tenderNumber}\n   Status: ${a.status} | Progress: ${a.progress}% | Docs: ${a.documentsAttached}`;
      });
      return {
        text: `${name}, ye hain aapki applications:\n\n${lines.join("\n\n")}\n\nTotal: ${ctx.applications.length} | Submitted: ${ctx.stats.submittedApplications}`,
        followUps: ["Koi document missing hai?", "Compliance score kya hai?", "Application submit kaise karu?"],
      };
    }

    case "rejection_reason": {
      const rejected = ctx.applications.filter((a) => a.status === "DECIDED");
      const failedBids = ctx.bids.filter((b) => b.decision === "REJECTED" || b.decision === "NON_COMPLIANT");
      if (rejected.length === 0 && failedBids.length === 0) {
        return {
          text: `${name}, aapki koi application reject nahi hui hai. Sab theek chal raha hai! 👍\n\nAgar kisi bid ka score kam aaya hai to main detail mein bata sakta hoon.`,
          followUps: ["Mera compliance score kya hai?", "Score kaise improve karu?"],
        };
      }
      const lines = failedBids.map((b) => {
        const failedChecks = b.complianceChecks.filter((c) => c.status === "FAIL" || c.status === "ERROR");
        const checkLines = failedChecks.map((c) => `   ❌ ${c.requirement} — ${c.notes || "Failed"}`).join("\n");
        return `**Bid ${b.number}** (${b.tenderNumber})\n   Decision: ${b.decision}\n${checkLines || "   No specific failure notes"}`;
      });
      return {
        text: `${name}, ye hain rejection reasons:\n\n${lines.join("\n\n")}\n\nAap in documents ko update karke phir se apply kar sakte hain.`,
        followUps: ["Document kaise update karu?", "Phir se apply kaise karu?"],
      };
    }

    case "application_progress": {
      const drafts = ctx.applications.filter((a) => a.status === "DRAFT" || a.status === "IN_PROGRESS");
      if (drafts.length === 0) {
        return { text: `${name}, aapki sab applications submitted hain. Koi draft mein nahi hai.`, followUps: ["Naya tender dhoondhu?", "Documents check karu?"] };
      }
      const lines = drafts.map((a) => {
        const missing = a.requiredDocs.filter((d) => !d.file || d.file === "");
        const missingCodes = missing.map((d) => d.code).join(", ");
        return `**${a.number}** — ${a.tenderTitle}\n   Progress: ${a.progress}% | Status: ${a.status}${missingCodes ? `\n   ⚠️ Missing: ${missingCodes}` : "\n   ✅ All docs attached"}`;
      });
      return {
        text: `${name}, ye applications abhi incomplete hain:\n\n${lines.join("\n\n")}\n\nInhe complete karne ke liye documents upload karein aur submit karein.`,
        followUps: ["Kaunse documents missing hain?", "Upload kaise karu?"],
      };
    }

    case "my_bids": {
      if (ctx.bids.length === 0) {
        return {
          text: `${name}, abhi aapne koi bid submit nahi ki hai. Pehle koi tender dhoondh kar apply karein.`,
          followUps: ["Tenders dikhao", "Apply kaise karu?"],
        };
      }
      const lines = ctx.bids.map((b) => {
        const statusEmoji = b.status === "DECIDED" ? (b.decision === "COMPLIANT" ? "✅" : "❌") : b.status === "VERIFIED" ? "🔍" : "⏳";
        return `${statusEmoji} **${b.number}** — ${b.tenderTitle || b.tenderNumber}\n   Score: ${b.complianceScore ?? "—"}/100 | Risk: ${b.riskLevel || "N/A"} | Decision: ${b.decision || "Pending"}`;
      });
      return {
        text: `${name}, ye hain aapke bids:\n\n${lines.join("\n\n")}\n\nTotal: ${ctx.bids.length}`,
        followUps: ["Kyu reject hua?", "Score kaise improve karu?", "Naya bid dalu?"],
      };
    }

    case "bid_decision": {
      const decided = ctx.bids.filter((b) => b.decision);
      if (decided.length === 0) {
        return { text: `${name}, aapke kisi bid pe abhi decision nahi aaya hai. Officer review kar raha hai.`, followUps: ["Kab aayega decision?", "Status kya hai?"] };
      }
      const lines = decided.map((b) => {
        const emoji = b.decision === "COMPLIANT" ? "✅ PASS" : b.decision === "CONDITIONAL" ? "⚠️ HOLD" : "❌ FAIL";
        return `**${b.number}** (${b.tenderNumber})\n   ${emoji}\n   ${b.decisionNotes ? `Reason: ${b.decisionNotes}` : "No notes"}`;
      });
      return {
        text: `${name}, ye hain aapke bid decisions:\n\n${lines.join("\n\n")}`,
        followUps: ["Kya galti thi?", "Phir se apply karu?", "Document update karu?"],
      };
    }

    case "my_documents": {
      if (ctx.vaultDocuments.length === 0) {
        return {
          text: `${name}, aapke vault mein abhi koi document nahi hai. Dashboard par "Document Vault" mein jaake upload karein.`,
          followUps: ["Documents kaise upload karu?", "Kaunse documents chahiye?"],
        };
      }
      const grouped: Record<string, typeof ctx.vaultDocuments> = {};
      ctx.vaultDocuments.forEach((d) => { (grouped[d.type] = grouped[d.type] || []).push(d); });
      const lines = Object.entries(grouped).map(([type, docs]) => {
        const verified = docs.filter((d) => d.verification === "VERIFIED").length;
        return `📄 **${type.replace(/_/g, " ")}** — ${docs.length} file(s) (${verified} verified)`;
      });
      return {
        text: `${name}, aapke vault mein ye documents hain:\n\n${lines.join("\n")}\n\nTotal: ${ctx.vaultDocuments.length} | Verified: ${ctx.stats.verifiedVaultDocs}`,
        followUps: ["Koi document expire hua?", "Naya document upload karu?", "Verification kaise hota hai?"],
      };
    }

    case "document_status": {
      const issues = ctx.vaultDocuments.filter((d) => d.verification !== "VERIFIED" || d.status !== "PROCESSED");
      if (issues.length === 0) {
        return { text: `${name}, aapke sab documents verified aur processed hain. Koi issue nahi hai! ✅`, followUps: ["Naya document upload karu?", "Documents kaise kaam karte hain?"] };
      }
      const lines = issues.map((d) => {
        const emoji = d.verification === "VERIFIED" ? "✅" : d.verification === "SUSPICIOUS" ? "⚠️" : "❌";
        return `${emoji} **${d.name}** (${d.type.replace(/_/g, " ")}) — Status: ${d.verification || d.status}`;
      });
      return {
        text: `${name}, ye documents abhi processed nahi hain ya issues hain:\n\n${lines.join("\n")}\n\nInhe Dashboard > Document Vault mein jaake re-upload karein.`,
        followUps: ["Kyu fail hua?", "Dobara upload kaise karu?"],
      };
    }

    case "compliance_details": {
      const allChecks = ctx.bids.flatMap((b) => b.complianceChecks.map((c) => ({ ...c, bidNumber: b.number })));
      if (allChecks.length === 0) {
        return { text: `${name}, abhi koi compliance check nahi hua. Pehle bid submit karein.`, followUps: ["Bid kaise submit karu?"] };
      }
      const passed = allChecks.filter((c) => c.status === "PASS").length;
      const failed = allChecks.filter((c) => c.status === "FAIL").length;
      const warnings = allChecks.filter((c) => c.status === "WARNING" || c.status === "CONDITIONAL").length;
      const failedLines = allChecks.filter((c) => c.status === "FAIL").slice(0, 5).map((c) => `   ❌ ${c.requirement} — ${c.notes || "Failed"}`);
      return {
        text: `${name}, compliance summary:\n\n✅ Passed: ${passed}\n❌ Failed: ${failed}\n⚠️ Warnings: ${warnings}\n${failedLines.length > 0 ? "\nFailed checks:\n" + failedLines.join("\n") : ""}`,
        followUps: ["Failed checks kaise thik karu?", "Score kaise badhau?", "Kya check hota hai?"],
      };
    }

    case "my_notifications": {
      const unread = ctx.notifications.filter((n) => !n.read);
      if (unread.length === 0) {
        return { text: `${name}, aapke paas koi unread notification nahi hai. Sab padh liya! 📬`, followUps: ["Naya tender aaya?", "Application status?"] };
      }
      const lines = unread.slice(0, 5).map((n) => `📩 **${n.title}**\n   ${n.body?.slice(0, 120) || "No details"}`);
      return {
        text: `${name}, aapke ${unread.length} unread notifications hain:\n\n${lines.join("\n\n")}`,
        followUps: ["Aur notifications dikhao", "Compliance status?"],
      };
    }

    case "my_profile": {
      const org = ctx.organization;
      if (!org) {
        return { text: `${name}, aapka organization profile complete nahi hai. Dashboard par "Organization Profile" mein jaake fill karein.`, followUps: ["Profile kaise fill karu?", "Kaunse details chahiye?"] };
      }
      return {
        text: `${name}, aapka profile:\n\n🏢 **${org.legalName}**\n🪪 PAN: ${org.pan || "Not set"}\n📋 GSTIN: ${org.gstin || "Not set"}\n🏷️ Udyam: ${org.udyamNumber || "Not set"}\n📍 ${org.city}, ${org.state}\n🏭 Category: ${org.businessCategory || "N/A"}\n${org.isMsme ? "✅ MSME Registered" : "❌ Not MSME"}`,
        followUps: ["Profile edit kaise karu?", "Documents kya chahiye?"],
      };
    }

    default:
      return respondToGeneral(q, ctx);
  }
}

/* ── General/static knowledge (fallback) ── */
function respondToGeneral(q: string, ctx: UserCtx | null): { text: string; followUps: string[] } {
  const lower = q.toLowerCase();
  const name = ctx?.user?.name?.split(" ")[0] || "";

  if (/^(hi|hello|hey|namaste|namaskar|hlo)\b/.test(lower)) {
    return {
      text: `Namaste${name ? `, ${name}` : ""}! 👋 Main **BIDGUARD AI Assistant** hoon.\n\nMain aapke account ke baare mein sab jaanta hoon — applications, bids, documents, compliance, notifications. Kuch bhi puchho!`,
      followUps: ["Meri applications dikhao", "Mera score kya hai?", "Documents kya hain?"],
    };
  }
  if (/(thank|shukriya|dhanyavad|great|nice|helpful)/.test(lower)) {
    return { text: "Khushi hui madad karke 😊 Aur kuch jaanna ho to bas type karein.", followUps: ["Applications dikhao", "Documents check karo", "Compliance score?"] };
  }
  if (/tender|tenders|listing|available|open|browse/.test(lower)) {
    return {
      text: `Tenders browse karne ke liye **Search Tenders** page par jaain:\n\n• Har tender mein number, department, value, closing date\n• Requirements expand karke dekh sakte hain\n• Apply button se seedha apply kar sakte hain`,
      followUps: ["Apply kaise karu?", "Requirements kya hain?"],
    };
  }
  if (/apply|bid|submit|participate/.test(lower)) {
    return {
      text: `Apply karne ke steps:\n\n1️⃣ Tender par click karein\n2️⃣ "Apply With My Documents" dabayein\n3️⃣ Required documents attach karein\n4️⃣ Review & Submit karein\n\nAI turant compliance check chala dega.`,
      followUps: ["Kaunse documents chahiye?", "Compliance score kaise banta hai?"],
    };
  }
  if (/document|upload|certificate|gst|pan|udyam/.test(lower)) {
    return {
      text: `Commonly required documents:\n\n📄 **GST Certificate** — GST registration\n🪪 **PAN Card** — Company/personal PAN\n🏢 **Udyam Certificate** — MSME registration\n📊 **Turnover Proof** — CA-certified\n✍️ **OEM Authorization** — Dealer/distributor\n\nUpload karte hi AI OCR extract karta hai aur portals se verify karta hai.`,
      followUps: ["Mere vault mein kya hai?", "Verification kaise hota hai?"],
    };
  }
  if (/compliance|score|risk|verify/.test(lower)) {
    return {
      text: `Compliance score **evidence-based** hota hai:\n\n✔️ Document forensics (tampering)\n✔️ QR code consistency\n✔️ Cross-document identity match\n✔️ Government portal verification\n\nScore ke saath risk level aur coverage matrix milta hai.`,
      followUps: ["Mera score kya hai?", "Score kaise improve karu?"],
    };
  }
  if (/ai|ocr|technology|how.*work|kaise.*kaam/.test(lower)) {
    return {
      text: `Main 4 layers pe kaam karta hoon:\n\n🧠 **Document AI** — OCR se fields extract\n🔍 **Forensics** — PDF tampering, signature detect\n⚖️ **Rules Engine** — Deterministic checks\n💬 **RAG** — Government docs se grounded answers\n\nBina internet ke bhi structural verification hota hai.`,
      followUps: ["Security kaise hai?", "Data safe hai?"],
    };
  }
  if (/security|safe|privacy|data/.test(lower)) {
    return {
      text: `Security:\n\n🔐 Encrypted storage\n🔑 API keys server-side only\n👥 Role-based access — bidder sirf apna data\n📜 Audit trail\n\nAapka data kisi third-party ko nahi jata.`,
      followUps: ["Delete karna ho to?", "Kaun dekh sakta hai?"],
    };
  }
  if (/free|price|cost|charge/.test(lower)) {
    return { text: "Platform **completely free** hai bidders ke liye. Registration, browsing, upload, verification — sab free.", followUps: ["Account banayein?", "Tenders dikhao?"] };
  }

  // Check if user is asking about themselves
  if (/mera|mujhe|my|mine|mera|mere/.test(lower) && ctx?.user) {
    return {
      text: `${name}, aap kya jaanna chahte hain? Main ye sab bata sakta hoon:\n\n📋 **Applications** — kitni hain, status kya hai\n📄 **Documents** — vault mein kya hai\n📊 **Compliance** — score kya hai, checks kya pass/fail\n🔔 **Notifications** — kya naya aaya\n🏢 **Profile** — organization details`,
      followUps: ["Meri applications dikhao", "Mera score kya hai", "Documents kya hain", "Notifications dikhao"],
    };
  }

  return {
    text: `Samajh nahi aaya 🤔 Lekin main ye sab jaanta hoon:\n\n📋 Mera application status\n📄 Mere documents\n📊 Compliance score\n🔔 Notifications\n🏢 Profile details\n\nKuch inme se puchho!`,
    followUps: ["Applications dikhao", "Score kya hai", "Documents kya hain", "Profile dikhao"],
  };
}

/* ── Static quick-start sets ── */
const GUEST_QS = ["Tenders kaise dhoondhu?", "Apply kaise karu?", "Documents kya chahiye?", "AI kaise kaam karta hai?"];
const BIDDER_QS = ["Meri applications dikhao", "Mera score kya hai", "Documents kya hain", "Notifications?"];
const OFFICER_QS = ["High risk bids?", "Verification queue?", "Platform stats", "Recent decisions?"];

export default function ChatBot({ context }: { context?: "landing" | "admin" | "bidder" | "officer" }) {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [userCtx, setUserCtx] = useState<UserCtx | null>(null);
  const [ctxLoaded, setCtxLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Session + context load
  useEffect(() => {
    getSessionClient().then((u) => {
      if (u?.role === "BIDDER" || u?.role === "PROCUREMENT_OFFICER") {
        fetch("/api/chatbot/context").then((r) => r.json()).then((d) => {
          if (d.ok) { setUserCtx(d.data); setCtxLoaded(true); }
        }).catch(() => setCtxLoaded(true));
      } else {
        setCtxLoaded(true);
      }
    }).catch(() => setCtxLoaded(true));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function push(role: "user" | "assistant", content: string, followUps?: string[]) {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content, ts: Date.now(), followUps }]);
  }

  function openGreeting() {
    if (messages.length > 0) return; // Don't re-greet
    setTyping(true);
    setTimeout(() => {
      const ctx = userCtx;
      if (ctx?.user) {
        const name = ctx.user.name?.split(" ")[0] || "";
        const summary = [];
        if (ctx.stats.totalApplications > 0) summary.push(`${ctx.stats.totalApplications} application(s)`);
        if (ctx.stats.totalBids > 0) summary.push(`${ctx.stats.totalBids} bid(s)`);
        if (ctx.stats.totalVaultDocs > 0) summary.push(`${ctx.stats.totalVaultDocs} document(s) in vault`);
        if (ctx.stats.unreadNotifications > 0) summary.push(`${ctx.stats.unreadNotifications} unread notification(s)`);

        push("assistant",
          `Namaste, ${name}! 👋 Main **BIDGUARD AI Assistant** hoon.\n\n` +
          `Aapke account ka snapshot:\n${summary.length > 0 ? summary.map((s) => `• ${s}`).join("\n") : "• Naya account — shuruaat karein!"}\n\n` +
          `Main aapki applications, bids, documents, compliance — sab ke baare mein jaanta hoon. Kuch bhi puchho!`,
          BIDDER_QS,
        );
      } else {
        push("assistant",
          `Namaste${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋 Main **BIDGUARD AI Assistant** hoon.\n\n` +
          `Main tenders, documents, compliance, AI system — sab explain kar sakta hoon.\nNeeche chips par click karein ya type karein.`,
          GUEST_QS,
        );
      }
      setTyping(false);
    }, 400);
  }

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    setInput("");
    push("user", q);
    setTyping(true);

    setTimeout(() => {
      const { intent } = detectIntent(q, userCtx);
      const response = intent === "general" || intent === "my_applications" || intent === "my_bids" || intent === "my_documents" || intent === "my_profile" || intent === "my_notifications" || intent === "bid_decision" || intent === "compliance_details" || intent === "document_status" || intent === "rejection_reason" || intent === "application_progress"
        ? respondWithContext(intent, q, userCtx)
        : respondToGeneral(q, userCtx);
      push("assistant", response.text, response.followUps);
      setTyping(false);
    }, 350 + Math.random() * 350);
  }

  function resetChat() {
    setMessages([]);
    openGreeting();
  }

  const lastBotIdx = [...messages].reverse().findIndex(m => m.role === "assistant");
  const lastBotRealIdx = lastBotIdx === -1 ? -1 : messages.length - 1 - lastBotIdx;
  const quickSet = context === "officer" ? OFFICER_QS : user?.role === "BIDDER" ? BIDDER_QS : GUEST_QS;

  function renderContent(c: string) {
    return c.split("\n").map((line, i) => {
      const html = line
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[var(--foreground)]">$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-[var(--surface-3)] px-1 py-0.5 rounded text-[11px]">$1</code>');
      const isBullet = /^\s*[•🔹📄🪪✍️📊✔️⚡🔵📧✅❌⚠️📝🏁⏳🔍📩🏭📍🪪📋🏷️1️⃣2️⃣3️⃣]/.test(line) || /^\d️⃣/.test(line);
      return <p key={i} className={`${isBullet ? "pl-1" : ""} ${line.trim() === "" ? "h-2" : ""}`} dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />;
    });
  }

  return (
    <>
      {!isOpen && (
        <button onClick={() => { setIsOpen(true); if (messages.length === 0) openGreeting(); }}
          aria-label="AI Assistant"
          className="fixed bottom-6 right-6 z-[10000] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 cursor-pointer bg-[var(--navy-800)] hover:bg-[var(--navy-700)] text-white ring-4 ring-[var(--navy-800)]/15">
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-[9999] sm:w-[420px] sm:max-w-[calc(100vw-3rem)] sm:h-[640px] sm:max-h-[calc(100vh-8rem)] bg-[var(--surface)] sm:bg-[var(--surface)] sm:border sm:border-[var(--border)] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[var(--navy-800)] px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[var(--navy-600)] to-[var(--navy-800)] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white leading-tight">BIDGUARD AI Assistant</h3>
                <p className="text-[10px] text-white/65 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--green-500)] rounded-full animate-pulse" /> Online · {userCtx ? "Context-aware" : "Loading..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={resetChat} title="New conversation" className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} title="Close chat" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer">
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
            {messages.map((m, idx) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[var(--navy-600)] to-[var(--navy-800)] flex items-center justify-center shrink-0 mt-1 mr-2">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="max-w-[85%]">
                  <div className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap ${m.role === "user"
                    ? "bg-[var(--navy-800)] text-white rounded-br-md"
                    : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-md"}`}>
                    {m.role === "assistant" ? renderContent(m.content) : m.content}
                  </div>
                  <div className={`text-[9px] text-[var(--foreground-tertiary)] mt-1 ${m.role === "user" ? "text-right pr-1" : "ml-1"}`}>
                    {new Date(m.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {m.role === "assistant" && <span className="ml-1.5">· AI suggestion only</span>}
                  </div>
                  {m.role === "assistant" && idx === lastBotRealIdx && !typing && m.followUps && m.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.followUps.map((f, i) => (
                        <button key={i} onClick={() => send(f)}
                          className="text-[11px] font-medium text-[var(--navy-600)] bg-[var(--navy-100)] border border-[var(--navy-200)] hover:bg-[var(--navy-700)]/20 hover:text-[var(--navy-800)] px-3 py-1.5 rounded-full transition-all cursor-pointer pressable">
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-[var(--gray-200)] flex items-center justify-center shrink-0 mt-1 ml-2">
                    <User className="w-4 h-4 text-[var(--foreground)]" />
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[var(--navy-600)] to-[var(--navy-800)] flex items-center justify-center shrink-0 mt-1 mr-2">
                  <Bot className="w-4 h-4 text-[var(--foreground)]" />
                </div>
                <div className="bg-white/[0.07] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3.5">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-[var(--gray-400)] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {quickSet.map((q, i) => (
                  <button key={i} onClick={() => send(q)} disabled={typing}
                    className="text-[11px] whitespace-nowrap text-[var(--foreground-secondary)] bg-[var(--surface-2)] hover:bg-white/[0.12] border border-[var(--border)] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 cursor-pointer">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 sm:p-3.5 border-t border-[var(--border)] shrink-0 flex items-center gap-2">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="Kuch bhi puchho — applications, bids, documents..."
              aria-label="Message"
              disabled={typing}
              className="flex-1 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-full text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--navy-600)] focus:bg-[var(--surface-3)] focus:outline-none disabled:opacity-50 transition-colors" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Send"
              className="w-10 h-10 bg-[var(--navy-800)] hover:bg-[var(--navy-700)] disabled:opacity-40 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0">
              {typing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </form>
          <p className="text-[9px] text-center text-[var(--foreground-tertiary)] pb-2 -mt-1 shrink-0">Context-aware AI · Officer makes final decisions</p>
        </div>
      )}
    </>
  );
}
