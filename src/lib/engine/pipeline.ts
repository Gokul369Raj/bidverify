import { prisma } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { audit } from "@/lib/audit";
import { processBidDocument } from "@/lib/documentai";
import { runVerificationProviders, type VerificationContext } from "@/lib/verification";
import { evaluateRequirement, loadRuleConfigs, defaultRuleConfig, type RuleFacts } from "@/lib/engine/rules";
import { detectAnomalies, computeRisk, computeScore } from "@/lib/engine/analysis";
import { buildConsistencyFindings } from "@/lib/engine/consistency";
import { detectContradictions } from "@/lib/engine/contradictions";
import { fuseEvidence, type FusionDocInput } from "@/lib/engine/fusion";
import { computeBlockers } from "@/lib/engine/blockers";
import { aiRecommendation, deterministicRecommendation, critiqueRecommendation } from "@/lib/ai/tasks";
import type { SessionUser } from "@/lib/auth";

/**
 * Full bid verification pipeline:
 * documents → verification providers → entity resolution anomalies →
 * rule engine → evidence mapping → risk → score → AI recommendation.
 * Idempotent: re-running replaces derived artifacts for the submission.
 */
export async function runVerificationPipeline(submissionId: string, actor?: SessionUser | null): Promise<{
  submissionId: string;
  complianceScore: number;
  riskLevel: string;
  results: { code: string; result: string }[];
  recommendationHeadline: string;
  simulated: boolean;
  fusion: {
    overallStatus: string;
    evidenceStrength: string;
    authoritativeVerification: string;
    levelsAchieved: number[];
    reviewTriage: string;
    verificationCoverage: number;
  };
}> {
  const submission = await prisma.bidSubmission.findUnique({
    where: { id: submissionId },
    include: {
      tender: { include: { requirements: true } },
      organization: true,
      documents: true,
    },
  });
  if (!submission) throw new Error("Submission not found");

  // 1. process any pending documents
  for (const doc of submission.documents.filter((d) => d.status === "UPLOADED")) {
    try {
      await processBidDocument(doc.id, actor?.userId);
    } catch (err) {
      console.error("doc processing failed", doc.id, err);
    }
  }

  const refreshed = await prisma.bidSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      tender: { include: { requirements: { where: { status: "APPROVED" } } } },
      organization: true,
      documents: { include: { fields: true }, orderBy: { createdAt: "asc" } },
    },
  });

  // 2. build facts
  const docFields = new Map<string, Record<string, string>>();
  const docClaims: VerificationContext["docClaims"] = {};
  for (const d of refreshed.documents) {
    const map: Record<string, string> = {};
    for (const f of d.fields) if (f.value !== "NOT_FOUND_IN_SOURCE") map[f.field] = f.value;
    docFields.set(d.id, map);
    if (d.docType === "GST_CERTIFICATE" && map.gstin) docClaims.gstin = map.gstin;
    if (d.docType === "GST_CERTIFICATE" && map.legalName) docClaims.gstLegalName = map.legalName;
    if (d.docType === "PAN_CARD" && map.pan) docClaims.pan = map.pan;
    if (d.docType === "PAN_CARD" && map.name) docClaims.panName = map.name;
    if (d.docType === "UDYAM_CERTIFICATE" && map.udyamNumber) docClaims.udyamNumber = map.udyamNumber;
  }

  const facts: RuleFacts = {
    org: {
      id: refreshed.organization.id,
      legalName: refreshed.organization.legalName,
      pan: refreshed.organization.pan,
      gstin: refreshed.organization.gstin,
      udyamNumber: refreshed.organization.udyamNumber,
      isMsme: refreshed.organization.isMsme,
      isStartup: refreshed.organization.isStartup,
      annualTurnoverLakh: refreshed.organization.annualTurnoverLakh,
    },
    docs: refreshed.documents
      .filter((d) => d.status === "PROCESSED")
      .map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName, sha256: d.sha256, status: d.status, fields: docFields.get(d.id) ?? {}, createdAt: d.createdAt })),
    verifications: {},
    submitted: refreshed.status !== "DRAFT",
    temporal: {
      bidSubmittedAt: refreshed.submittedAt,
      tenderClosingDate: refreshed.tender.closingDate,
    },
  };

  // 3. run verification providers
  const includeStatutory = refreshed.tender.requirements.some((r) => r.type === "STATUTORY");
  const outcomes = await runVerificationProviders(
    { submissionId, org: { ...facts.org, tradeName: refreshed.organization.tradeName, cin: refreshed.organization.cin }, docClaims },
    includeStatutory,
  );

  await prisma.verificationResult.deleteMany({ where: { submissionId } });
  const verificationRowIds: Record<string, string> = {};
  for (const o of outcomes) {
    const row = await prisma.verificationResult.create({
      data: {
        submissionId,
        provider: o.provider,
        status: o.status,
        simulated: o.simulated,
        requestedJson: toJson(o.requested),
        returnedJson: o.returned ? toJson(o.returned) : undefined,
        matchStatus: o.matchStatus ?? null,
        source: o.source,
        referenceId: o.referenceId,
        confidence: o.confidence,
        evidenceJson: toJson({ items: o.evidence, note: o.note ?? null, entityComparison: o.entityComparison ?? null }),
      },
    });
    verificationRowIds[o.provider] = row.id;
    facts.verifications[o.provider] = {
      id: row.id,
      provider: o.provider,
      status: o.status,
      matchStatus: o.matchStatus,
      requested: o.requested,
      returned: o.returned,
      note: o.note,
    };
  }

  // 4. anomalies — structural + document-intelligence + cross-document consistency + contradictions
  const consistencyFindings = buildConsistencyFindings(facts);
  const contradictionFindings = detectContradictions(facts);
  const anomalyDrafts = [
    ...detectAnomalies(facts, facts.verifications),
    ...consistencyFindings.map((f) => ({ kind: f.kind, severity: f.severity, description: f.description })),
    ...contradictionFindings.map((f) => ({ kind: f.kind, severity: f.severity, description: `${f.description} [A: ${f.evidenceA.claim.slice(0, 80)}${f.evidenceB ? ` | B: ${f.evidenceB.claim.slice(0, 80)}` : ""}]` })),
  ];
  await prisma.anomaly.deleteMany({ where: { submissionId, status: "OPEN" } });
  for (const a of anomalyDrafts) {
    await prisma.anomaly.create({ data: { submissionId, kind: a.kind, severity: a.severity, description: a.description } });
  }

  // 5. rule engine over approved requirements
  const ruleConfigs = await loadRuleConfigs();
  const evaluations = refreshed.tender.requirements.map((r) => {
    const cfg = ruleConfigs.get(r.type) ?? defaultRuleConfig(r.type);
    return evaluateRequirement(
      {
        id: r.id,
        code: r.code,
        type: r.type,
        title: r.title,
        mandatory: r.mandatory,
        evidenceRequired: r.evidenceRequired,
        params: parseJson<Record<string, unknown>>(r.paramsJson, {}),
        sourceText: r.sourceText,
      },
      facts,
      cfg,
    );
  });

  await prisma.complianceResult.deleteMany({ where: { submissionId } });
  for (const e of evaluations) {
    const row = await prisma.complianceResult.create({
      data: {
        submissionId,
        requirementId: e.requirementId,
        ruleCode: e.ruleCode,
        ruleVersion: e.ruleVersion,
        result: e.result,
        explanation: e.explanation,
        detailsJson: toJson(e.details),
      },
    });
    for (const ev of e.evidence) {
      await prisma.evidenceItem.create({
        data: {
          submissionId,
          requirementId: e.requirementId,
          complianceResultId: row.id,
          kind: ev.kind,
          documentId: ev.documentId ?? null,
          verificationId: ev.verificationId ?? verificationRowIds[ev.kind === "VERIFICATION" ? "GST" : ""] ?? null,
          label: ev.label,
          page: ev.page ?? null,
          extractedValue: ev.extractedValue ?? null,
          officialValue: ev.officialValue ?? null,
          comparisonJson: ev.comparison ? toJson(ev.comparison) : undefined,
        },
      });
    }
  }

  // 5b. Evidence Fusion — field consensus + verification LEVELS 0–7 + triage
  const INTEL_SOURCES = ["FORENSICS", "SIGNATURE", "QR", "VALIDATOR"];
  const fusionDocs: FusionDocInput[] = refreshed.documents
    .filter((d) => d.status === "PROCESSED")
    .map((d) => {
      const bag: Record<string, string> = {};
      const intelBag: Record<string, string> = {};
      for (const f of d.fields) {
        if (INTEL_SOURCES.includes(f.source)) intelBag[f.field] = f.value;
        else if (f.value !== "NOT_FOUND_IN_SOURCE") bag[f.field] = f.value;
      }
      let qrConsistency: FusionDocInput["qrConsistency"];
      try {
        if (intelBag.qr_consistency) qrConsistency = JSON.parse(intelBag.qr_consistency).status;
      } catch { /* ignore */ }
      let signatureDetected = false;
      try {
        if (intelBag.signature_status) signatureDetected = /SIGNATURE/.test(JSON.parse(intelBag.signature_status).status ?? "");
      } catch { /* ignore */ }
      return {
        documentId: d.id,
        docType: d.docType,
        fileName: d.fileName,
        tamperSignals: intelBag.tamper_signals?.split(":")[0],
        qrConsistency,
        signatureDetected,
        fields: bag,
        intelFields: intelBag,
      };
    });

  const rulesSummary = {
    passed: evaluations.filter((e) => e.result === "PASS").length,
    failed: evaluations.filter((e) => e.result === "FAIL").length,
    reviews: evaluations.filter((e) => ["REVIEW", "INSUFFICIENT_EVIDENCE", "VERIFICATION_UNAVAILABLE"].includes(e.result)).length,
    total: evaluations.length,
  };
  const titleMap = new Map(refreshed.tender.requirements.map((r) => [r.code, r.title]));
  const blockers = computeBlockers(
    evaluations.map((e) => ({ code: e.code, result: e.result, details: e.details })),
    titleMap,
  );
  const fusion = fuseEvidence({
    docs: fusionDocs,
    providers: outcomes.map((o) => ({ provider: o.provider, status: o.status, simulated: o.simulated })),
    consistencyFindings,
    rulesSummary,
  });

  // 6. risk + score
  const mandatoryMap = new Map(refreshed.tender.requirements.map((r) => [r.id, r.mandatory]));
  const risk = computeRisk(anomalyDrafts, evaluations, mandatoryMap);
  const score = computeScore(evaluations, mandatoryMap);

  await prisma.riskScore.create({
    data: { submissionId, score: risk.score, level: risk.level, factorsJson: toJson(risk.factors), method: "DETERMINISTIC_V1" },
  });

  // 7. AI recommendation (structured, grounded, with deterministic fallback)
  const summary = {
    tenderTitle: refreshed.tender.title,
    bidder: refreshed.organization.legalName,
    score: score.score,
    riskLevel: risk.level,
    counts: score.counts,
    failed: evaluations.filter((e) => e.result === "FAIL").map((e) => ({ code: e.code, title: refreshed.tender.requirements.find((r) => r.id === e.requirementId)?.title ?? "", explanation: e.details.finding })),
    reviews: evaluations.filter((e) => e.result === "REVIEW").map((e) => ({ code: e.code, title: refreshed.tender.requirements.find((r) => r.id === e.requirementId)?.title ?? "" })),
    unavailable: Object.values(facts.verifications).filter((v) => v.status === "UNAVAILABLE").map((v) => ({ code: v.provider, provider: v.provider })),
    anomalies: anomalyDrafts.map((a) => ({ kind: a.kind, description: a.description })),
    consistencyFindings: consistencyFindings.map((f) => ({ kind: f.kind, severity: f.severity })),
  };
  const rec = await aiRecommendation(summary, actor?.userId);

  // Independent reviewer/critic pass — challenges the primary conclusion.
  const critique = critiqueRecommendation({
    headline: rec.data.headline,
    suggestedAction: rec.data.suggestedAction,
    fusion: {
      overallStatus: fusion.overallStatus,
      reviewTriage: fusion.reviewTriage,
      openIssues: fusion.openIssues,
    },
    failed: summary.failed,
    reviews: summary.reviews,
  });

  const anySimulated = outcomes.some((o) => o.simulated) || rec.meta.simulated;
  await prisma.bidSubmission.update({
    where: { id: submissionId },
    data: {
      status: refreshed.status === "DRAFT" ? refreshed.status : "VERIFIED",
      complianceScore: score.score,
      riskScore: risk.score,
      riskLevel: risk.level,
      aiRecommendation: rec.data.headline,
      aiRecommendationJson: toJson({ ...rec.data, meta: rec.meta, fusion, critique, blockers }),
    },
  });

  // 8. notify bidder + audit with full progress tracker
  const bidderUsers = await prisma.user.findMany({ where: { organizationId: refreshed.organizationId } });
  const passCount = evaluations.filter((e) => e.result === "PASS").length;
  const failCount = evaluations.filter((e) => e.result === "FAIL").length;
  const reviewCount = evaluations.filter((e) => e.result === "REVIEW").length;
  const insuffCount = evaluations.filter((e) => e.result === "INSUFFICIENT_EVIDENCE").length;
  const unavailCount = evaluations.filter((e) => e.result === "VERIFICATION_UNAVAILABLE").length;

  // Build per-requirement result lines
  const reqResults = evaluations.map((e) => {
    const icon = e.result === "PASS" ? "✅" : e.result === "FAIL" ? "❌" : e.result === "REVIEW" ? "⚠️" : "🔲";
    return `${icon} ${e.code}: ${e.result}`;
  }).join("\n");

  const verdictIcon = score.score >= 70 ? "✅" : score.score >= 50 ? "⚠️" : "❌";

  for (const u of bidderUsers) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        title: `${verdictIcon} Verification Complete — ${refreshed.tender.tenderNumber}`,
        body: `📊 Compliance Verification Report\n\nBid: ${refreshed.bidNumber}\nTender: ${refreshed.tender.tenderNumber}\nBidder: ${refreshed.organization.legalName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 Progress Tracker:\n  ✅ Step 1: Bid Submitted — Confirmed\n  ✅ Step 2: AI Document Analysis — ${refreshed.documents.filter((d) => d.status === "PROCESSED").length}/${refreshed.documents.length} documents processed\n  ✅ Step 3: Verification Complete — Score ${score.score}/100\n  ⏳ Step 4: Awaiting Officer Decision\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📈 Verification Results:\n  Compliance Score: ${score.score}/100\n  Risk Level: ${risk.level}\n  Passed: ${passCount} | Failed: ${failCount} | Review: ${reviewCount}\n  Insufficient Evidence: ${insuffCount} | Unavailable: ${unavailCount}\n\n📝 Requirement Results:\n${reqResults}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n💬 AI Recommendation: ${rec.data.headline}`,
        kind: score.score >= 70 ? "SUCCESS" : "WARNING",
        link: "/bidder/bids",
      },
    });
  }
  await audit({
    actor,
    action: "COMPLIANCE_CALCULATED",
    entityType: "BidSubmission",
    entityId: submissionId,
    after: { score: score.score, risk: risk.level, counts: score.counts },
  });

  return {
    submissionId,
    complianceScore: score.score,
    riskLevel: risk.level,
    results: evaluations.map((e) => ({ code: e.code, result: e.result })),
    recommendationHeadline: rec.data.headline,
    simulated: anySimulated,
    fusion: {
      overallStatus: fusion.overallStatus,
      evidenceStrength: fusion.evidenceStrength,
      authoritativeVerification: fusion.authoritativeVerification,
      levelsAchieved: fusion.levelsAchieved,
      reviewTriage: fusion.reviewTriage,
      verificationCoverage: fusion.verificationCoverage,
    },
  };
}

