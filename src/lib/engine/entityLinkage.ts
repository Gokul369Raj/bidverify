import { nameSimilarity } from "@/lib/engine/entity";
import type { LinkageCandidatePair, LinkageDecision } from "@/lib/adapters";

/**
 * Probabilistic entity linkage — Fellegi–Sunter log-odds scorer.
 *
 * Semantics mirror Splink's comparison-vector model conservatively:
 *   m  = P(agreement | same entity)      u  = P(agreement | different entities)
 *   weight = log2(m/u) per comparison field; total = sum of weights.
 *
 * HARD RULES carried over from the deterministic layer:
 *   - Conflicting STRONG identifiers (GSTIN/PAN/Udyam/CIN all present & unequal)
 *     force NON_MATCH regardless of any other agreement — fuzzy similarity alone
 *     can NEVER merge two companies.
 *   - Ambiguous band ⇒ REVIEW_REQUIRED, never an automatic merge.
 */

// Log2(m/u) style weights. Positive = evidence for same entity.
const W = {
  gstinExact: +6,
  panExact: +5,
  udyamExact: +5,
  cinExact: +4,
  gstinConflict: -12,
  panConflict: -10,
  udyamConflict: -10,
  cinConflict: -8,
  nameExactNorm: +3,
  nameClose: +1.5,
  nameDistant: -2,
  stateAgree: +0.75,
  stateDisagree: -0.75,
} as const;

const NAME_CLOSE = 0.85;
const NAME_DISTANT = 0.55;

function normId(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  return s && s !== "NOT_FOUND_IN_SOURCE" ? s : null;
}

export function scorePair(pair: LinkageCandidatePair): LinkageDecision {
  const vector: LinkageDecision["comparisonVector"] = [];
  let logOdds = 0;

  // ── Strong identifiers: agreement is powerful; conflict is decisive ──
  const idFields: Array<{ key: string; agree: number; conflict: number }> = [
    { key: "gstin", agree: W.gstinExact, conflict: W.gstinConflict },
    { key: "pan", agree: W.panExact, conflict: W.panConflict },
    { key: "udyamNumber", agree: W.udyamExact, conflict: W.udyamConflict },
    { key: "cin", agree: W.cinExact, conflict: W.cinConflict },
  ];

  let hasConflict = false;
  let hasIdentifierAgreement = false;

  for (const f of idFields) {
    const l = normId(pair.left[f.key]);
    const r = normId(pair.right[f.key]);
    if (!l || !r) {
      vector.push({ agreement: `${f.key}:missing`, weight: 0 });
      continue;
    }
    if (l === r) {
      hasIdentifierAgreement = true;
      logOdds += f.agree;
      vector.push({ agreement: `${f.key}:exact`, weight: f.agree });
    } else {
      hasConflict = true;
      logOdds += f.conflict;
      vector.push({ agreement: `${f.key}:conflict`, weight: f.conflict });
    }
  }

  // ── Name similarity bands ──
  const ln = pair.left.legalName ?? pair.left.enterpriseName ?? null;
  const rn = pair.right.legalName ?? pair.right.enterpriseName ?? null;
  let sim = 0;
  if (ln && rn) {
    sim = nameSimilarity(ln, rn);
    if (sim >= NAME_CLOSE) { logOdds += W.nameExactNorm; vector.push({ agreement: `name:sim_${sim.toFixed(2)}`, weight: W.nameExactNorm }); }
    else if (sim >= NAME_DISTANT) { logOdds += W.nameClose; vector.push({ agreement: `name:sim_${sim.toFixed(2)}`, weight: W.nameClose }); }
    else { logOdds += W.nameDistant; vector.push({ agreement: `name:sim_${sim.toFixed(2)}`, weight: W.nameDistant }); }
  }

  // ── Weak context: address/state tokens (only nudges) ──
  const ls = normId(pair.left.state);
  const rs = normId(pair.right.state);
  if (ls && rs) {
    const w = ls === rs ? W.stateAgree : W.stateDisagree;
    logOdds += w;
    vector.push({ agreement: `state:${ls === rs ? "agree" : "differ"}`, weight: w });
  }

  // Convert to probability via logistic on log2-odds (calibration is Splink-side later).
  const probability = 1 / (1 + Math.pow(2, -logOdds));

  let level: LinkageDecision["level"];
  if (hasConflict) level = "NON_MATCH";                       // identifier conflict is decisive
  else if (hasIdentifierAgreement && logOdds >= 4) level = "AUTO_MATCH";
  else if (probability >= 0.6 && logOdds >= 1.5) level = "PROBABLE_MATCH";
  else if (probability >= 0.35) level = "REVIEW_REQUIRED";
  else level = "NON_MATCH";

  return {
    leftId: pair.leftId,
    rightId: pair.rightId,
    logOdds,
    probability,
    level,
    comparisonVector: vector,
  };
}

export function scorePairs(pairs: LinkageCandidatePair[]): LinkageDecision[] {
  return pairs.map(scorePair);
}
