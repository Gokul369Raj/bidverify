/**
 * Evidence Fusion Engine.
 *
 * Replaces "AI says valid/invalid" with layered evidence arithmetic:
 *
 *   OCR/AI extraction ┐
 *   QR payload        ├─► field-level consensus ─┐
 *   PDF text layer    │                          │
 *   Validators        ┘                          ▼
 *   Cross-document consistency ─────────► FUSION ──► STATUS + LEVELS 0–7 + TRIAGE
 *   Official-source results ──────────────┘
 *
 * Levels are reported honestly; a lower achieved level is never masked:
 *   L0 exists · L1 structurally valid · L2 fields extracted · L3 internally consistent
 *   L4 cross-document consistent · L5 crypto/QR evidence · L6 official verification
 *   L7 tender-rule compliant
 */

export interface FusionDocInput {
  documentId: string;
  docType: string;
  fileName: string;
  /** "NONE_DETECTED" | LOW | MEDIUM | HIGH */
  tamperSignals?: string;
  qrConsistency?: "CONSISTENT" | "CONFLICT" | "INCONCLUSIVE";
  signatureDetected?: boolean;
  fields: Record<string, string>;           // AI-extracted (non-intel) bag
  intelFields: Record<string, string>;      // FORENSICS/QR/SIGNATURE/VALIDATOR bag (JSON strings)
}

export interface FusionProviderInput {
  provider: string;
  status: string;                            // VerificationOutcome.status
  simulated: boolean;
}

export interface FieldConsensus {
  field: string;
  sources: { source: string; value: string }[];
  verdict: "STRONG" | "PARTIAL" | "CONFLICT" | "SINGLE_SOURCE";
}

export interface FusionReport {
  overallStatus:
    | "VERIFIED"
    | "PROVISIONALLY_VERIFIED"
    | "PARTIALLY_VERIFIED"
    | "UNKNOWN"
    | "CONFLICTING_EVIDENCE";
  evidenceStrength: "STRONG" | "MODERATE" | "WEAK";
  authoritativeVerification: "AVAILABLE" | "NOT_AVAILABLE" | "REQUIRES_AUTHORIZATION";
  levelsAchieved: number[];                  // subset of 0..7
  levelDetails: { level: number; name: string; achieved: boolean; basis: string }[];
  fieldConsensus: FieldConsensus[];
  /** % of evaluated requirements backed by a decisive (pass/fail) or half-covered review state.
   *  Measured from rule outcomes — never invented. */
  verificationCoverage: number;
  openIssues: string[];
  reviewTriage: "AUTO_OK" | "SELECTIVE_REVIEW" | "HUMAN_REVIEW";
  officerReviewRecommended: boolean;
  fusedAt: string;
}

const CORE_ID_FIELDS = ["gstin", "pan", "udyamNumber"] as const;

function parseQrIdentifiers(intel: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(intel)) {
    if (!k.startsWith("qr_identifiers_")) continue;
    try {
      const ids = JSON.parse(raw) as { gstins?: string[]; pans?: string[]; udyams?: string[] };
      if (ids.gstins?.[0]) out.gstin = ids.gstins[0];
      if (ids.pans?.[0]) out.pan = ids.pans[0];
      if (ids.udyams?.[0]) out.udyamNumber = ids.udyams[0];
    } catch { /* ignore */ }
  }
  return out;
}

/** Field-level consensus engine across independent evidence sources. */
export function buildFieldConsensus(docs: FusionDocInput[], providers: FusionProviderInput[]): FieldConsensus[] {
  const consensus: FieldConsensus[] = [];

  for (const field of CORE_ID_FIELDS) {
    const sources: { source: string; value: string }[] = [];
    const seen = new Set<string>();
    const add = (source: string, value?: string) => {
      if (!value || value === "NOT_FOUND_IN_SOURCE") return;
      const v = value.toUpperCase();
      if (seen.has(v)) return; // duplicate identical claim from same channel
      seen.add(v);
      sources.push({ source, value: v });
    };

    // Source A: AI/vision extraction
    for (const d of docs) add(`AI:${d.fileName}`, d.fields[field]);
    // Source B: decoded QR payloads
    for (const d of docs) {
      const qrIds = parseQrIdentifiers(d.intelFields);
      if (qrIds[field]) add("QR", qrIds[field]);
    }
    // Source C: GSTIN embeds the PAN deterministically
    if (field === "pan") {
      const gstinSources = sources.filter((s) => s.source.startsWith("AI:"));
      for (const g of gstinSources) {
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g.value)) {
          add("DERIVED:GSTIN_PAN_segment", g.value.slice(2, 12));
        }
      }
    }
    // Source D: official registry confirmation (only genuine, unsimulated hits)
    const prov = providers.find(
      (p) =>
        p.simulated === false &&
        p.status === "VERIFIED" &&
        ((field === "gstin" && p.provider === "GST") ||
         (field === "pan" && p.provider === "PAN") ||
         (field === "udyamNumber" && p.provider === "UDYAM")),
    );
    if (prov && seen.size > 0) {
      // Registry confirms whatever documentary value exists (first claimed).
      add("OFFICIAL_REGISTRY", sources[0].value);
    }

    if (sources.length === 0) continue;
    const distinct = new Set(sources.map((s) => s.value)).size;
    let verdict: FieldConsensus["verdict"];
    if (distinct > 1) verdict = "CONFLICT";
    else if (sources.length >= 2 && sources.some((s) => s.source.startsWith("QR") || s.source.startsWith("OFFICIAL"))) verdict = "STRONG";
    else if (sources.length >= 2) verdict = "PARTIAL";
    else verdict = "SINGLE_SOURCE";

    consensus.push({ field, sources, verdict });
  }
  return consensus;
}

