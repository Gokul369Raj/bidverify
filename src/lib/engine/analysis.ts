import type { RuleFacts, RequirementEvaluation, ComplianceResultKind } from "@/lib/engine/rules";
import { parseDate } from "@/lib/engine/rules";

/**
 * Anomaly detection, risk scoring and compliance scoring — all deterministic.
 * Anomalies are "Potential Inconsistency — Requires Manual Review", never auto-fraud.
 */

export interface AnomalyDraft {
  kind: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export function detectAnomalies(
  facts: RuleFacts,
  verifications: Record<string, { provider: string; status: string; matchStatus?: string | null; note?: string; entityComparison?: { nameSimilarity: number; reason: string } }>,
): AnomalyDraft[] {
  const out: AnomalyDraft[] = [];
  const now = new Date();

  for (const v of Object.values(verifications)) {
    if (v.status === "MISMATCH") {
      out.push({
        kind: `${v.provider}_MISMATCH`,
        severity: "HIGH",
        description: `${v.provider} verification returned a mismatch. ${v.note ?? ""}`.trim(),
      });
    }
  }

  // expired certificates / authorizations across all docs
  for (const doc of facts.docs) {
    const validTill = parseDate(doc.fields.validTill ?? doc.fields.validUpto);
    if (validTill && validTill < now) {
      out.push({
        kind: "EXPIRED_CERTIFICATE",
        severity: "HIGH",
        description: `${doc.fileName}: validity ended ${validTill.toISOString().slice(0, 10)} (${doc.docType}).`,
      });
    }
    for (const [k, raw] of Object.entries(doc.fields)) {
      if (/date/i.test(k) && raw && raw !== "NOT_FOUND_IN_SOURCE" && !parseDate(raw) && /\d{4}/.test(raw)) {
        out.push({ kind: "INVALID_DATE", severity: "LOW", description: `${doc.fileName}: field "${k}" contains an unparseable date "${raw}".` });
      }
    }
  }

  // duplicate documents (same content hash)
  const byHash = new Map<string, string[]>();
  for (const d of facts.docs) {
    const list = byHash.get(d.sha256) ?? [];
    list.push(d.fileName);
    byHash.set(d.sha256, list);
  }
  for (const [hash, names] of byHash) {
    if (names.length > 1) {
      out.push({ kind: "DUPLICATE_DOCUMENT", severity: "MEDIUM", description: `Duplicate upload detected (${names.length} identical files: ${names.join(", ")}) [sha256 ${hash.slice(0, 12)}…].` });
    }
  }

  // turnover conflict between profile and documents
  const turnoverDoc = facts.docs.find((d) => d.docType === "TURNOVER_PROOF");
  if (turnoverDoc && facts.org.annualTurnoverLakh) {
    const vals = ["fy1TurnoverLakh", "fy2TurnoverLakh", "fy3TurnoverLakh"]
      .map((k) => parseFloat(turnoverDoc.fields[k] ?? ""))
      .filter((n) => Number.isFinite(n));
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg < facts.org.annualTurnoverLakh * 0.5 || avg > facts.org.annualTurnoverLakh * 2) {
        out.push({
          kind: "TURNOVER_CONFLICT",
          severity: "MEDIUM",
          description: `Profile declares turnover ${facts.org.annualTurnoverLakh} L but documents average ${avg.toFixed(0)} L — conflicting data requires clarification.`,
        });
      }
    }
  }

  // missing mandatory identity fields
  if (!facts.org.gstin && !facts.docs.some((d) => d.fields.gstin)) {
    out.push({ kind: "MISSING_FIELD", severity: "MEDIUM", description: "No GSTIN declared in profile or documents." });
  }
  if (!facts.org.pan && !facts.docs.some((d) => d.fields.pan)) {
    out.push({ kind: "MISSING_FIELD", severity: "MEDIUM", description: "No PAN declared in profile or documents." });
  }

  // ── Document Intelligence artifacts (forensics / QR / validators) ──
  for (const doc of facts.docs) {
    const tamperRaw = doc.fields.tamper_signals;
    if (tamperRaw) {
      const sevMatch = /^(HIGH|MEDIUM|LOW):(.*)$/.exec(tamperRaw);
      if (sevMatch) {
        const codes = sevMatch[2] ? ` (${sevMatch[2]})` : "";
        out.push({
          kind: "TAMPER_SIGNALS",
          severity: sevMatch[1] as "HIGH" | "MEDIUM" | "LOW",
          description: `${doc.fileName}: potential alteration indicators detected in document structure${codes}. These are review-prioritization signals only — Procurement Officer review required.`,
        });
      }
    }

    if (doc.fields.qr_consistency) {
      try {
        const qr = JSON.parse(doc.fields.qr_consistency) as { status?: string; details?: string[] };
        if (qr.status === "CONFLICT") {
          out.push({
            kind: "QR_MISMATCH",
            severity: "HIGH",
            description: `${doc.fileName}: decoded QR payload conflicts with visible document fields${qr.details?.length ? " — " + qr.details.slice(0, 2).join("; ") : ""}. Officer verification required.`,
          });
        }
        // CONSISTENT is positive evidence; surfaced in rules/evidence, not as anomaly.
      } catch { /* ignore malformed */ }
    }

    for (const [k, raw] of Object.entries(doc.fields)) {
      if (!k.endsWith("_validation")) continue;
      try {
        const v = JSON.parse(raw) as { field?: string; valid?: boolean; errors?: string[] };
        if (v && v.valid === false && v.field) {
          out.push({
            kind: "IDENTIFIER_INVALID",
            severity: k === "gstin_validation" ? "HIGH" : "MEDIUM",
            description: `${doc.fileName}: ${v.field.toUpperCase()} failed deterministic format validation${v.errors?.length ? " — " + v.errors[0] : ""}.`,
          });
        }
      } catch { /* ignore */ }
    }

    if (doc.fields.signature_status) {
      try {
        const sig = JSON.parse(doc.fields.signature_status) as { status?: string };
        if (sig.status === "SIGNATURE_DETECTED" || sig.status === "SIGNATURE_INFO_PARTIAL") {
          out.push({
            kind: "SIGNATURE_PRESENT_UNVALIDATED",
            severity: "LOW",
            description: `${doc.fileName}: digital signature structure detected but not cryptographically validated by this system — recorded as documentary evidence only.`,
          });
        }
      } catch { /* ignore */ }
    }
  }

  // OEM issued to another entity
  const oemDoc = facts.docs.find((d) => d.docType === "OEM_AUTHORIZATION");
  if (oemDoc?.fields.bidderName) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm(oemDoc.fields.bidderName) !== norm(facts.org.legalName)) {
      const a = norm(oemDoc.fields.bidderName);
      const b = norm(facts.org.legalName);
      const close = a.slice(0, 8) === b.slice(0, 8) || (a.length > 6 && b.includes(a.slice(0, 6)));
      out.push({
        kind: "OEM_MISMATCH",
        severity: close ? "LOW" : "HIGH",
        description: `OEM authorization is issued to "${oemDoc.fields.bidderName}" while the bidding organization is "${facts.org.legalName}".`,
      });
    }
  }

  return dedupeAnomalies(out);
}

