import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { computeScore } from "@/lib/engine/analysis";
import { requireOfficer } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";

/**
 * Counterfactual analysis: "What if this requirement were satisfied?"
 * Deterministic recomputation of the compliance score with one requirement
 * overridden to PASS. No AI, no guarantees — pure rule arithmetic.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireOfficer();
    const { id } = await ctx.params;
    const { requirementId } = await req.json();
    if (!requirementId) return fail(400, "requirementId is required");

    const submission = await prisma.bidSubmission.findUnique({
      where: { id },
      include: { tender: { include: { requirements: true } }, complianceResults: true },
    });
    if (!submission) return fail(404, "Bid not found");

    type Ev = Parameters<typeof computeScore>[0][number];
    const mandatory = new Map<string, boolean>();
    for (const r of submission.tender.requirements) mandatory.set(r.id, r.mandatory);

    let targetTitle = String(requirementId);
    const evals: Ev[] = [];
    for (const cr of submission.complianceResults) {
      const req = submission.tender.requirements.find((r) => r.id === cr.requirementId);
      if (!req) continue;
      if (req.id === requirementId) targetTitle = `${req.code} — ${req.title}`;
      evals.push({
        requirementId: cr.requirementId,
        code: req.code,
        result: cr.result as never,
        details: parseJson(cr.detailsJson, {}) as never,
        ruleCode: cr.ruleCode ?? "",
        ruleVersion: cr.ruleVersion ?? 0,
        evidence: [],
        explanation: cr.explanation,
      } as unknown as Ev);
    }
    if (!evals.some((e) => (e as unknown as { requirementId: string }).requirementId === requirementId)) {
      return fail(404, "Requirement not found on this bid");
    }

    const before = computeScore(evals, mandatory);
    const hypothetical = evals.map((e) =>
      (e as unknown as { requirementId: string }).requirementId === requirementId
        ? ({ ...e, result: "PASS" } as Ev)
        : e,
    );
    const after = computeScore(hypothetical, mandatory);

    const remainingUnresolved = submission.complianceResults.filter(
      (cr) =>
        cr.requirementId !== requirementId &&
        ["REVIEW", "INSUFFICIENT_EVIDENCE", "VERIFICATION_UNAVAILABLE", "MISMATCH"].includes(cr.result),
    ).length;

    return ok({
      counterfactual: {
        requirementId,
        title: targetTitle,
        assumedResult: "PASS",
        scoreBefore: before.score,
        scoreAfter: after.score,
        delta: after.score - before.score,
        remainingUnresolved,
        disclaimer:
          "Deterministic recomputation under an assumption only. NOT a prediction or guarantee — actual results depend on real evidence being submitted and verified.",
      },
    });
  });
}