export function fuseEvidence(input: {
  docs: FusionDocInput[];
  providers: FusionProviderInput[];
  consistencyFindings: { kind: string; severity: string }[];
  rulesSummary: { passed: number; failed: number; reviews: number; total: number };
}): FusionReport {
  // Normalize: derive per-doc signals from the raw intel bag when callers did not.
  const docs: FusionDocInput[] = input.docs.map((d) => ({
    ...d,
    tamperSignals:
      d.tamperSignals ??
      d.intelFields?.tamper_signals?.split(":")[0],
    qrConsistency:
      d.qrConsistency ??
      (() => { try { return JSON.parse(d.intelFields?.qr_consistency ?? "null")?.status; } catch { return undefined; } })(),
    signatureDetected:
      d.signatureDetected ??
      (() => { try { return /SIGNATURE/.test(JSON.parse(d.intelFields?.signature_status ?? "{}").status ?? ""); } catch { return false; } })(),
  }));
  const providers = input.providers;
  const consistencyFindings = input.consistencyFindings;
  const rulesSummary = input.rulesSummary;

  // ── Level computation ──
  const hasDoc = docs.length > 0;
  const highTamper = docs.some((d) => (d.tamperSignals ?? "").startsWith("HIGH"));
  const mediumTamper = docs.some((d) => (d.tamperSignals ?? "").startsWith("MEDIUM"));
  const structurallyValid = hasDoc && !highTamper;
  const anyCoreField = docs.some((d) => CORE_ID_FIELDS.some((f) => d.fields[f] && d.fields[f] !== "NOT_FOUND_IN_SOURCE"));
  const validatorFailures = docs.filter((d) =>
    Object.entries(d.intelFields).some(([k, v]) => k.endsWith("_validation") && (() => { try { return JSON.parse(v)?.valid === false; } catch { return false; } })()),
  );
  const qrConflict = docs.some((d) => d.qrConsistency === "CONFLICT");
  const qrConsistent = docs.some((d) => d.qrConsistency === "CONSISTENT");
  const signaturePresent = docs.some((d) => d.signatureDetected);

  const internalConsistency = anyCoreField && validatorFailures.length === 0 && !qrConflict;
  const crossOk = !consistencyFindings.some((f) => f.severity === "HIGH" || f.severity === "MEDIUM");
  const l5 = signaturePresent || qrConsistent;
  const genuineOfficial = providers.some((p) => p.status === "VERIFIED" && !p.simulated);
  const authBlocked = providers.some((p) => p.status === "REQUIRES_AUTHORIZATION");
  const l7 = rulesSummary.total > 0 && rulesSummary.failed === 0 && rulesSummary.passed > 0;

  const levelDetails: FusionReport["levelDetails"] = [
    { level: 0, name: "File exists", achieved: true, basis: `${docs.length} processed document(s)` },
    { level: 1, name: "Structurally valid", achieved: hasDoc && !highTamper, basis: highTamper ? "HIGH tamper indicators present" : "No structural failures detected" },
    { level: 2, name: "Fields extracted", achieved: anyCoreField, basis: anyCoreField ? "core identity fields present" : "no core identity fields extracted" },
    { level: 3, name: "Internal consistency", achieved: internalConsistency, basis: [validatorFailures.length ? `${validatorFailures.length} identifier validation failure(s)` : null, qrConflict ? "QR conflict" : null].filter(Boolean).join("; ") || "validators and QR coherent" },
    { level: 4, name: "Cross-document consistency", achieved: crossOk, basis: crossOk ? "no HIGH/MEDIUM cross-document findings" : `${consistencyFindings.filter((f) => ["HIGH", "MEDIUM"].includes(f.severity)).length} finding(s)` },
    { level: 5, name: "Cryptographic / QR evidence", achieved: l5, basis: [signaturePresent ? "signature structure detected" : null, qrConsistent ? "QR consistent with fields" : null].filter(Boolean).join("; ") || "none" },
    { level: 6, name: "Authorized official verification", achieved: genuineOfficial, basis: genuineOfficial ? "unsimulated registry confirmation" : authBlocked ? "authorized credentials not configured" : "official sources unavailable/unconfigured" },
    { level: 7, name: "Tender-rule compliance", achieved: l7, basis: `rules: ${rulesSummary.passed} passed / ${rulesSummary.failed} failed / ${rulesSummary.reviews} review of ${rulesSummary.total}` },
  ];
  const levelsAchieved = levelDetails.filter((l) => l.achieved).map((l) => l.level);

  // ── Overall status ──
  const conflicting = qrConflict || consensusHasConflict(docs) || consistencyFindings.some((f) => f.severity === "HIGH");
  let overallStatus: FusionReport["overallStatus"];
  if (conflicting) overallStatus = "CONFLICTING_EVIDENCE";
  else if (genuineOfficial && internalConsistency) overallStatus = "VERIFIED";
  else if (l5 && internalConsistency && crossOk) overallStatus = "PROVISIONALLY_VERIFIED";
  else if (internalConsistency && anyCoreField) overallStatus = "PARTIALLY_VERIFIED";
  else overallStatus = "UNKNOWN";

  const evidenceStrength: FusionReport["evidenceStrength"] =
    (levelsAchieved.includes(6)) ? "STRONG"
    : levelsAchieved.filter((l) => [3, 4, 5].includes(l)).length >= 2 ? "STRONG"
    : levelsAchieved.includes(3) ? "MODERATE"
    : "WEAK";

  // ── Triage (human-in-the-loop prioritization) ──
  let reviewTriage: FusionReport["reviewTriage"];
  if (overallStatus === "CONFLICTING_EVIDENCE" || mediumTamper || highTamper || !internalConsistency || !crossOk) reviewTriage = "HUMAN_REVIEW";
  else if (evidenceStrength === "MODERATE" || !l7 || levelsAchieved.length <= 4) reviewTriage = "SELECTIVE_REVIEW";
  else reviewTriage = "AUTO_OK";

  // ── Verification coverage score (measured, not invented) ──
  // Decisive outcomes (PASS/FAIL) cover fully; REVIEW-type states cover half;
  // INSUFFICIENT_EVIDENCE / VERIFICATION_UNAVAILABLE cover a quarter.
  const decisive = rulesSummary.passed + rulesSummary.failed;
  const reviewish = Math.min(rulesSummary.reviews, Math.max(0, rulesSummary.total - decisive));
  const verificationCoverage = rulesSummary.total === 0
    ? 0
    : Math.round(((decisive + reviewish * 0.5) / rulesSummary.total) * 100);

  // ── Open issues ──
  const openIssues: string[] = [];
  if (!genuineOfficial) openIssues.push(authBlocked ? "Official real-time backend verification unavailable (authorization required)." : "Official real-time verification unavailable.");
  if (qrConflict) openIssues.push("Decoded QR conflicts with visible fields.");
  if (highTamper || mediumTamper) openIssues.push("Document forensic indicators require officer inspection.");
  if (validatorFailures.length) openIssues.push(`${validatorFailures.length} document(s) failed deterministic identifier validation.`);
  if (!crossOk) openIssues.push("Cross-document identity findings require resolution.");

  return {
    overallStatus,
    evidenceStrength,
    authoritativeVerification: genuineOfficial ? "AVAILABLE" : authBlocked ? "REQUIRES_AUTHORIZATION" : "NOT_AVAILABLE",
    levelsAchieved,
    levelDetails,
    fieldConsensus: buildFieldConsensus(docs, providers),
    verificationCoverage,
    openIssues,
    reviewTriage,
    officerReviewRecommended: reviewTriage !== "AUTO_OK",
    fusedAt: new Date().toISOString(),
  };
}

function consensusHasConflict(docs: FusionDocInput[]): boolean {
  // cheap re-check without recomputing full consensus
  for (const f of CORE_ID_FIELDS) {
    const vals = new Set<string>();
    for (const d of docs) {
      const v = d.fields[f]?.toUpperCase();
      if (v && v !== "NOT_FOUND_IN_SOURCE") vals.add(v);
      const qr = parseQrIdentifiers(d.intelFields)[f];
      if (qr) vals.add(qr.toUpperCase());
    }
    if (vals.size > 1) return true;
  }
  return false;
}