function dedupeAnomalies(list: AnomalyDraft[]): AnomalyDraft[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const key = `${a.kind}:${a.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────── Risk scoring ───────────────────────────

export interface RiskFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface RiskOutcome {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
}

const SEVERITY_WEIGHT = { HIGH: 22, MEDIUM: 12, LOW: 5 } as const;

export function computeRisk(anomalies: AnomalyDraft[], evaluations: RequirementEvaluation[], requirementMandatory: Map<string, boolean>): RiskOutcome {
  const factors: RiskFactor[] = [];
  let score = 0;

  for (const a of anomalies) {
    const w = SEVERITY_WEIGHT[a.severity];
    score += w;
    factors.push({ factor: `anomaly.${a.kind}`, weight: w, detail: a.description });
  }

  const mandatoryFails = evaluations.filter((e) => e.result === "FAIL" && requirementMandatory.get(e.requirementId));
  if (mandatoryFails.length > 0) {
    const w = 15 * mandatoryFails.length;
    score += w;
    factors.push({ factor: "mandatory_failure", weight: w, detail: `${mandatoryFails.length} mandatory requirement(s) evaluated as FAIL: ${mandatoryFails.map((f) => f.code).join(", ")}.` });
  }

  const unavailable = evaluations.filter((e) => e.result === "VERIFICATION_UNAVAILABLE");
  if (unavailable.length > 0) {
    const w = Math.min(10, 4 * unavailable.length);
    score += w;
    factors.push({ factor: "verification_unavailable", weight: w, detail: `${unavailable.length} check(s) could not be verified externally — inconclusive, not a failure.` });
  }

  const insufficient = evaluations.filter((e) => e.result === "INSUFFICIENT_EVIDENCE");
  if (insufficient.length > 0) {
    const w = Math.min(20, 6 * insufficient.length);
    score += w;
    factors.push({ factor: "missing_evidence", weight: w, detail: `${insufficient.length} requirement(s) lack evidence: ${insufficient.map((f) => f.code).join(", ")}.` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: RiskOutcome["level"] = score < 20 ? "LOW" : score < 45 ? "MEDIUM" : score < 70 ? "HIGH" : "CRITICAL";
  return { score, level, factors };
}

// ─────────────────────────── Compliance scoring ───────────────────────────

export interface ScoreOutcome {
  score: number;
  counts: Record<string, number>;
}

const RESULT_VALUE: Record<ComplianceResultKind, number | null> = {
  PASS: 1,
  REVIEW: 0.5,
  VERIFICATION_UNAVAILABLE: 0.5,
  INSUFFICIENT_EVIDENCE: 0.25,
  FAIL: 0,
  NOT_APPLICABLE: null,
};

export function computeScore(evaluations: RequirementEvaluation[], mandatory: Map<string, boolean>): ScoreOutcome {
  const counts: Record<string, number> = {};
  let weightSum = 0;
  let valueSum = 0;
  for (const e of evaluations) {
    counts[e.result] = (counts[e.result] ?? 0) + 1;
    const val = RESULT_VALUE[e.result];
    if (val === null) continue;
    const w = mandatory.get(e.requirementId) ? 2 : 1;
    weightSum += w;
    valueSum += val * w;
  }
  const score = weightSum === 0 ? 0 : Math.round((valueSum / weightSum) * 100);
  return { score, counts };
}
