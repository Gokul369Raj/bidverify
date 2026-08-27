import { prisma } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { compareEntities, nameSimilarity } from "@/lib/engine/entity";
import { DOC_TYPE_TO_REQUIREMENT_TYPES } from "@/lib/constants";
import { evaluateTemporal } from "@/lib/engine/temporal";

/**
 * Deterministic Compliance Rule Engine.
 *
 * The LLM never makes final compliance decisions. Each approved tender requirement is
 * evaluated against structured facts (documents, extracted fields, verification results,
 * profile) by deterministic rules loaded from the compliance_rules table (versioned).
 *
 * Possible results: PASS | FAIL | REVIEW | NOT_APPLICABLE | INSUFFICIENT_EVIDENCE | VERIFICATION_UNAVAILABLE
 */

export type ComplianceResultKind =
  | "PASS"
  | "FAIL"
  | "REVIEW"
  | "NOT_APPLICABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "VERIFICATION_UNAVAILABLE";

export interface EvidenceDraft {
  kind: "DOCUMENT" | "VERIFICATION" | "TENDER_TEXT" | "PROFILE" | "RULE";
  documentId?: string;
  verificationId?: string;
  label: string;
  page?: number;
  extractedValue?: string;
  officialValue?: string;
  comparison?: Record<string, unknown>;
}

export interface RequirementEvaluation {
  requirementId: string;
  code: string;
  result: ComplianceResultKind;
  explanation: string;
  details: {
    finding: string;
    evidence: string;
    comparison: string;
    rule: string;
    result: ComplianceResultKind;
    recommendation: string;
  };
  ruleCode: string;
  ruleVersion: number;
  evidence: EvidenceDraft[];
}

interface DocFact {
  id: string;
  docType: string;
  fileName: string;
  sha256: string;
  status: string;
  fields: Record<string, string>;
  createdAt: Date;
}

interface VerificationFact {
  id: string;
  provider: string;
  status: string;
  matchStatus?: string | null;
  requested?: Record<string, unknown>;
  returned?: Record<string, unknown> | null;
  evidence?: { label: string; value: string }[];
  note?: string;
}

export interface RuleFacts {
  org: {
    id: string;
    legalName: string;
    pan?: string | null;
    gstin?: string | null;
    udyamNumber?: string | null;
    isMsme: boolean;
    isStartup: boolean;
    annualTurnoverLakh?: number | null;
  };
  docs: DocFact[];
  verifications: Record<string, VerificationFact>;
  submitted: boolean;
  /** Temporal context — when provided, validity is judged at the legally relevant date. */
  temporal?: {
    bidSubmittedAt?: Date | null;
    tenderClosingDate?: Date | null;
    now?: Date;
  };
}

interface RuleConfig {
  code: string;
  version: number;
  failOnMismatch: boolean;
  missingResult: ComplianceResultKind;
  weight: number;
}

function field(doc: DocFact | undefined, name: string): string | undefined {
  const v = doc?.fields[name];
  return v && v !== "NOT_FOUND_IN_SOURCE" ? v : undefined;
}

/** Parse persisted document-intelligence artifacts from the field bag. */
function intelSignals(fields: Record<string, string>): {
  tamperSeverity: "NONE_DETECTED" | "LOW" | "MEDIUM" | "HIGH";
  qrStatus?: "CONSISTENT" | "CONFLICT" | "INCONCLUSIVE";
} {
  const tamperRaw = fields.tamper_signals;
  const tamperSeverity = tamperRaw?.startsWith("HIGH") ? "HIGH"
    : tamperRaw?.startsWith("MEDIUM") ? "MEDIUM"
    : tamperRaw?.startsWith("LOW") ? "LOW"
    : "NONE_DETECTED";
  let qrStatus: "CONSISTENT" | "CONFLICT" | "INCONCLUSIVE" | undefined;
  try {
    if (fields.qr_consistency) qrStatus = JSON.parse(fields.qr_consistency).status;
  } catch { /* ignore */ }
  return { tamperSeverity, qrStatus };
}

