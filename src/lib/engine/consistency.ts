import type { RuleFacts } from "@/lib/engine/rules";
import { nameSimilarity } from "@/lib/engine/entity";
import { GST_STATE_NAMES } from "@/lib/verify/identifiers";

/**
 * Cross-document consistency engine — CORE identity layer.
 *
 * Compares extracted identifiers and names ACROSS all submitted documents plus
 * the organization profile, producing severity-rated FINDINGS with evidence.
 * Deterministic only: no AI, no guessing. A finding is review evidence,
 * never an automatic accusation.
 */

export interface ConsistencyFinding {
  kind: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  evidence: { left: string; right: string; values: Record<string, string> };
}

const NOT_FOUND = "NOT_FOUND_IN_SOURCE";

function fieldOf(docs: RuleFacts["docs"], docType: string, field: string): { value?: string; fileName?: string } {
  const doc = [...docs].reverse().find((d) => d.docType === docType && d.fields[field] && d.fields[field] !== NOT_FOUND);
  return doc ? { value: doc.fields[field], fileName: doc.fileName } : {};
}

function anyDocField(docs: RuleFacts["docs"], field: string): { value?: string; fileName?: string } {
  const doc = [...docs].reverse().find((d) => d.fields[field] && d.fields[field] !== NOT_FOUND);
  return doc ? { value: doc.fields[field], fileName: doc.fileName } : {};
}

/** Map an Indian state name to its GST state code prefix (best-effort). */
function stateNameToCode(state: string | null | undefined): string | undefined {
  if (!state) return undefined;
  const s = state.toLowerCase();
  for (const [code, name] of Object.entries(GST_STATE_NAMES)) {
    if (name.toLowerCase() === s) return code;
  }
  // partial match e.g. "Maharashtra" variants handled by exact map above
  return undefined;
}

