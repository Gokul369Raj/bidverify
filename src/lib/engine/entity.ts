/**
 * Entity Resolution Engine — semantic name matching with authoritative identifier logic.
 * Names are compared fuzzily (they may legitimately differ in formatting), but when both
 * sides carry the same identifier type and the identifiers differ, MISMATCH overrides
 * any name similarity.
 */

const SUFFIX_TOKENS = new Set([
  "pvt", "private", "ltd", "limited", "llp", "co", "company", "corp", "corporation",
  "inc", "industries", "enterprises", "traders", "the", "and", "&", "of", "india",
]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !SUFFIX_TOKENS.has(t))
    .join(" ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient over character bigrams, 0..1 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  if (!ga.size || !gb.size) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return (2 * inter) / (ga.size + gb.size);
}

export type EntityMatchStatus = "EXACT" | "SEMANTIC" | "MISMATCH" | "NONE";

export interface EntityComparison {
  matchStatus: EntityMatchStatus;
  nameSimilarity: number;
  identifiers: { kind: string; claimed?: string | null; official?: string | null; equal: boolean }[];
  reason: string;
}

export interface EntityComparisonInput {
  claimedName: string;
  officialName: string;
  /** identifiers present on both sides, e.g. {GSTIN: [claimed, official], PAN: [...]} */
  identifiers: Record<string, [string | null | undefined, string | null | undefined]>;
}

export function compareEntities(input: EntityComparisonInput): EntityComparison {
  const identifiers = Object.entries(input.identifiers).map(([kind, [claimed, official]]) => ({
    kind,
    claimed: claimed ?? null,
    official: official ?? null,
    equal: Boolean(claimed && official && claimed.trim().toUpperCase() === official.trim().toUpperCase()),
  }));

  const conflicting = identifiers.filter((i) => i.claimed && i.official && !i.equal);
  const matching = identifiers.filter((i) => i.equal);

  const sim = nameSimilarity(input.claimedName, input.officialName);

  if (conflicting.length > 0) {
    return {
      matchStatus: "MISMATCH",
      nameSimilarity: sim,
      identifiers,
      reason: `Identifier conflict: ${conflicting.map((c) => `${c.kind} ${c.claimed} ≠ ${c.official}`).join("; ")}. Identifier mismatch overrides name similarity.`,
    };
  }
  if (matching.length > 0 && sim >= 0.85) {
    return { matchStatus: "EXACT", nameSimilarity: sim, identifiers, reason: `Identifiers match and names align (similarity ${sim.toFixed(2)}).` };
  }
  if (matching.length > 0 && sim >= 0.6) {
    return { matchStatus: "SEMANTIC", nameSimilarity: sim, identifiers, reason: `Identifiers match; names are formatting variants (similarity ${sim.toFixed(2)}).` };
  }
  if (sim >= 0.88) {
    return { matchStatus: "SEMANTIC", nameSimilarity: sim, identifiers, reason: `Names are semantic variants (similarity ${sim.toFixed(2)}); no shared identifier to confirm.` };
  }
  if (sim >= 0.6) {
    return { matchStatus: "SEMANTIC", nameSimilarity: sim, identifiers, reason: `Names are similar (similarity ${sim.toFixed(2)}) but below the confirmation threshold — manual confirmation advised.` };
  }
  return { matchStatus: "MISMATCH", nameSimilarity: sim, identifiers, reason: `Names differ materially (similarity ${sim.toFixed(2)}).` };
}
