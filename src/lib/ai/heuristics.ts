import { INDIAN_STATES } from "@/lib/constants";

/**
 * Deterministic heuristic fallbacks. These run when no cloud AI provider is configured
 * (DEMO MODE) or when a provider call fails. Every result produced here is labelled
 * simulated by the orchestrator — it is a working stand-in, never presented as live AI.
 */

export interface ExtractedRequirement {
  type: string;
  title: string;
  description: string;
  mandatory: boolean;
  evidenceRequired: boolean;
  params: Record<string, unknown>;
  sourceText: string;
  confidence: number;
  page: number;
}

function toLakh(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("crore")) return value * 100;
  return value; // lakh
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  let end = text.indexOf(".", index);
  if (end === -1) end = Math.min(text.length, index + 200);
  return text.slice(start, end).trim().slice(0, 400);
}

/** Heuristic tender requirement extraction (regex-based, transparent, no hallucination). */
export function parseTenderRequirementsHeuristic(text: string): ExtractedRequirement[] {
  const out: ExtractedRequirement[] = [];
  const add = (r: Omit<ExtractedRequirement, "page"> & { page?: number }) =>
    out.push({ ...r, page: r.page ?? 1 });

  const turnover = /average\s+annual\s+(?:financial\s+)?turnover[^.]{0,120}?([\d,.]+)\s*(crore|crores|lakh|lakhs|lacs)/i.exec(text)
    ?? /annual\s+turnover[^.]{0,120}?([\d,.]+)\s*(crore|crores|lakh|lakhs|lacs)/i.exec(text);
  if (turnover) {
    const value = parseFloat(turnover[1].replace(/,/g, ""));
    add({
      type: "TURNOVER",
      title: `Minimum average annual turnover of ${turnover[1]} ${turnover[2]}`,
      description: `Bidders must demonstrate an average annual turnover of at least ${turnover[1]} ${turnover[2]} as per audited financial statements.`,
      mandatory: true,
      evidenceRequired: true,
      params: { minTurnoverLakh: toLakh(value, turnover[2]) },
      sourceText: sentenceAround(text, turnover.index ?? 0),
      confidence: 0.82,
    });
  }

  const exp = /(\d+)\s*(?:consecutive\s+)?years?[^.]{0,80}(experience|supply|execution)/i.exec(text)
    ?? /(experience|supply)[^.]{0,60}?(\d+)\s*years?/i.exec(text);
  if (exp) {
    const years = parseInt(exp[1].match(/\d+/)?.[0] ?? exp[2] ?? "0", 10);
    if (years > 0) {
      add({
        type: "EXPERIENCE",
        title: `Minimum ${years} years of past experience`,
        description: `Bidders must have at least ${years} years of experience in supply/execution of similar works.`,
        mandatory: true,
        evidenceRequired: true,
        params: { years },
        sourceText: sentenceAround(text, exp.index ?? 0),
        confidence: 0.78,
      });
    }
  }

  if (/\boem\b|original\s+equipment\s+manufacturer/i.test(text)) {
    const optional = /oem[^.]{0,120}(preferred|optional)/i.test(text) ? false : true;
    add({
      type: "OEM_AUTHORIZATION",
      title: "OEM Authorization Certificate",
      description: optional
        ? "Bidders must submit an OEM Authorization Certificate from the Original Equipment Manufacturer."
        : "OEM Authorization Certificate from the Original Equipment Manufacturer (where applicable).",
      mandatory: optional,
      evidenceRequired: true,
      params: {},
      sourceText: sentenceAround(text, text.search(/\boem\b|original\s+equipment\s+manufacturer/i)),
      confidence: 0.8,
    });
  }

  const lc = /local\s+content[^.]{0,120}?(\d+)\s*%/i.exec(text);
  if (lc) {
    add({
      type: "LOCAL_CONTENT",
      title: `Minimum local content of ${lc[1]}%`,
      description: `Bidders must certify minimum local content of ${lc[1]}% as per Make in India Order (PPP-MII 2017).`,
      mandatory: true,
      evidenceRequired: true,
      params: { localContentPct: parseInt(lc[1], 10) },
      sourceText: sentenceAround(text, lc.index ?? 0),
      confidence: 0.85,
    });
  }

  if (/\bgst\b|goods\s+and\s+services\s+tax/i.test(text)) {
    add({
      type: "GST_REGISTRATION",
      title: "Active GST registration",
      description: "Bidder must hold an active GST registration and provide a valid GSTIN.",
      mandatory: true,
      evidenceRequired: true,
      params: {},
      sourceText: sentenceAround(text, text.search(/\bgst\b|goods\s+and\s+services\s+tax/i)),
      confidence: 0.88,
    });
  }

  if (/\bpan\b|permanent\s+account\s+number/i.test(text)) {
    add({
      type: "PAN",
      title: "Valid PAN in bidder's name",
      description: "Bidder must possess a valid Permanent Account Number (PAN) issued in the organization's legal name.",
      mandatory: true,
      evidenceRequired: true,
      params: {},
      sourceText: sentenceAround(text, text.search(/\bpan\b|permanent\s+account\s+number/i)),
      confidence: 0.86,
    });
  }

  if (/udyam|msme|micro\s+(?:and|&)\s+small/i.test(text)) {
    const mandatory = /msme[^.]{0,100}(mandatory|must|compulsor)/i.test(text);
    add({
      type: "UDYAM",
      title: "Udyam (MSME) registration",
      description: mandatory
        ? "Bidder must hold a valid Udyam registration under the MSME Act."
        : "Udyam (MSME) registration where the bidder claims MSME benefits such as purchase preference.",
      mandatory,
      evidenceRequired: true,
      params: {},
      sourceText: sentenceAround(text, text.search(/udyam|msme|micro\s+(?:and|&)\s+small/i)),
      confidence: 0.75,
    });
  }

  const emd = /emd|earnest\s+money\s+deposit|bid\s+security/i.exec(text);
  if (emd) {
    const amount = /(?:emd|earnest\s+money\s+deposit|bid\s+security)[^.]{0,120}?([\d,.]+)\s*(crore|crores|lakh|lakhs|lacs)?/i.exec(text);
    add({
      type: "EMD",
      title: "EMD / Bid Security",
      description: amount
        ? `Bidder must furnish EMD of ${amount[1]} ${amount[2] ?? ""} through an acceptable instrument.`
        : "Bidder must furnish EMD / bid security as specified in the tender.",
      mandatory: true,
      evidenceRequired: false,
      params: amount ? { amountLakh: toLakh(parseFloat(amount[1].replace(/,/g, "")), amount[2] ?? "lakh") } : {},
      sourceText: sentenceAround(text, emd.index ?? 0),
      confidence: 0.7,
    });
  }

  const certs: [RegExp, string][] = [
    [/iso\s*9001/i, "ISO 9001 Quality Management certification"],
    [/\bbis\b|isi\s+mark/i, "BIS / ISI certification for offered products"],
    [/iso\s*14001/i, "ISO 14001 Environmental Management certification"],
    [/\btype\s+test\b/i, "Type Test certificates for offered equipment"],
  ];
  for (const [re, label] of certs) {
    if (re.test(text)) {
      add({
        type: "CERTIFICATE",
        title: label,
        description: `Bidder must furnish valid ${label}.`,
        mandatory: true,
        evidenceRequired: true,
        params: { certificateName: label },
        sourceText: sentenceAround(text, text.search(re)),
        confidence: 0.72,
      });
    }
  }

  if (/startup/i.test(text)) {
    add({
      type: "ORGANIZATION",
      title: "Startup recognition (DPIIT) where claiming startup benefits",
      description: "Bidders claiming startup benefits must be recognized by DPIIT under the Startup India initiative.",
      mandatory: false,
      evidenceRequired: true,
      params: {},
      sourceText: sentenceAround(text, text.search(/startup/i)),
      confidence: 0.68,
    });
  }

  // de-duplicate by type
  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.type)) return false;
    seen.add(r.type);
    return true;
  });
}

