import type { RequirementEvaluation } from "@/lib/engine/rules";

/**
 * "What would change the result?" — ordered unresolved blockers.
 * Pure deterministic derivation from rule outcomes.
 */

export interface Blocker {
  rank: number;
  code: string;
  title: string;
  currentState: string;
  whyItBlocks: string;
  resolutionPath: string;
}

const BLOCKING_STATES = new Set(["REVIEW", "INSUFFICIENT_EVIDENCE", "VERIFICATION_UNAVAILABLE", "MISMATCH"]);

type LooseDetails = Partial<RequirementEvaluation["details"]>;
type BlockerEval = {
  code: string;
  result: RequirementEvaluation["result"] | "MISMATCH" | "VERIFICATION_UNAVAILABLE" | "INSUFFICIENT_EVIDENCE";
  details: LooseDetails;
};

export function computeBlockers(
  evaluations: BlockerEval[],
  titles: Map<string, string>,
): Blocker[] {
  const severityOrder: Record<string, number> = {
    MISMATCH: 0,
    REVIEW: 1,
    VERIFICATION_UNAVAILABLE: 2,
    INSUFFICIENT_EVIDENCE: 3,
  };
  return evaluations
    .filter((e) => BLOCKING_STATES.has(e.result))
    .sort((a, b) => (severityOrder[a.result] ?? 9) - (severityOrder[b.result] ?? 9))
    .slice(0, 6)
    .map((e, i) => ({
      rank: i + 1,
      code: e.code,
      title: titles.get(e.code) ?? e.code,
      currentState: e.result,
      whyItBlocks:
        e.result === "INSUFFICIENT_EVIDENCE"
          ? "No supporting evidence was provided for this requirement."
          : e.result === "VERIFICATION_UNAVAILABLE"
            ? "Authoritative verification could not be completed (authorization/unavailability)."
            : e.result === "MISMATCH"
              ? "Evidence conflicts and must be resolved before qualification."
              : "Manual officer confirmation is outstanding for this requirement.",
      resolutionPath: e.details?.recommendation ?? "Officer review required.",
    }));
}