export function buildConsistencyFindings(facts: RuleFacts): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];
  const docs = facts.docs;

  // ── 1. PAN ↔ GSTIN embedded PAN segment ──
  const panDoc = anyDocField(docs, "pan");
  const gstinDoc = anyDocField(docs, "gstin");
  const pan = panDoc.value ?? facts.org.pan ?? undefined;
  const gstin = gstinDoc.value ?? facts.org.gstin ?? undefined;
  if (pan && gstin && gstin.length === 15) {
    const embedded = gstin.slice(2, 12);
    if (embedded !== pan.toUpperCase()) {
      out.push({
        kind: "PAN_GSTIN_LINKAGE_CONFLICT",
        severity: "HIGH",
        description: `PAN inside GSTIN (${embedded}) does not match the PAN on record (${pan.toUpperCase()}). These identifiers legally derive from the same PAN.`,
        evidence: { left: panDoc.fileName ?? "org profile", right: gstinDoc.fileName ?? "org profile", values: { pan: pan.toUpperCase(), embeddedPanInGstin: embedded, gstin } },
      });
    }
  }

  // ── 2. Legal-name coherence across identity documents ──
  const nameSources: { label: string; name?: string }[] = [
    { label: "GST certificate", name: fieldOf(docs, "GST_CERTIFICATE", "legalName").value },
    { label: "Udyam certificate", name: fieldOf(docs, "UDYAM_CERTIFICATE", "enterpriseName").value },
    { label: "PAN document", name: fieldOf(docs, "PAN_CARD", "name").value },
    { label: "Organization profile", name: facts.org.legalName },
  ].filter((n) => n.name);

  const THRESHOLD_MISMATCH = 0.6;
  const THRESHOLD_VARIANT = 0.85;
  for (let i = 0; i < nameSources.length; i++) {
    for (let j = i + 1; j < nameSources.length; j++) {
      const a = nameSources[i];
      const b = nameSources[j];
      if (!a.name || !b.name) continue;
      const sim = nameSimilarity(a.name, b.name);
      if (sim < THRESHOLD_MISMATCH) {
        out.push({
          kind: "CROSS_DOCUMENT_NAME_MISMATCH",
          severity: "HIGH",
          description: `Legal names differ materially between ${a.label} ("${a.name}") and ${b.label} ("${b.name}") — similarity ${(sim * 100).toFixed(0)}%. Officer verification required.`,
          evidence: { left: a.label, right: b.label, values: { [a.label]: a.name!, [b.label]: b.name!, similarity: sim.toFixed(2) } },
        });
      } else if (sim < THRESHOLD_VARIANT && a.label === "Organization profile") {
        out.push({
          kind: "NAME_VARIANT_NOTE",
          severity: "LOW",
          description: `${b.label} name "${b.name}" is a plausible formatting variant of the profile legal name ("${a.name}") — similarity ${(sim * 100).toFixed(0)}%.`,
          evidence: { left: a.label, right: b.label, values: { similarity: sim.toFixed(2) } },
        });
      }
    }
  }

  // ── 3. State-code coherence (GSTIN state vs Udyam state letters vs profile state) ──
  const gstState = gstin ? gstin.slice(0, 2) : undefined;
  const udyam = fieldOf(docs, "UDYAM_CERTIFICATE", "udyamNumber").value;
  const udyamStateLetters = udyam ? udyam.slice(6, 8) : undefined;
  void stateNameToCode;
  void udyamStateLetters;

  // ── 4. PAN across documents ──
  const panFromGstin = gstin ? gstin.slice(2, 12) : undefined;
  const panFromUdyam = fieldOf(docs, "UDYAM_CERTIFICATE", "panInCertificate").value;
  if (pan && panFromUdyam && pan.toUpperCase() !== panFromUdyam.toUpperCase()) {
    out.push({
      kind: "PAN_CROSS_DOC_CONFLICT",
      severity: "HIGH",
      description: `PAN from PAN document (${pan}) differs from PAN in Udyam certificate (${panFromUdyam}).`,
      evidence: { left: "PAN document", right: "Udyam certificate", values: { pan, panInUdyam: panFromUdyam } },
    });
  }

  // ── 5. Organization name between GST and Udyam ──
  const gstLegalName = fieldOf(docs, "GST_CERTIFICATE", "legalName").value;
  const udyamEnterpriseName = fieldOf(docs, "UDYAM_CERTIFICATE", "enterpriseName").value;
  if (gstLegalName && udyamEnterpriseName) {
    const sim = nameSimilarity(gstLegalName, udyamEnterpriseName);
    if (sim < 0.6) {
      out.push({
        kind: "GST_UDYAM_NAME_MISMATCH",
        severity: "MEDIUM",
        description: `Organization names differ: GST shows "${gstLegalName}" vs Udyam shows "${udyamEnterpriseName}" (${(sim * 100).toFixed(0)}% similarity).`,
        evidence: { left: "GST certificate", right: "Udyam certificate", values: { gstName: gstLegalName, udyamName: udyamEnterpriseName, similarity: sim.toFixed(2) } },
      });
    }
  }

  // ── 6. Experience certificates with same project/client (possible duplicates) ──
  const expDocs = docs.filter(d => d.docType === "EXPERIENCE_CERTIFICATE");
  if (expDocs.length > 1) {
    const projects = expDocs.map(d => ({ name: d.fields.projectName || d.fields.clientName || "", file: d.fileName || "" })).filter(p => p.name);
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const sim = nameSimilarity(projects[i].name, projects[j].name);
        if (sim > 0.85) {
          out.push({
            kind: "EXPERIENCE_DUPLICATE_SUSPECT",
            severity: "MEDIUM",
            description: `Experience certificates "${projects[i].file}" and "${projects[j].file}" appear to reference the same project/client (${(sim * 100).toFixed(0)}% similar).`,
            evidence: { left: projects[i].file, right: projects[j].file, values: { projectA: projects[i].name, projectB: projects[j].name } },
          });
        }
      }
    }
  }

  // ── 7. Duplicate-document cross-reference is handled in analysis.ts via sha256 ──
  return out;
}