/** Filename-driven document classification fallback. */
export function classifyDocumentHeuristic(fileName: string): { docType: string; confidence: number } {
  const n = fileName.toLowerCase().replace(/[^a-z0-9.]/g, " ");
  const rules: [RegExp, string][] = [
    [/gst/, "GST_CERTIFICATE"],
    [/pan/, "PAN_CARD"],
    [/udyam|msme/, "UDYAM_CERTIFICATE"],
    [/oem|authori[sz]ation/, "OEM_AUTHORIZATION"],
    [/exp/, "EXPERIENCE_CERTIFICATE"],
    [/turnover|ca\s*cert|audit|financial/, "TURNOVER_PROOF"],
    [/local\s*content|make\s*in\s*india|mii/, "LOCAL_CONTENT_DECLARATION"],
    [/datasheet|technical|spec/, "TECHNICAL_DATASHEET"],
    [/iso|bis|certificate/, "COMPANY_CERTIFICATE"],
  ];
  for (const [re, type] of rules) {
    if (re.test(n)) return { docType: type, confidence: 0.65 };
  }
  return { docType: "UNKNOWN", confidence: 0.2 };
}

export interface TenderSearchFilters {
  q?: string;
  category?: string;
  state?: string;
  msmeFriendly?: boolean;
  startupFriendly?: boolean;
  oemRequired?: boolean;
  experienceRequired?: boolean;
  closingWithinDays?: number;
  keywords?: string[];
}

