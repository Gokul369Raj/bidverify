import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { toJson } from "@/lib/json";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { submissionId, tenderId, kind = "BIDDER_COMPLIANCE", format = "PDF_PRINT" } = await req.json();
    if (!submissionId && !tenderId) return fail(400, "submissionId or tenderId required");

    let payload: Record<string, unknown> = {};
    if (submissionId) {
      const sub = await prisma.bidSubmission.findUnique({ where: { id: submissionId }, include: { tender: true, organization: true, complianceResults: { include: { requirement: true, evidences: true } }, risks: true, anomalies: true, verifications: true } });
      if (!sub) return fail(404, "Submission not found");
      payload = { kind, generatedAt: new Date().toISOString(), generatedBy: session.email, tenderNumber: sub.tender.tenderNumber, tenderTitle: sub.tender.title, bidder: sub.organization.legalName, bidNumber: sub.bidNumber, score: sub.complianceScore, risk: sub.riskLevel, recommendation: sub.aiRecommendation, decision: sub.officerDecision, requirements: sub.complianceResults.map(c => ({ code: c.requirement?.code, title: c.requirement?.title, result: c.result, overridden: c.overridden, overrideResult: c.overrideResult })), anomalies: sub.anomalies.map(a => ({ kind: a.kind, severity: a.severity, description: a.description })), riskFactors: sub.risks[0]?.factorsJson };
    } else if (tenderId) {
      const tender = await prisma.tender.findUnique({ where: { id: tenderId }, include: { bids: { include: { organization: true, complianceResults: true, risks: true } }, requirements: true } });
      if (!tender) return fail(404, "Tender not found");
      payload = { kind: "OFFICER_EVALUATION", generatedAt: new Date().toISOString(), tenderNumber: tender.tenderNumber, title: tender.title, bidders: tender.bids.map(b => ({ name: b.organization.legalName, score: b.complianceScore, risk: b.riskLevel, decision: b.officerDecision })) };
    }

    await prisma.report.create({ data: { submissionId: submissionId ?? null, tenderId: tenderId ?? null, kind, format, payloadJson: toJson(payload), generatedById: session.userId } });
    return ok(payload);
  });
}