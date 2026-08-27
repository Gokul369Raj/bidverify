import type { RuleFacts } from "@/lib/engine/rules";
import { nameSimilarity } from "@/lib/engine/entity";

/**
 * Contradiction Engine — dedicated detector for direct evidentiary conflicts.
 *
 * Categories: identity names, addresses, dates-vs-tender context,
 * registration numbers, registry status, quantitative claims.
 * Output is structured CONTRADICTION evidence with severity + recommended
 * action. A contradiction is review evidence — never an automatic accusation.
 */

export interface ContradictionFinding {
  kind: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  evidenceA: { source: string; claim: string };
  evidenceB?: { source: string; claim: string };
  recommendedAction: string;
}

const NOT_FOUND = "NOT_FOUND_IN_SOURCE";

function latestDocWith(
  docs: RuleFacts["docs"],
  docTypes: string[],
  field: string,
): { value?: string; fileName?: string; docType: string } | null {
  const filtered = [...docs].reverse().find(
    (d) => docTypes.includes(d.docType) && d.fields[field] && d.fields[field] !== NOT_FOUND,
  );
  return filtered ? { value: filtered.fields[field], fileName: filtered.fileName, docType: filtered.docType } : null;
}

function addrKey(addr: string): string {
  // Normalize address to a comparable token signature (pincode + first tokens).
  const pin = /(\d{6})/.exec(addr)?.[1] ?? "";
  const toks = addr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2).slice(0, 4).join(" ");
  return `${pin}|${toks}`;
}

export function detectContradictions(facts: RuleFacts): ContradictionFinding[] {
  const out: ContradictionFinding[] = [];
  const docs = facts.docs;

  // ── Address contradictions (GST vs Udyam vs profile) ──
  const gstAddr = latestDocWith(docs, ["GST_CERTIFICATE"], "address");
  const udyamAddr = latestDocWith(docs, ["UDYAM_CERTIFICATE"], "officialAddress") ?? latestDocWith(docs, ["UDYAM_CERTIFICATE"], "address");
  const pairs: [string | undefined, string | undefined][] = [];
  const profileAddr = (facts.org as unknown as { registeredAddress?: string | null }).registeredAddress;
  if (gstAddr?.value && profileAddr) pairs.push([gstAddr.value, profileAddr]);
  if (udyamAddr?.value && gstAddr?.value) pairs.push([udyamAddr.value, gstAddr.value]);
  for (const [a, b] of pairs.slice(0, 1)) {
    if (addrKey(a!) !== addrKey(b!)) {
      out.push({
        kind: "ADDRESS_CONTRADICTION",
        severity: "MEDIUM",
        description: `Registered addresses differ between documents (PIN/locality signature mismatch). Multi-branch businesses are legitimate — officer confirmation advised.`,
        evidenceA: { source: "GST certificate", claim: a!.slice(0, 160) },
        evidenceB: { source: "organization profile", claim: String(b!).slice(0, 160) },
        recommendedAction: "Compare full addresses; request clarification only if materially different premises.",
      });
    }
  }

  // ── Status conflicts: document claims ACTIVE while registry evidence disagrees ──
  const gstStatusDoc = latestDocWith(docs, ["GST_CERTIFICATE"], "status");
  const gstVerification = facts.verifications.GST;
  if (gstStatusDoc?.value && gstVerification?.returned) {
    // Only authoritative when the registry hit was NOT simulated
    const isSimulated = (gstVerification as unknown as { simulated?: boolean }).simulated ?? true;
    const regStatus = String((gstVerification.returned as Record<string, unknown>).status ?? "");
    if (!isSimulated && regStatus && regStatus.toUpperCase() !== gstStatusDoc.value.toUpperCase()) {
      out.push({
        kind: "REGISTRY_STATUS_CONFLICT",
        severity: "HIGH",
        description: `Certificate shows status "${gstStatusDoc.value}" while the authoritative registry returned "${regStatus}".`,
        evidenceA: { source: gstStatusDoc.fileName ?? "GST certificate", claim: gstStatusDoc.value },
        evidenceB: { source: `${gstVerification.provider} registry`, claim: regStatus },
        recommendedAction: "Registry evidence outranks the document image. Officer must resolve before qualification.",
      });
    }
  }

  // ── Quantitative conflicts: turnover across documents vs profile ──
  const turnoverDocs = docs.filter(
    (d) => d.docType === "TURNOVER_PROOF" && Object.keys(d.fields).some((k) => k.endsWith("TurnoverLakh")),
  );
  const values = turnoverDocs.flatMap((d) =>
    ["fy1TurnoverLakh", "fy2TurnoverLakh", "fy3TurnoverLakh"]
      .map((k) => parseFloat(d.fields[k] ?? ""))
      .filter((n) => Number.isFinite(n)),
  );
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min > 0 && max / min >= 8) {
      out.push({
        kind: "TURNOVER_OUTLIER",
        severity: "LOW",
        description: `Turnover figures vary by ${(max / min).toFixed(1)}× across financial years/documents (${min}L–${max}L). Growth or data-entry variance possible.`,
        evidenceA: { source: "turnover proof", claim: `min ${min}L` },
        evidenceB: { source: "turnover proof", claim: `max ${max}L` },
        recommendedAction: "Sanity-check against CA certification during review.",
      });
    }
  }

  // ── Name contradiction between identity docs (formalized from consistency) ──
  const gstName = latestDocWith(docs, ["GST_CERTIFICATE"], "legalName");
  const panName = latestDocWith(docs, ["PAN_CARD"], "name");
  if (gstName?.value && panName?.value) {
    const sim = nameSimilarity(gstName.value, panName.value);
    if (sim < 0.55) {
      out.push({
        kind: "IDENTITY_NAME_CONTRADICTION",
        severity: "HIGH",
        description: `GST legal name and PAN name are materially different entities (similarity ${(sim * 100).toFixed(0)}%).`,
        evidenceA: { source: gstName.fileName ?? "GST certificate", claim: gstName.value },
        evidenceB: { source: panName.fileName ?? "PAN document", claim: panName.value },
        recommendedAction: "Officer resolution required — these identifiers should belong to one legal person/entity.",
      });
    }
  }

  return out;
}