/** Natural-language tender search interpretation fallback (keyword/regex based). */
export function interpretSearchHeuristic(query: string): TenderSearchFilters {
  const q = query.toLowerCase();
  const filters: TenderSearchFilters = { keywords: [] };

  for (const state of INDIAN_STATES) {
    if (q.includes(state.toLowerCase())) {
      filters.state = state;
      break;
    }
  }
  if (/\bmsme\b|micro\s+and\s+small/.test(q)) filters.msmeFriendly = true;
  if (/startup/.test(q)) filters.startupFriendly = true;
  if (/oem/.test(q)) filters.oemRequired = true;
  if (/experience|prior\s+supply|past\s+work/.test(q)) filters.experienceRequired = true;
  if (/closing\s+(?:this\s+)?week/.test(q)) filters.closingWithinDays = 7;
  if (/closing\s+today/.test(q)) filters.closingWithinDays = 1;

  const stop = new Set([
    "find", "show", "search", "active", "government", "govt", "tenders", "tender", "for", "in",
    "that", "allow", "allows", "with", "and", "the", "a", "of", "to", "closing", "this", "week",
    "today", "msme", "msmes", "oem", "startup", "startups", "friendly", "required", "require",
    "where", "which", "are", "is", "please", "me", "industrial",
  ]);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w));
  filters.keywords = Array.from(new Set(words)).slice(0, 6);

  return filters;
}

/** Structured-QA fallback used by the bidder assistant / officer copilot in demo mode. */
export function answerFromContextHeuristic(
  question: string,
  context: {
    role: "BIDDER" | "OFFICER";
    tenderTitle?: string;
    requirements: { title: string; type: string; status: string; result?: string; missingEvidence?: boolean }[];
    documents: { fileName: string; docType: string; status: string }[];
    anomalies?: { description: string }[];
    score?: number;
    riskLevel?: string;
  },
): string {
  const lines: string[] = [];
  const q = question.toLowerCase();

  if (context.role === "BIDDER" && /what.*document|which.*document|need|missing|upload/.test(q)) {
    const pending = context.requirements.filter((r) => r.missingEvidence || r.result === "INSUFFICIENT_EVIDENCE" || r.result === "FAIL");
    lines.push(pending.length ? `You still need evidence for ${pending.length} requirement(s):` : "All requirement evidence appears to be on file.");
    pending.slice(0, 8).forEach((r) => lines.push(`- ${r.title} (${r.type}${r.missingEvidence ? " — document missing" : ""})`));
  } else if (/pending|outstanding|todo|open/.test(q)) {
    const pending = context.requirements.filter((r) => r.status !== "APPROVED" || r.result === "REVIEW" || r.result === "INSUFFICIENT_EVIDENCE");
    lines.push(`${pending.length} item(s) pending review or evidence.`);
    pending.slice(0, 8).forEach((r) => lines.push(`- ${r.title}: ${r.result ?? r.status}`));
  } else if (/why.*flag|why.*fail|why.*risk|mismatch/.test(q)) {
    if (context.anomalies?.length) {
      lines.push("Flagged items (potential inconsistencies requiring manual review):");
      context.anomalies.slice(0, 8).forEach((a) => lines.push(`- ${a.description}`));
    } else {
      lines.push("No anomalies are currently flagged for this bid.");
    }
  } else if (/summar|status|overview|compliance/.test(q)) {
    if (typeof context.score === "number") lines.push(`Current compliance score: ${context.score}/100, risk: ${context.riskLevel ?? "N/A"}.`);
    const counts: Record<string, number> = {};
    for (const r of context.requirements) counts[r.result ?? r.status] = (counts[r.result ?? r.status] ?? 0) + 1;
    lines.push("Requirement status: " + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "));
  } else {
    lines.push("Here is the current snapshot:");
    lines.push(`- Requirements tracked: ${context.requirements.length}`);
    lines.push(`- Documents on file: ${context.documents.length}`);
    if (typeof context.score === "number") lines.push(`- Compliance score: ${context.score}/100 (risk: ${context.riskLevel ?? "N/A"})`);
    lines.push("Ask about: missing documents, pending items, flagged anomalies, or overall compliance status.");
  }

  lines.push("");
  lines.push("(Answer generated from your authorized bid data only — no competitor or confidential information is included.)");
  return lines.join("\n");
}