/** Build the context summary used for grounded assistant/copilot answers. */
export async function buildAssistantContext(submissionId: string) {
  const sub = await prisma.bidSubmission.findUnique({
    where: { id: submissionId },
    include: {
      tender: { include: { requirements: true } },
      organization: true,
      documents: { include: { fields: true } },
      complianceResults: true,
      anomalies: true,
      verifications: true,
    },
  });
  if (!sub) throw new Error("Submission not found");
  const resultByReq = new Map(sub.complianceResults.map((c) => [c.requirementId, c]));
  return {
    tenderNumber: sub.tender.tenderNumber,
    tenderTitle: sub.tender.title,
    bidder: sub.organization.legalName,
    status: sub.status,
    score: sub.complianceScore,
    riskLevel: sub.riskLevel,
    requirements: sub.tender.requirements.map((r) => ({
      code: r.code,
      type: r.type,
      title: r.title,
      mandatory: r.mandatory,
      status: r.status,
      result: resultByReq.get(r.id)?.result ?? "NOT_EVALUATED",
    })),
    documents: sub.documents.map((d) => ({ fileName: d.fileName, docType: d.docType, status: d.status })),
    verifications: sub.verifications.map((v) => ({ provider: v.provider, status: v.status, matchStatus: v.matchStatus, simulated: v.simulated })),
    anomalies: sub.anomalies.filter((a) => a.status === "OPEN").map((a) => ({ kind: a.kind, description: a.description })),
  };
}

export { deterministicRecommendation, critiqueRecommendation };