/** Apply tamper/QR evidence to a computed verdict. Returns overridden values. */
function applyIntel(
  req: { mandatory: boolean },
  reqDoc: DocFact | undefined,
  result: ComplianceResultKind,
  reason: string,
  recommendation: string,
): { result: ComplianceResultKind; reason: string; recommendation: string } {
  if (!reqDoc) return { result, reason, recommendation };
  const intel = intelSignals(reqDoc.fields);

  // QR payload conflicting with visible fields is strong documentary evidence of a problem.
  if (intel.qrStatus === "CONFLICT" && (result === "PASS" || result === "VERIFICATION_UNAVAILABLE")) {
    return {
      result: "REVIEW",
      reason: `${reason} ADDITIONAL EVIDENCE: decoded QR payload conflicts with visible document fields.`,
      recommendation: "Potential alteration or wrong-document upload — Procurement Officer review required before any decision.",
    };
  }

  if ((intel.tamperSeverity === "HIGH" || intel.tamperSeverity === "MEDIUM") && (result === "PASS" || result === "VERIFICATION_UNAVAILABLE")) {
    const sev = intel.tamperSeverity;
    return {
      result: "REVIEW",
      reason: `${reason} ADDITIONAL EVIDENCE: ${sev.toLowerCase()} tamper indicators detected in document structure.`,
      recommendation: "Potential alteration indicators detected. Procurement Officer review required — AI signals are not proof of fraud.",
    };
  }

  return { result, reason, recommendation };
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parseDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Latest document of a type that can evidence the requirement type. */
function evidenceDoc(facts: RuleFacts, reqType: string): DocFact | undefined {
  const candidates = facts.docs
    .filter((d) => d.status === "PROCESSED" && (DOC_TYPE_TO_REQUIREMENT_TYPES[d.docType] ?? []).includes(reqType))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return candidates[0];
}

function verdictFromVerification(
  v: VerificationFact | undefined,
  hasDoc: boolean,
  cfg: RuleConfig,
  mandatory: boolean,
): { result: ComplianceResultKind; reason: string } {
  if (!v) {
    return hasDoc
      ? { result: "REVIEW", reason: "Document present but no verification result recorded — manual verification required." }
      : { result: cfg.missingResult, reason: "No evidence document and no verification result available." };
  }
  switch (v.status) {
    case "VERIFIED":
      return { result: "PASS", reason: v.note ?? "Verified against the authoritative source." };
    case "MISMATCH":
      return cfg.failOnMismatch
        ? { result: mandatory ? "FAIL" : "REVIEW", reason: v.note ?? "Potential inconsistency detected against the authoritative source." }
        : { result: "REVIEW", reason: "Inconsistency detected — rule configured for manual review." };
    case "UNAVAILABLE":
      return { result: "VERIFICATION_UNAVAILABLE", reason: v.note ?? "Verification source unavailable — this is not treated as non-compliance." };
    case "REQUIRES_AUTHORIZATION":
      return { result: "VERIFICATION_UNAVAILABLE", reason: v.note ?? `${v.provider} official verification requires authorized government API credentials that are not configured. Documentary and forensic evidence only — manual officer verification required.` };
    case "NOT_FOUND":
      return { result: "REVIEW", reason: v.note ?? "Record not found in the verification source — manual verification required." };
    default:
      return { result: "REVIEW", reason: v.note ?? "Manual review required." };
  }
}

/** Evaluate one requirement against the facts. Pure function — deterministic and testable. */
export function evaluateRequirement(
  req: {
    id: string;
    code: string;
    type: string;
    title: string;
    mandatory: boolean;
    evidenceRequired: boolean;
    params: Record<string, unknown>;
    sourceText?: string | null;
  },
  facts: RuleFacts,
  cfg: RuleConfig,
): RequirementEvaluation {
  const evidence: EvidenceDraft[] = [];
  const reqDoc = evidenceDoc(facts, req.type);
  if (reqDoc) {
    evidence.push({ kind: "DOCUMENT", documentId: reqDoc.id, label: `${reqDoc.fileName} (${reqDoc.docType})`, page: 1 });
  }
  let finding = "";
  let comparison = "No comparison applicable.";
  let recommendation = "Officer to confirm.";

  let result: ComplianceResultKind;
  let reason: string;

  switch (req.type) {
    case "GST_REGISTRATION": {
      const v = facts.verifications.GST;
      const gstin = field(reqDoc, "gstin") ?? facts.org.gstin ?? undefined;
      if (gstin) evidence.push({ kind: "DOCUMENT", documentId: reqDoc?.id, label: "Extracted GSTIN", extractedValue: gstin });
      const verdict = verdictFromVerification(v, Boolean(reqDoc), cfg, req.mandatory);
      const gstApplied = applyIntel(req, reqDoc, verdict.result, verdict.reason, "Manually verify the GST certificate via the official portal.");
      result = gstApplied.result;
      reason = gstApplied.reason;
      if (gstApplied.result !== verdict.result) recommendation = gstApplied.recommendation;
      finding = `Bidder GSTIN ${gstin ?? "(none declared)"}`;
      comparison = v?.returned
        ? `Document: ${gstin ?? "—"} / ${field(reqDoc, "legalName") ?? facts.org.legalName} vs Registry: ${String(v.returned.gstin ?? "—")} / ${String(v.returned.legalName ?? "—")}`
        : "Registry comparison not available.";
      recommendation =
        result === "PASS"
          ? "No action needed."
          : result === "FAIL"
            ? "Verify the certificate against the official GST portal before accepting or rejecting."
            : "Manually verify the GST certificate via the official portal.";
      break;
    }

    case "PAN": {
      const v = facts.verifications.PAN;
      const pan = field(reqDoc, "pan") ?? facts.org.pan ?? undefined;
      const verdict = verdictFromVerification(v, Boolean(reqDoc), cfg, req.mandatory);
      const panApplied = applyIntel(req, reqDoc, verdict.result, verdict.reason, "Manually verify the PAN via an authorized PAN verification service.");
      result = panApplied.result;
      reason = panApplied.reason === verdict.reason ? verdict.reason : `${verdict.reason} ${panApplied.reason}`.trim();
      recommendation = panApplied.recommendation;
      finding = `Bidder PAN ${pan ?? "(none declared)"}`;
      comparison = v?.returned ? `Document: ${pan ?? "—"} / ${field(reqDoc, "name") ?? facts.org.legalName} vs Registry: ${String(v.returned.pan ?? "—")} / ${String(v.returned.name ?? "—")}` : "Registry comparison not available.";
      recommendation = result === "PASS" ? "No action needed." : "Manually verify the PAN via an authorized PAN verification service.";
      break;
    }

    case "UDYAM": {
      const v = facts.verifications.UDYAM;
      const udyam = field(reqDoc, "udyamNumber") ?? facts.org.udyamNumber ?? undefined;
      if (!req.mandatory && !udyam && !facts.org.isMsme) {
        result = "NOT_APPLICABLE";
        reason = "Optional MSME requirement — bidder does not claim MSME status.";
        finding = "MSME benefit not claimed";
        recommendation = "No action needed.";
      } else {
        const verdict = verdictFromVerification(v, Boolean(reqDoc), cfg, req.mandatory);
        const udyamApplied = applyIntel(req, reqDoc, verdict.result, verdict.reason, "Verify the Udyam certificate on the Udyam portal if MSME benefits apply.");
        result = udyamApplied.result;
        reason = udyamApplied.reason;
        finding = `Udyam number ${udyam ?? "(none declared)"}`;
        comparison = v?.returned ? `Document: ${udyam ?? "—"} vs Registry: ${String(v.returned.udyamNumber ?? "—")} (${String(v.returned.enterpriseType ?? "")})` : "Registry comparison not available.";
        recommendation = result === "PASS" ? "No action needed." : udyamApplied.recommendation;
      }
      break;
    }

    case "OEM_AUTHORIZATION": {
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = "No OEM Authorization document uploaded.";
        finding = "OEM authorization evidence missing";
        recommendation = "Request the OEM authorization certificate from the bidder.";
        break;
      }
      const validTill = parseDate(field(reqDoc, "validTill"));
      const authDate = parseDate(field(reqDoc, "authorizationDate"));
      const now = facts.temporal?.now ?? new Date();
      const oemTemporal = evaluateTemporal({ issueDate: authDate, expiryDate: validTill, bidSubmittedAt: facts.temporal?.bidSubmittedAt, tenderClosingDate: facts.temporal?.tenderClosingDate });
      if ((authDate && validTill && (validTill < now || authDate > validTill)) || oemTemporal.verdict === "EXPIRED_AT_SUBMISSION") {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `OEM authorization ${oemTemporal.verdict === "EXPIRED_AT_SUBMISSION" ? oemTemporal.explanation : `expired on ${field(reqDoc, "validTill")} (authorization date ${field(reqDoc, "authorizationDate")}).`}`;
        finding = "OEM authorization expired";
        recommendation = "Request a valid, in-force OEM authorization certificate.";
        break;
      }
      const bidderOnDoc = field(reqDoc, "bidderName");
      const cmp = compareEntities({
        claimedName: bidderOnDoc ?? facts.org.legalName,
        officialName: facts.org.legalName,
        identifiers: {},
      });
      if (bidderOnDoc && cmp.matchStatus === "MISMATCH") {
        result = "REVIEW";
        reason = `OEM authorization is issued to "${bidderOnDoc}" which does not clearly match the bidding organization "${facts.org.legalName}" (similarity ${cmp.nameSimilarity.toFixed(2)}).`;
        finding = "OEM authorization appears issued to a different entity";
        recommendation = "Confirm the authorization chain with the bidder and OEM.";
        evidence.push({ kind: "DOCUMENT", documentId: reqDoc.id, label: "OEM authorization issued to", extractedValue: bidderOnDoc, officialValue: facts.org.legalName, comparison: { nameSimilarity: cmp.nameSimilarity } });
        break;
      }
      result = "PASS";
      reason = `Valid OEM authorization from ${field(reqDoc, "oemName") ?? "the OEM"} for ${field(reqDoc, "productCategory") ?? "the tendered category"}, valid till ${field(reqDoc, "validTill") ?? "(date not stated)"}.`;
      finding = "OEM authorization present";
      comparison = `Authorized entity: ${bidderOnDoc ?? facts.org.legalName} (similarity ${cmp.nameSimilarity.toFixed(2)})`;
      recommendation = "No action needed.";
      break;
    }

    case "TURNOVER":
    case "FINANCIAL": {
      const minLakh = Number(req.params.minTurnoverLakh ?? 0);
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = "No turnover proof (CA/audited statements) uploaded.";
        finding = "Turnover evidence missing";
        recommendation = "Request audited financial statements or CA-certified turnover certificate.";
        break;
      }
      const fyValues = [num(field(reqDoc, "fy1TurnoverLakh")), num(field(reqDoc, "fy2TurnoverLakh")), num(field(reqDoc, "fy3TurnoverLakh"))].filter(
        (n): n is number => n !== undefined,
      );
      if (fyValues.length === 0) {
        result = "REVIEW";
        reason = "Turnover document uploaded but no financial-year values could be extracted.";
        finding = "Turnover values not extractable";
        recommendation = "Manually review the uploaded financial document.";
        break;
      }
      const avg = fyValues.reduce((a, b) => a + b, 0) / fyValues.length;
      // conflicting data check: profile vs documents
      const declared = facts.org.annualTurnoverLakh;
      const conflict = declared !== null && declared !== undefined && declared > 0 && (avg < declared * 0.5 || avg > declared * 2);
      finding = `Average turnover ${avg.toFixed(1)} L vs required ${minLakh} L`;
      comparison = `FY values: ${fyValues.map((v) => v.toFixed(0)).join(", ")} L; profile declares ${declared ?? "—"} L`;
      if (conflict) {
        result = "REVIEW";
        reason = `Turnover in documents (avg ${avg.toFixed(0)} L) conflicts materially with the profile declaration (${declared} L).`;
        recommendation = "Potential inconsistency — request clarification and audited statements.";
      } else if (avg >= minLakh) {
        result = "PASS";
        reason = `Average annual turnover ${avg.toFixed(1)} Lakh meets the minimum of ${minLakh} Lakh.`;
        recommendation = "No action needed.";
      } else {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `Average annual turnover ${avg.toFixed(1)} Lakh is below the required ${minLakh} Lakh.`;
        recommendation = "Confirm calculations; if confirmed, the requirement is not met.";
      }
      break;
    }

    case "EXPERIENCE": {
      const years = Number(req.params.years ?? 0);
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = "No experience certificate uploaded.";
        finding = "Experience evidence missing";
        recommendation = "Request past-performance / experience certificates.";
        break;
      }
      const from = parseDate(field(reqDoc, "fromDate"));
      const to = parseDate(field(reqDoc, "toDate"));
      if (!from || !to) {
        result = "REVIEW";
        reason = "Experience certificate dates could not be extracted.";
        finding = "Experience dates not extractable";
        recommendation = "Manually review the experience certificate.";
        break;
      }
      const yrs = (to.getTime() - from.getTime()) / (365.25 * 86400_000);
      finding = `Experience span ${yrs.toFixed(1)} years vs required ${years}`;
      comparison = `Certificate period ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)} for ${field(reqDoc, "purchaser") ?? "the purchaser"}`;
      if (yrs >= years) {
        result = "PASS";
        reason = `Documented experience of ${yrs.toFixed(1)} years meets the required ${years} years.`;
        recommendation = "No action needed.";
      } else {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `Documented experience of ${yrs.toFixed(1)} years is below the required ${years} years.`;
        recommendation = "If confirmed after review, the eligibility criterion is not met.";
      }
      break;
    }

    case "LOCAL_CONTENT": {
      const requiredPct = Number(req.params.localContentPct ?? 0);
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = "No local content declaration uploaded.";
        finding = "Local content evidence missing";
        recommendation = "Request the local content declaration (PPP-MII 2017).";
        break;
      }
      const declaredPct = num(field(reqDoc, "localContentPct"));
      if (declaredPct === undefined) {
        result = "REVIEW";
        reason = "Local content declaration present but percentage not extractable.";
        finding = "Local content percentage not extractable";
        recommendation = "Manually review the declaration.";
        break;
      }
      finding = `Declared local content ${declaredPct}% vs required ${requiredPct}%`;
      if (declaredPct >= requiredPct) {
        result = "PASS";
        reason = `Declared local content of ${declaredPct}% meets the required ${requiredPct}%.`;
        recommendation = "No action needed.";
      } else {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `Declared local content of ${declaredPct}% is below the required ${requiredPct}%.`;
        recommendation = `Verify with the bidder; local content shortfall may affect eligibility under MII order. BIS/DPIIT validation recommended.`;
      }
      break;
    }

    case "BIS_CERTIFICATION": {
      const bisType = String(req.params.bisType ?? "").toLowerCase();
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = "No BIS certificate uploaded.";
        finding = "BIS certificate evidence missing";
        recommendation = "Request BIS/ISI mark certificate.";
        break;
      }
      const certName = field(reqDoc, "certificateName") ?? reqDoc.fileName;
      const validTill = parseDate(field(reqDoc, "validTill"));
      const now = new Date();
      finding = `BIS Certificate: ${certName}`;
      comparison = bisType ? `Required: ${req.params.bisType}` : "Per tender specification";
      if (validTill && validTill < now) {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `BIS certificate "${certName}" expired on ${field(reqDoc, "validTill")}.`;
        recommendation = "Request a valid BIS certificate.";
        break;
      }
      // Check if certificate name includes the required BIS type
      if (bisType && !certName.toLowerCase().includes(bisType)) {
        result = "REVIEW";
        reason = `Uploaded certificate "${certName}" may not be the required BIS type (${bisType}).`;
        recommendation = `Confirm whether the uploaded ${certName} is a valid BIS ${bisType} certificate.`;
        break;
      }
      result = "PASS";
      reason = `Valid BIS "${certName}" certificate uploaded till ${field(reqDoc, "validTill") ?? "(lifetime)"}.`;
      recommendation = "No action needed.";
      break;
    }

    case "CERTIFICATE": {
      const wanted = String(req.params.certificateName ?? "").toLowerCase();
      if (!reqDoc) {
        result = cfg.missingResult;
        reason = `Required certificate (${req.params.certificateName ?? "as specified"}) not uploaded.`;
        finding = "Certificate evidence missing";
        recommendation = "Request the specified certificate.";
        break;
      }
      const certName = field(reqDoc, "certificateName") ?? reqDoc.fileName;
      const validTill = parseDate(field(reqDoc, "validTill"));
      const now = new Date();
      finding = `Certificate: ${certName}`;
      comparison = wanted ? `Required: ${req.params.certificateName}` : "Per tender specification";
      if (validTill) {
        const t = evaluateTemporal({
          issueDate: parseDate(field(reqDoc, "validFrom")),
          expiryDate: validTill,
          bidSubmittedAt: facts.temporal?.bidSubmittedAt,
          tenderClosingDate: facts.temporal?.tenderClosingDate,
        });
        const expired = t.verdict === "EXPIRED_AT_SUBMISSION" || t.verdict === "EXPIRED_NOW_STILL_RELEVANT";
        if (expired && (facts.temporal?.bidSubmittedAt || facts.temporal?.tenderClosingDate)) {
          result = req.mandatory ? "FAIL" : "REVIEW";
          reason = `Certificate "${certName}": ${t.explanation}`;
          comparison = `${comparison}; ${t.verdict}`;
          recommendation = req.mandatory
            ? "Expired at the legally relevant date — request a currently valid certificate."
            : "Officer to decide whether expired-but-recent evidence satisfies the clause.";
          break;
        }
      }
      if (validTill && validTill < now) {
        result = req.mandatory ? "FAIL" : "REVIEW";
        reason = `Certificate "${certName}" expired on ${field(reqDoc, "validTill")}.`;
        recommendation = "Request a valid certificate.";
        break;
      }
      if (wanted && !certName.toLowerCase().includes(wanted.slice(0, 12))) {
        result = "REVIEW";
        reason = `Uploaded certificate "${certName}" may not be the required one (${req.params.certificateName}).`;
        recommendation = "Confirm whether the uploaded certificate satisfies the requirement.";
        break;
      }
      result = "PASS";
      reason = `Valid certificate "${certName}"${field(reqDoc, "validTill") ? ` valid till ${field(reqDoc, "validTill")}` : ""} uploaded.`;
      recommendation = "No action needed.";
      break;
    }

    case "DECLARATION": {
      const hasDeclaration =
        reqDoc !== undefined ||
        facts.docs.some((d) => d.docType === "LOCAL_CONTENT_DECLARATION" || d.docType === "COMPANY_CERTIFICATE");
      result = hasDeclaration ? "PASS" : cfg.missingResult;
      reason = hasDeclaration ? "Required declaration is on file." : "Required declaration not uploaded.";
      finding = hasDeclaration ? "Declaration present" : "Declaration missing";
      recommendation = hasDeclaration ? "No action needed." : "Request the signed declaration.";
      break;
    }

    case "TECHNICAL_SPEC": {
      result = reqDoc ? "PASS" : cfg.missingResult;
      reason = reqDoc
        ? `Technical datasheet uploaded (${field(reqDoc, "productName") ?? reqDoc.fileName}), conformance claim: ${field(reqDoc, "standard") ?? "as per datasheet"}.`
        : "No technical datasheet uploaded.";
      finding = reqDoc ? "Technical evidence present" : "Technical evidence missing";
      recommendation = reqDoc ? "Evaluate technical conformance during technical evaluation." : "Request the technical datasheet.";
      break;
    }

    case "STATUTORY": {
      const gst = facts.verifications.GST;
      const pan = facts.verifications.PAN;
      const unavailable = [gst, pan].filter((v) => v && v.status === "UNAVAILABLE").length;
      const mismatch = [gst, pan].filter((v) => v && v.status === "MISMATCH").length;
      if (mismatch > 0) {
        result = "REVIEW";
        reason = "Statutory registration inconsistency detected — see GST/PAN checks.";
        finding = "Statutory inconsistency";
        recommendation = "Resolve the flagged statutory mismatch before evaluation.";
      } else if (unavailable > 0) {
        result = "VERIFICATION_UNAVAILABLE";
        reason = "One or more statutory verifications are unavailable — manual verification required.";
        finding = "Statutory verification unavailable";
        recommendation = "Manually verify statutory registrations.";
      } else {
        result = "PASS";
        reason = "Statutory registrations (GST/PAN) verified.";
        finding = "Statutory registrations verified";
        recommendation = "No action needed.";
      }
      comparison = `GST: ${gst?.status ?? "—"}; PAN: ${pan?.status ?? "—"}`;
      break;
    }

    case "EMD": {
      result = "REVIEW";
      reason = `EMD of ${req.params.amountLakh ?? "(as specified)"} Lakh is verified against the physical/original instrument at bid opening — outside automated document verification.`;
      finding = "EMD instrument requires physical verification";
      comparison = "Not automatable by design";
      recommendation = "Confirm EMD instrument during bid opening.";
      break;
    }

    case "ORGANIZATION": {
      const isStartupReq = String(req.params.criterion ?? "").includes("startup") || /startup/i.test(req.title);
      if (isStartupReq) {
        if (!facts.org.isStartup) {
          result = "NOT_APPLICABLE";
          reason = "Optional startup criterion — bidder does not claim startup recognition.";
          finding = "Startup benefit not claimed";
          recommendation = "No action needed.";
        } else {
          const v = facts.verifications.STARTUP;
          result = v?.status === "VERIFIED" ? "PASS" : "REVIEW";
          reason = v?.status === "VERIFIED" ? "DPIIT startup recognition verified (simulated source)." : "Startup recognition could not be verified — manual check required.";
          finding = "Startup recognition claim";
          recommendation = "Check DPIIT recognition number if startup benefits apply.";
        }
      } else {
        result = reqDoc ? "PASS" : cfg.missingResult;
        reason = reqDoc ? "Organization criterion evidence on file." : "Organization criterion evidence missing.";
        finding = reqDoc ? "Organization evidence present" : "Organization evidence missing";
        recommendation = reqDoc ? "No action needed." : "Request supporting evidence.";
      }
      break;
    }

    default: {
      result = reqDoc ? "PASS" : cfg.missingResult;
      reason = reqDoc ? `Supporting document ${reqDoc.fileName} on file.` : "No supporting document uploaded.";
      finding = reqDoc ? "Evidence present" : "Evidence missing";
      recommendation = reqDoc ? "Review manually." : "Request supporting document.";
      break;
    }
  }

  // attach tender source evidence
  if (req.sourceText) {
    evidence.push({ kind: "TENDER_TEXT", label: `Tender clause (${req.code})`, extractedValue: req.sourceText.slice(0, 300) });
  }
  const verificationForEvidence = facts.verifications[req.type === "GST_REGISTRATION" ? "GST" : req.type === "PAN" ? "PAN" : req.type === "UDYAM" ? "UDYAM" : req.type === "STATUTORY" ? "GST" : ""];
  if (verificationForEvidence) {
    evidence.push({
      kind: "VERIFICATION",
      verificationId: verificationForEvidence.id,
      label: `${verificationForEvidence.provider} verification`,
      extractedValue: JSON.stringify(verificationForEvidence.requested ?? {}),
      officialValue: JSON.stringify(verificationForEvidence.returned ?? {}),
      comparison: { status: verificationForEvidence.status, matchStatus: verificationForEvidence.matchStatus ?? null },
    });
  }
  evidence.push({ kind: "RULE", label: `Rule ${cfg.code} v${cfg.version}`, extractedValue: `mandatory=${req.mandatory}, failOnMismatch=${cfg.failOnMismatch}` });

  const explanation = [
    `Finding: ${finding}.`,
    `Evidence: ${evidence.filter((e) => e.kind === "DOCUMENT").map((e) => e.label).join("; ") || "none"}.`,
    `Comparison: ${comparison}`,
    `Rule: ${cfg.code} v${cfg.version} on requirement ${req.code} (${req.title}).`,
    `Result: ${result}. ${reason}`,
    `Recommendation: ${recommendation}`,
  ].join(" ");

  return {
    requirementId: req.id,
    code: req.code,
    result,
    explanation,
    details: { finding, evidence: evidence.map((e) => `${e.kind}:${e.label}`).join("; "), comparison, rule: `${cfg.code} v${cfg.version}`, result, recommendation },
    ruleCode: cfg.code,
    ruleVersion: cfg.version,
    evidence,
  };
}

/** Load active rule configuration per requirement type (versioned, admin-configurable). */
export async function loadRuleConfigs(): Promise<Map<string, RuleConfig>> {
  const rows = await prisma.complianceRule.findMany({ where: { active: true } });
  const map = new Map<string, RuleConfig>();
  for (const r of rows) {
    const expr = parseJson<{ failOnMismatch?: boolean; missingResult?: ComplianceResultKind }>(r.expressionJson, {});
    map.set(r.requirementType, {
      code: r.code,
      version: r.version,
      failOnMismatch: expr.failOnMismatch ?? true,
      missingResult: expr.missingResult ?? "INSUFFICIENT_EVIDENCE",
      weight: r.weight,
    });
  }
  return map;
}

export function defaultRuleConfig(requirementType: string): RuleConfig {
  return {
    code: `RULE_${requirementType}_DEFAULT`,
    version: 1,
    failOnMismatch: true,
    missingResult: "INSUFFICIENT_EVIDENCE",
    weight: 1,
  };
}

export { nameSimilarity, toJson };
